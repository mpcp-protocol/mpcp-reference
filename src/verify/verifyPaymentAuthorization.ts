import { canonicalJson } from "../canonical/canonicalJson.js";
import { computeSettlementIntentHash } from "../hash/computeSettlementIntentHash.js";
import type { SettlementResult } from "../policy-core/types.js";
import type { PaymentPolicyDecision } from "../policy-core/types.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";
import {
  verifySignedPaymentAuthorizationForSettlement,
} from "../protocol/spa.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import type { VerificationResult } from "./types.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";

function assetMatches(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * Verify a signed payment authorization (SPA) against the budget chain and settlement.
 *
 * Order: 1 schema validation, 2 hash validation (intentHash), 3 artifact linkage,
 *        4 budget limits, 5 policy constraints.
 *
 * @param envelope - SPA envelope
 * @param sba - Signed budget authorization this SPA derives from
 * @param grant - Policy grant the budget derives from
 * @param decision - Payment decision (for budget limit verification)
 * @param settlement - Executed settlement to verify against
 * @param options - nowMs, settlementIntent (required if SPA has intentHash)
 */
export function verifyPaymentAuthorization(
  envelope: unknown,
  sba: unknown,
  grant: unknown,
  decision: PaymentPolicyDecision,
  settlement: SettlementResult,
  options?: { nowMs?: number; settlementIntent?: unknown },
): VerificationResult {
  // 1. Schema validation
  const spaResult = signedPaymentAuthorizationSchema.safeParse(envelope);
  if (!spaResult.success) {
    const first = spaResult.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? spaResult.error.message}`, artifact: "signedPaymentAuthorization" };
  }
  const sbaResult = signedBudgetAuthorizationSchema.safeParse(sba);
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
  const envelopeParsed = spaResult.data;
  const sbaParsed = sbaResult.data;
  const grantParsed = grantResult.data;

  // 2. Hash validation (intentHash)
  if (envelopeParsed.authorization.intentHash) {
    if (!options?.settlementIntent) {
      return { valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" };
    }
    const intentResult = settlementIntentForVerificationSchema.safeParse(options.settlementIntent);
    if (!intentResult.success) {
      const first = intentResult.error.errors[0];
      const path = first?.path?.length ? first.path.join(".") + ": " : "";
      return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? intentResult.error.message}`, artifact: "settlementIntent" };
    }
    const computed = computeSettlementIntentHash(intentResult.data);
    if (computed !== envelopeParsed.authorization.intentHash) {
      return { valid: false, reason: "intent_hash_mismatch", artifact: "settlementIntent" };
    }
  }

  // 3. Artifact linkage (SPA → SBA)
  if (envelopeParsed.authorization.sessionId !== sbaParsed.authorization.sessionId) {
    return { valid: false, reason: "payment_auth_session_mismatch", artifact: "signedPaymentAuthorization" };
  }
  if (envelopeParsed.authorization.policyHash !== sbaParsed.authorization.policyHash) {
    return { valid: false, reason: "payment_auth_policy_hash_mismatch", artifact: "signedPaymentAuthorization" };
  }

  // 4. Budget limits (SPA params within SBA allowlists)
  const auth = envelopeParsed.authorization;
  if (!sbaParsed.authorization.allowedRails.includes(auth.rail as "xrpl" | "evm" | "stripe" | "hosted")) {
    return { valid: false, reason: "payment_auth_rail_not_in_budget", artifact: "signedPaymentAuthorization" };
  }
  if (
    sbaParsed.authorization.allowedAssets.length > 0 &&
    auth.asset &&
    !sbaParsed.authorization.allowedAssets.some((a: unknown) => assetMatches(a, auth.asset))
  ) {
    return { valid: false, reason: "payment_auth_asset_not_in_budget", artifact: "signedPaymentAuthorization" };
  }
  const destAllowlist = sbaParsed.authorization.destinationAllowlist;
  if (destAllowlist != null && destAllowlist.length > 0 && auth.destination && !destAllowlist.includes(auth.destination)) {
    return { valid: false, reason: "payment_auth_destination_not_in_budget", artifact: "signedPaymentAuthorization" };
  }

  // 5. Policy constraints (grant, SBA, SPA signature/expiry, settlement match)
  const budgetResult = verifyBudgetAuthorization(
    sbaParsed,
    grantParsed,
    decision,
    options,
  );
  if (!budgetResult.valid) return budgetResult;

  const spaVerify = verifySignedPaymentAuthorizationForSettlement(
    envelopeParsed as SignedPaymentAuthorization,
    envelopeParsed.authorization.decisionId,
    settlement,
    {
      nowMs: options?.nowMs,
      settlementIntent: options?.settlementIntent,
    },
  );
  if (!spaVerify.ok) {
    const reason =
      spaVerify.reason === "invalid_signature"
        ? "payment_auth_invalid_signature"
        : spaVerify.reason === "expired"
          ? "payment_auth_expired"
          : "payment_auth_mismatch";
    return { valid: false, reason, artifact: "signedPaymentAuthorization" };
  }

  return { valid: true };
}
