import type { SettlementVerificationContext, VerificationResult } from "./types.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { verifyPaymentAuthorization } from "./verifyPaymentAuthorization.js";
import { verifySettlementIntent } from "./verifySettlementIntent.js";

function parseArtifact(
  name: string,
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { errors: unknown[]; message: string } } },
  value: unknown,
): VerificationResult {
  const result = schema.safeParse(value);
  if (result.success) return { valid: true };
  const first = (result as { error: { errors: Array<{ path?: string[]; message?: string }> } }).error.errors[0];
  const path = first?.path?.length ? first.path.join(".") + ": " : "";
  return { valid: false, reason: `invalid_artifact: ${name} ${path}${first?.message ?? (result as { error: { message: string } }).error.message}`, artifact: name };
}

/**
 * Verify a full MPCP settlement chain.
 *
 * Order: 1 schema validation, 2 hash validation, 3 artifact linkage,
 *        4 budget limits, 5 policy constraints (via sub-verifiers).
 *
 * @param ctx - Full verification context
 * @returns Deterministic result with clear failure reason
 */
export function verifySettlement(
  ctx: SettlementVerificationContext,
): VerificationResult {
  // 1. Schema validation
  const grantCheck = parseArtifact("policyGrant", policyGrantForVerificationSchema, ctx.policyGrant);
  if (!grantCheck.valid) return grantCheck;
  const sbaCheck = parseArtifact("signedBudgetAuthorization", signedBudgetAuthorizationSchema, ctx.signedBudgetAuthorization);
  if (!sbaCheck.valid) return sbaCheck;
  const spaCheck = parseArtifact("signedPaymentAuthorization", signedPaymentAuthorizationSchema, ctx.signedPaymentAuthorization);
  if (!spaCheck.valid) return spaCheck;
  // 1. Schema validation (settlement intent when present)
  if (ctx.settlementIntent) {
    const intentCheck = parseArtifact("settlementIntent", settlementIntentForVerificationSchema, ctx.settlementIntent);
    if (!intentCheck.valid) return intentCheck;
  }
  if (
    ctx.signedPaymentAuthorization.authorization.intentHash &&
    !ctx.settlementIntent
  ) {
    return { valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" };
  }

  const grantResult = verifyPolicyGrant(ctx.policyGrant, {
    nowMs: ctx.nowMs,
  });
  if (!grantResult.valid) return grantResult;

  const paymentResult = verifyPaymentAuthorization(
    ctx.signedPaymentAuthorization,
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    ctx.settlement,
    {
      nowMs: ctx.nowMs,
      settlementIntent: ctx.settlementIntent,
    },
  );
  if (!paymentResult.valid) return paymentResult;

  if (ctx.settlementIntent) {
    const intentResult = verifySettlementIntent(
      ctx.signedPaymentAuthorization,
      ctx.settlementIntent as Record<string, unknown>,
    );
    if (!intentResult.valid) return intentResult;
  } else if (ctx.signedPaymentAuthorization.authorization.intentHash) {
    return { valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" };
  }

  return { valid: true };
}
