/**
 * Single internal verification pipeline.
 * Emits bare result, steps (for report), and checks (for detailed report).
 *
 * Check naming: Artifact.check (PascalCase artifact, camelCase check)
 * - PolicyGrant.schema, PolicyGrant.valid
 * - SignedBudgetAuthorization.schema, SignedBudgetAuthorization.valid
 * - SignedPaymentAuthorization.schema, SignedPaymentAuthorization.valid
 * - SettlementIntent.schema, SettlementIntent.required, SettlementIntent.intentHash, SettlementIntent.fields
 *
 * Check ordering: schema → linkage → hash → policy (checks are sorted by phase before return)
 */

import { computeSettlementIntentHash } from "../hash/computeSettlementIntentHash.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import { verifyPaymentAuthorization } from "./verifyPaymentAuthorization.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { verifySettlementIntent } from "./verifySettlementIntent.js";
import type {
  SettlementVerificationContext,
  VerificationCheck,
  VerificationCheckPhase,
  VerificationResult,
  VerificationStep,
} from "./types.js";

const PHASE_ORDER: VerificationCheckPhase[] = ["schema", "linkage", "hash", "policy"];

/** Internal pipeline output — single source of truth. */
export interface VerificationPipelineOutput {
  result: VerificationResult;
  steps: VerificationStep[];
  checks: VerificationCheck[];
}

function parseArtifact(
  name: string,
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { errors: unknown[]; message: string } } },
  value: unknown,
): VerificationResult {
  const result = schema.safeParse(value);
  if (result.success) return { valid: true };
  const first = (result as { error: { errors: Array<{ path?: string[]; message?: string }> } }).error.errors[0];
  const path = first?.path?.length ? first.path.join(".") + ": " : "";
  return {
    valid: false,
    reason: `invalid_artifact: ${name} ${path}${first?.message ?? (result as { error: { message: string } }).error.message}`,
    artifact: name,
  };
}

function pushCheck(
  checks: VerificationCheck[],
  artifact: string,
  check: string,
  phase: VerificationCheckPhase,
  valid: boolean,
  opts?: { reason?: string; expected?: unknown; actual?: unknown },
): boolean {
  checks.push({
    name: `${artifact}.${check}`,
    phase,
    artifact,
    check,
    valid,
    reason: opts?.reason,
    expected: opts?.expected,
    actual: opts?.actual,
  });
  return valid;
}

