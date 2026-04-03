import type { PolicyGrantLike, VerificationResult } from "./types.js";
import { policyGrantForVerificationSchema } from "../protocol/schema/verifySchemas.js";
import { verifyPolicyGrantSignature } from "../protocol/policyGrant.js";
import type { SignedPolicyGrant } from "../protocol/policyGrant.js";
import type { TrustBundle } from "../protocol/trustBundle.js";

const DEFAULT_CLOCK_DRIFT_TOLERANCE_MS = 300_000;

export interface VerifyPolicyGrantOptions {
  nowMs?: number;
  trustBundles?: TrustBundle[];
  clockDriftToleranceMs?: number;
}

/**
 * Verify a policy grant is valid (schema, expiry with clock drift, signature).
 */
export function verifyPolicyGrant(
  grant: unknown,
  options?: VerifyPolicyGrantOptions,
): VerificationResult {
  const parsed = policyGrantForVerificationSchema.safeParse(grant);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? parsed.error.message}`, artifact: "policyGrant" };
  }
  const g = parsed.data;

  const nowMs = typeof options?.nowMs === "number" ? options.nowMs : Date.now();
  const driftMs = options?.clockDriftToleranceMs ?? DEFAULT_CLOCK_DRIFT_TOLERANCE_MS;
  const expiresAt = g.expiresAt ?? g.expiresAtISO;
  if (!expiresAt) {
    return { valid: false, reason: "policy_grant_missing_expiry", artifact: "policyGrant" };
  }
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return { valid: false, reason: "policy_grant_invalid_expiry", artifact: "policyGrant" };
  }
  if (expiryMs <= nowMs - driftMs) {
    return { valid: false, reason: "policy_grant_expired", artifact: "policyGrant" };
  }

  if (process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM || options?.trustBundles?.length) {
    if (!g.issuerKeyId || !g.signature) {
      return { valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" };
    }
    const { issuerKeyId: _kid, signature: _sig, issuer: _iss, ...coreGrant } = g as Record<string, unknown>;
    const sigResult = verifyPolicyGrantSignature({
      grant: coreGrant as unknown as PolicyGrantLike,
      issuerKeyId: g.issuerKeyId,
      signature: g.signature,
      ...(g.issuer ? { issuer: g.issuer } : {}),
    } as SignedPolicyGrant, { trustBundles: options?.trustBundles });
    if (!sigResult.ok) {
      return { valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" };
    }
  }

  return { valid: true };
}
