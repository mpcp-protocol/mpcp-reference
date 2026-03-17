import type { PolicyGrantLike, VerificationResult } from "./types.js";
import { policyGrantForVerificationSchema } from "../protocol/schema/verifySchemas.js";
import { verifyPolicyGrantSignature } from "../protocol/policyGrant.js";
import type { SignedPolicyGrant } from "../protocol/policyGrant.js";
import type { TrustBundle } from "../protocol/trustBundle.js";

/**
 * Verify a policy grant is valid (not expired).
 *
 * Order: 1 schema validation, 5 policy constraints (expiry).
 *
 * @param grant - Policy grant artifact
 * @param options.nowMs - Verification time (default: Date.now())
 * @returns Deterministic result with clear failure reason
 */
export function verifyPolicyGrant(
  grant: unknown,
  options?: { nowMs?: number; trustBundles?: TrustBundle[] },
): VerificationResult {
  // 1. Schema validation
  const parsed = policyGrantForVerificationSchema.safeParse(grant);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? parsed.error.message}`, artifact: "policyGrant" };
  }
  const g = parsed.data;
  // 5. Policy constraints (expiry)
  const nowMs = typeof options?.nowMs === "number" ? options.nowMs : Date.now();
  const expiresAt = g.expiresAt ?? g.expiresAtISO;
  if (!expiresAt) {
    return { valid: false, reason: "policy_grant_missing_expiry", artifact: "policyGrant" };
  }
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return { valid: false, reason: "policy_grant_invalid_expiry", artifact: "policyGrant" };
  }
  if (expiryMs <= nowMs) {
    return { valid: false, reason: "policy_grant_expired", artifact: "policyGrant" };
  }

  // If signing public key is configured OR trust bundles are provided, require and verify signature
  if (process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM || options?.trustBundles?.length) {
    if (!g.issuerKeyId || !g.signature) {
      return { valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" };
    }
    // Strip signing envelope fields so hash matches what was originally signed
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