function sortChecksByPhase(checks: VerificationCheck[]): VerificationCheck[] {
  return [...checks].sort(
    (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
  );
}

function pushStep(steps: VerificationStep[], name: string, result: VerificationResult): boolean {
  const ok = result.valid;
  steps.push({ name, ok, reason: ok ? undefined : result.reason });
  return ok;
}

/**
 * Single verification pipeline. Runs once, collects result + steps + checks.
 */
export function runVerificationPipeline(
  ctx: SettlementVerificationContext,
): VerificationPipelineOutput {
  const steps: VerificationStep[] = [];
  const checks: VerificationCheck[] = [];

  const out = (): VerificationPipelineOutput => ({
    result: { valid: true },
    steps,
    checks: sortChecksByPhase(checks),
  });
  const fail = (result: VerificationResult): VerificationPipelineOutput => ({
    result,
    steps,
    checks: sortChecksByPhase(checks),
  });

  // --- Schema validation ---
  const grantCheck = parseArtifact("policyGrant", policyGrantForVerificationSchema, ctx.policyGrant);
  if (!pushCheck(checks, "PolicyGrant", "schema", "schema", grantCheck.valid, {
    reason: grantCheck.valid ? undefined : grantCheck.reason,
  })) {
    return fail(grantCheck);
  }

  const sbaCheck = parseArtifact("signedBudgetAuthorization", signedBudgetAuthorizationSchema, ctx.signedBudgetAuthorization);
  if (!pushCheck(checks, "SignedBudgetAuthorization", "schema", "schema", sbaCheck.valid, {
    reason: sbaCheck.valid ? undefined : sbaCheck.reason,
  })) {
    return fail(sbaCheck);
  }

  const spaCheck = parseArtifact("signedPaymentAuthorization", signedPaymentAuthorizationSchema, ctx.signedPaymentAuthorization);
  if (!pushCheck(checks, "SignedPaymentAuthorization", "schema", "schema", spaCheck.valid, {
    reason: spaCheck.valid ? undefined : spaCheck.reason,
  })) {
    return fail(spaCheck);
  }

  if (ctx.settlementIntent) {
    const intentCheck = parseArtifact("settlementIntent", settlementIntentForVerificationSchema, ctx.settlementIntent);
    if (!pushCheck(checks, "SettlementIntent", "schema", "schema", intentCheck.valid, {
      reason: intentCheck.valid ? undefined : intentCheck.reason,
    })) {
      return fail(intentCheck);
    }
  }

  if (ctx.signedPaymentAuthorization.authorization.intentHash && !ctx.settlementIntent) {
    pushCheck(checks, "SettlementIntent", "required", "schema", false, { reason: "intent_required" });
    return fail({
      valid: false,
      reason: "intent_required",
      artifact: "signedPaymentAuthorization",
    });
  }

  // --- Policy grant ---
  const grantResult = verifyPolicyGrant(ctx.policyGrant, { nowMs: ctx.nowMs });
  if (!pushStep(steps, "PolicyGrant.valid", grantResult)) {
    pushCheck(checks, "PolicyGrant", "valid", "policy", false, {
      reason: grantResult.valid ? undefined : grantResult.reason,
    });
    return fail(grantResult);
  }
  pushCheck(checks, "PolicyGrant", "valid", "policy", true);

  // --- Budget (linkage) ---
  const budgetResult = verifyBudgetAuthorization(
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    { nowMs: ctx.nowMs },
  );
  if (!pushStep(steps, "SignedBudgetAuthorization.valid", budgetResult)) {
    pushCheck(checks, "SignedBudgetAuthorization", "valid", "linkage", false, {
      reason: budgetResult.valid ? undefined : budgetResult.reason,
    });
    return fail(budgetResult);
  }
  pushCheck(checks, "SignedBudgetAuthorization", "valid", "linkage", true);

  // --- Intent hash ---
  if (ctx.settlementIntent && ctx.signedPaymentAuthorization.authorization.intentHash) {
    const intentParsed = settlementIntentForVerificationSchema.safeParse(ctx.settlementIntent);
    if (intentParsed.success) {
      const auth = ctx.signedPaymentAuthorization.authorization;
      const expectedHash = computeSettlementIntentHash(intentParsed.data);
      const actualHash = auth.intentHash;
      const hashMatch = expectedHash === actualHash;
      pushCheck(checks, "SettlementIntent", "intentHash", "hash", hashMatch, hashMatch ? undefined : {
        reason: "mismatch",
        expected: expectedHash,
        actual: actualHash,
      });
      if (!hashMatch) {
        pushStep(steps, "SettlementIntent.intentHash", {
          valid: false,
          reason: "intent_hash_mismatch",
          artifact: "settlementIntent",
        });
        return fail({
          valid: false,
          reason: "intent_hash_mismatch",
          artifact: "settlementIntent",
        });
      }
    }
  }

  // --- Payment (linkage) ---
  const paymentResult = verifyPaymentAuthorization(
    ctx.signedPaymentAuthorization,
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    ctx.settlement,
    { nowMs: ctx.nowMs, settlementIntent: ctx.settlementIntent },
  );
  if (!pushStep(steps, "SignedPaymentAuthorization.valid", paymentResult)) {
    pushCheck(checks, "SignedPaymentAuthorization", "valid", "linkage", false, {
      reason: paymentResult.valid ? undefined : paymentResult.reason,
    });
    return fail(paymentResult);
  }
  pushCheck(checks, "SignedPaymentAuthorization", "valid", "linkage", true);

  // --- Intent verification (hash + field match when intent present) ---
  if (ctx.settlementIntent) {
    const intentResult = verifySettlementIntent(
      ctx.signedPaymentAuthorization,
      ctx.settlementIntent as Record<string, unknown>,
    );
    if (!pushStep(steps, "SettlementIntent.intentHash", intentResult)) {
      if (!checks.some((c) => c.name === "SettlementIntent.intentHash" && !c.valid)) {
        pushCheck(checks, "SettlementIntent", "fields", "policy", false, {
          reason: intentResult.valid ? undefined : intentResult.reason,
        });
      }
      return fail(intentResult);
    }
  } else if (ctx.signedPaymentAuthorization.authorization.intentHash) {
    return fail({
      valid: false,
      reason: "intent_required",
      artifact: "signedPaymentAuthorization",
    });
  }

  return out();
}
