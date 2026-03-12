import type { PolicyGrantLike, VerificationResult } from "./types.js";
import { policyGrantForVerificationSchema } from "../protocol/schema/verifySchemas.js";

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
  options?: { nowMs?: number },
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
  return { valid: true };
}
