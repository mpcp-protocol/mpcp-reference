/**
 * Single internal verification pipeline (SECOP-aligned).
 *
 * Check order: schema → FPA (optional) → grant → authorizedGateway → purpose →
 * budgetId replay → actorId → budgetMinor → SBA linkage + budget.
 */

import { signedBudgetAuthorizationSchema } from "../protocol/schema/signedBudgetAuthorization.js";
import { policyGrantForVerificationSchema } from "../protocol/schema/verifySchemas.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import { verifyFleetPolicyAuthorization } from "./verifyFpa.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import type {
  SettlementVerificationContext,
  VerificationCheck,
  VerificationCheckPhase,
  VerificationResult,
  VerificationStep,
} from "./types.js";

const PHASE_ORDER: VerificationCheckPhase[] = ["schema", "linkage", "hash", "policy"];

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

export function runVerificationPipeline(
  ctx: SettlementVerificationContext,
): VerificationPipelineOutput {
  const steps: VerificationStep[] = [];
  const checks: VerificationCheck[] = [];
  const driftMs = ctx.clockDriftToleranceMs;

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

  // --- Step 0a: Fleet Policy Authorization (optional, SECOP 10c) ---
  if (ctx.fleetPolicyAuthorization) {
    const fpaResult = verifyFleetPolicyAuthorization(
      ctx.fleetPolicyAuthorization,
      ctx.policyGrant,
      { nowMs: ctx.nowMs, clockDriftToleranceMs: driftMs, trustBundles: ctx.trustBundles },
    );
    if (!pushStep(steps, "FleetPolicyAuthorization.valid", fpaResult)) {
      pushCheck(checks, "FleetPolicyAuthorization", "valid", "policy", false, {
        reason: fpaResult.valid ? undefined : fpaResult.reason,
      });
      return fail(fpaResult);
    }
    pushCheck(checks, "FleetPolicyAuthorization", "valid", "policy", true);
  }

  // --- Step 0: Policy grant (signature + expiry with drift) ---
  const grantResult = verifyPolicyGrant(ctx.policyGrant, {
    nowMs: ctx.nowMs,
    trustBundles: ctx.trustBundles,
    clockDriftToleranceMs: driftMs,
  });
  if (!pushStep(steps, "PolicyGrant.valid", grantResult)) {
    pushCheck(checks, "PolicyGrant", "valid", "policy", false, {
      reason: grantResult.valid ? undefined : grantResult.reason,
    });
    return fail(grantResult);
  }
  pushCheck(checks, "PolicyGrant", "valid", "policy", true);

  // --- SECOP 6b: authorizedGateway ---
  if (ctx.gatewayAddress && ctx.policyGrant.authorizedGateway) {
    if (ctx.policyGrant.authorizedGateway !== ctx.gatewayAddress) {
      const r: VerificationResult = { valid: false, reason: "GATEWAY_NOT_AUTHORIZED", artifact: "policyGrant" };
      pushCheck(checks, "PolicyGrant", "authorizedGateway", "policy", false, {
        reason: r.reason,
        expected: ctx.policyGrant.authorizedGateway,
        actual: ctx.gatewayAddress,
      });
      return fail(r);
    }
    pushCheck(checks, "PolicyGrant", "authorizedGateway", "policy", true);
  }

  // --- SECOP 1a: allowedPurposes ---
  const purpose = ctx.purpose ?? ctx.paymentPolicyDecision.purpose;
  if (purpose && ctx.policyGrant.allowedPurposes?.length) {
    if (!ctx.policyGrant.allowedPurposes.includes(purpose)) {
      const r: VerificationResult = { valid: false, reason: "PURPOSE_NOT_ALLOWED", artifact: "policyGrant" };
      pushCheck(checks, "PolicyGrant", "allowedPurposes", "policy", false, {
        reason: r.reason,
        expected: ctx.policyGrant.allowedPurposes,
        actual: purpose,
      });
      return fail(r);
    }
    pushCheck(checks, "PolicyGrant", "allowedPurposes", "policy", true);
  }

  // --- SECOP 4a / 3b: budgetId replay ---
  if (ctx.budgetIdStore) {
    const sba = ctx.signedBudgetAuthorization;
    const budgetId = sba.authorization.budgetId;
    const isNew = ctx.budgetIdStore.markSeen(budgetId);
    const resolved = isNew instanceof Promise ? false : isNew;
    if (!resolved) {
      const r: VerificationResult = { valid: false, reason: "BUDGET_ID_REPLAY", artifact: "signedBudgetAuthorization" };
      pushCheck(checks, "SignedBudgetAuthorization", "budgetIdReplay", "policy", false, { reason: r.reason });
      return fail(r);
    }
    pushCheck(checks, "SignedBudgetAuthorization", "budgetIdReplay", "policy", true);
  }

  // --- SECOP 5a-c: actorId binding ---
  if (ctx.expectedActorId) {
    const sbaActorId = ctx.signedBudgetAuthorization.authorization.actorId;
    if (sbaActorId !== ctx.expectedActorId) {
      const r: VerificationResult = { valid: false, reason: "ACTOR_ID_MISMATCH", artifact: "signedBudgetAuthorization" };
      pushCheck(checks, "SignedBudgetAuthorization", "actorIdBinding", "policy", false, {
        reason: r.reason,
        expected: ctx.expectedActorId,
        actual: sbaActorId,
      });
      return fail(r);
    }
    pushCheck(checks, "SignedBudgetAuthorization", "actorIdBinding", "policy", true);
  }

  // --- SECOP 10a: grant-level budgetMinor ceiling ---
  if (ctx.policyGrant.budgetMinor) {
    const ceiling = BigInt(ctx.policyGrant.budgetMinor);
    const grantSpent = BigInt(ctx.grantCumulativeSpentMinor ?? "0");
    const paymentAmount = ctx.paymentPolicyDecision.priceFiat?.amountMinor
      ? BigInt(ctx.paymentPolicyDecision.priceFiat.amountMinor)
      : 0n;
    if (grantSpent + paymentAmount > ceiling) {
      const r: VerificationResult = { valid: false, reason: "GRANT_BUDGET_EXCEEDED", artifact: "policyGrant" };
      pushCheck(checks, "PolicyGrant", "budgetMinorCeiling", "policy", false, { reason: r.reason });
      return fail(r);
    }
    pushCheck(checks, "PolicyGrant", "budgetMinorCeiling", "policy", true);
  }

  // --- SECOP 1b: grant-level destinationAllowlist ---
  if (ctx.policyGrant.destinationAllowlist?.length) {
    const quoteId = ctx.paymentPolicyDecision.chosen?.quoteId;
    const chosenQuote = quoteId
      ? ctx.paymentPolicyDecision.settlementQuotes?.find((q) => q.quoteId === quoteId)
      : ctx.paymentPolicyDecision.settlementQuotes?.find((q) => q.rail === ctx.paymentPolicyDecision.rail);
    if (chosenQuote && !ctx.policyGrant.destinationAllowlist.includes(chosenQuote.destination)) {
      const r: VerificationResult = { valid: false, reason: "DESTINATION_NOT_ALLOWED", artifact: "policyGrant" };
      pushCheck(checks, "PolicyGrant", "destinationAllowlist", "policy", false, { reason: r.reason });
      return fail(r);
    }
    pushCheck(checks, "PolicyGrant", "destinationAllowlist", "policy", true);
  }

  // --- Budget (linkage + SBA-level checks) ---
  const budgetResult = verifyBudgetAuthorization(
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    { nowMs: ctx.nowMs, cumulativeSpentMinor: ctx.cumulativeSpentMinor, trustBundles: ctx.trustBundles, clockDriftToleranceMs: driftMs },
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
