/**
 * Single internal verification pipeline.
 * Emits bare result, steps (for report), and checks (for detailed report).
 *
 * Ordering: steps are chain-oriented (leaf → root for display); checks are phase-oriented
 * (schema → linkage → hash → policy, sorted before return). Keep both orderings intentional.
 *
 * Check naming: Artifact.check (PascalCase artifact, camelCase check)
 * - PolicyGrant.schema, PolicyGrant.valid
 * - SignedBudgetAuthorization.schema, SignedBudgetAuthorization.valid
 */

import { signedBudgetAuthorizationSchema } from "../protocol/schema/signedBudgetAuthorization.js";
import { policyGrantForVerificationSchema } from "../protocol/schema/verifySchemas.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
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

  // --- Policy grant ---
  const grantResult = verifyPolicyGrant(ctx.policyGrant, { nowMs: ctx.nowMs, trustBundles: ctx.trustBundles });
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
    { nowMs: ctx.nowMs, cumulativeSpentMinor: ctx.cumulativeSpentMinor, trustBundles: ctx.trustBundles },
  );
  if (!pushStep(steps, "SignedBudgetAuthorization.valid", budgetResult)) {
    pushCheck(checks, "SignedBudgetAuthorization", "valid", "linkage", false, {
      reason: budgetResult.valid ? undefined : budgetResult.reason,
    });
    return fail(budgetResult);
  }
  pushCheck(checks, "SignedBudgetAuthorization", "valid", "linkage", true);

  return out();
}
