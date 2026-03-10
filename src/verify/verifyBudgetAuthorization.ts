import type { PaymentPolicyDecision } from "../policy-core/types.js";
import { verifySignedSessionBudgetAuthorizationForDecision } from "../protocol/sba.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";
import type { VerificationResult } from "./types.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";

/**
 * Verify a signed budget authorization (signature, expiry, grant chain).
 *
 * Order: 1 schema validation, 3 artifact linkage, 5 policy constraints (grant expiry),
 *        4 budget limits, 5 policy constraints (SBA signature/expiry).
 *
 * @param envelope - SBA envelope
 * @param grant - Policy grant this budget derives from
 * @param decision - Payment decision to verify fits within budget
 * @param options.nowMs - Verification time (default: Date.now())
 * @returns Deterministic result with clear failure reason
 */
export function verifyBudgetAuthorization(
  envelope: unknown,
  grant: unknown,
  decision: PaymentPolicyDecision,
  options?: { nowMs?: number },
): VerificationResult {
  // 1. Schema validation
  const sbaResult = signedBudgetAuthorizationSchema.safeParse(envelope);
  if (!sbaResult.success) {
    const first = sbaResult.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? sbaResult.error.message}`, artifact: "signedBudgetAuthorization" };
  }
  const grantResult = policyGrantForVerificationSchema.safeParse(grant);
  if (!grantResult.success) {
    const first = grantResult.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? grantResult.error.message}`, artifact: "policyGrant" };
  }
  const envelopeParsed = sbaResult.data;
  const grantParsed = grantResult.data;

  // 3. Artifact linkage (SBA → grant)
  if (envelopeParsed.authorization.policyHash !== grantParsed.policyHash) {
    return { valid: false, reason: "budget_policy_hash_mismatch", artifact: "signedBudgetAuthorization" };
  }
  const grantRails = new Set(grantParsed.allowedRails);
  for (const rail of envelopeParsed.authorization.allowedRails) {
    if (!grantRails.has(rail)) {
      return { valid: false, reason: "budget_rail_not_in_grant", artifact: "signedBudgetAuthorization" };
    }
  }

  // 5. Policy constraints (grant expiry)
  const grantVerify = verifyPolicyGrant(grantParsed, options);
  if (!grantVerify.valid) return grantVerify;

  // 4. Budget limits + 5. Policy (SBA signature, expiry) — via protocol
  const result = verifySignedSessionBudgetAuthorizationForDecision(envelopeParsed as SignedSessionBudgetAuthorization, {
    sessionId: envelopeParsed.authorization.sessionId,
    decision,
    nowMs: options?.nowMs,
  });
  if (!result.ok) return { valid: false, reason: result.reason, artifact: "signedBudgetAuthorization" };
  return { valid: true };
}
