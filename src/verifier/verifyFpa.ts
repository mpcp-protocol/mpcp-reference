/**
 * FleetPolicyAuthorization verification (SECOP 10c / mpcp.md Step 0a).
 *
 * Optional step: when fleet governance applies, verify the FPA artifact's
 * signature, expiry, and constraint intersection with the PolicyGrant.
 */

import crypto, { createHash } from "node:crypto";
import { canonicalJson } from "../hash/canonicalJson.js";
import type { FleetPolicyAuthorization } from "../protocol/schema/fleetPolicyAuthorization.js";
import { fleetPolicyAuthorizationSchema } from "../protocol/schema/fleetPolicyAuthorization.js";
import { resolveFromTrustBundle, type TrustBundle } from "../protocol/trustBundle.js";
import type { PolicyGrantLike, VerificationResult } from "./types.js";

const DEFAULT_CLOCK_DRIFT_TOLERANCE_MS = 300_000;

export interface VerifyFpaOptions {
  nowMs?: number;
  clockDriftToleranceMs?: number;
  trustBundles?: TrustBundle[];
}

function hashFpaAuthorization(authorization: unknown): Buffer {
  return createHash("sha256")
    .update("MPCP:FPA:1.0:" + canonicalJson(authorization))
    .digest();
}

/**
 * Verify FPA signature, expiry, and intersection with the PolicyGrant.
 */
export function verifyFleetPolicyAuthorization(
  fpa: unknown,
  grant: PolicyGrantLike,
  options?: VerifyFpaOptions,
): VerificationResult {
  // Schema
  const parsed = fleetPolicyAuthorizationSchema.safeParse(fpa);
  if (!parsed.success) {
    return { valid: false, reason: "invalid_fpa_schema", artifact: "FleetPolicyAuthorization" };
  }
  const envelope = parsed.data as FleetPolicyAuthorization;
  const auth = envelope.authorization;

  // Expiry with clock drift tolerance
  const nowMs = options?.nowMs ?? Date.now();
  const driftMs = options?.clockDriftToleranceMs ?? DEFAULT_CLOCK_DRIFT_TOLERANCE_MS;
  const expiryMs = Date.parse(auth.expiresAt);
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs - driftMs) {
    return { valid: false, reason: "fpa_expired", artifact: "FleetPolicyAuthorization" };
  }

  // Signature verification
  let publicKey: crypto.KeyObject | null = null;
  if (options?.trustBundles?.length && envelope.issuer) {
    const jwk = resolveFromTrustBundle(
      envelope.issuer,
      envelope.issuerKeyId,
      options.trustBundles,
    );
    if (jwk) {
      try { publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" }); } catch { /* fall through */ }
    }
  }
  if (!publicKey) {
    const pem = process.env.MPCP_FPA_SIGNING_PUBLIC_KEY_PEM;
    if (!pem) {
      return { valid: false, reason: "fpa_key_not_found", artifact: "FleetPolicyAuthorization" };
    }
    try { publicKey = crypto.createPublicKey(pem); } catch {
      return { valid: false, reason: "fpa_key_invalid", artifact: "FleetPolicyAuthorization" };
    }
  }

  try {
    const valid = crypto.verify(
      null,
      hashFpaAuthorization(auth),
      publicKey,
      Buffer.from(envelope.signature, "base64"),
    );
    if (!valid) {
      return { valid: false, reason: "invalid_fpa_signature", artifact: "FleetPolicyAuthorization" };
    }
  } catch {
    return { valid: false, reason: "invalid_fpa_signature", artifact: "FleetPolicyAuthorization" };
  }

  // Intersection: rails
  const grantRails = new Set(grant.allowedRails);
  for (const rail of auth.allowedRails) {
    if (!grantRails.has(rail)) {
      return { valid: false, reason: "fpa_rail_not_in_grant", artifact: "FleetPolicyAuthorization" };
    }
  }

  // Intersection: operator allowlist
  if (grant.operatorId && auth.allowedOperators.length > 0) {
    if (!auth.allowedOperators.includes(grant.operatorId)) {
      return { valid: false, reason: "fpa_operator_not_allowed", artifact: "FleetPolicyAuthorization" };
    }
  }

  // Spending cap: FPA.maxAmountMinor vs PolicyGrant.budgetMinor (when both present and comparable)
  if (grant.budgetMinor && auth.maxAmountMinor) {
    const fpaCapMinor = BigInt(auth.maxAmountMinor);
    const grantCeiling = BigInt(grant.budgetMinor);
    if (fpaCapMinor > grantCeiling) {
      return { valid: false, reason: "fpa_cap_exceeds_grant_budget", artifact: "FleetPolicyAuthorization" };
    }
  }

  return { valid: true };
}
