import type {
  DetailedVerificationReport,
  SettlementVerificationContext,
  VerificationReport,
  VerificationResult,
} from "./types.js";
import { runVerificationPipeline } from "./verifyPipeline.js";

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
  return runVerificationPipeline(ctx).result;
}

/**
 * Verify settlement and return a per-step report for CLI and debugging.
 * Display order: intent hash (if applicable), payment auth, budget auth, policy grant.
 */
export function verifySettlementWithReport(
  ctx: SettlementVerificationContext,
): VerificationReport {
  const { result, steps } = runVerificationPipeline(ctx);
  return { result, steps };
}

/**
 * Verify settlement and return a detailed report for CLI --explain and --json.
 */
export function verifySettlementDetailed(
  ctx: SettlementVerificationContext,
): DetailedVerificationReport {
  const { result, checks } = runVerificationPipeline(ctx);
  return {
    valid: result.valid,
    checks,
  };
}

/**
 * Safe wrapper for verifySettlement. Catches any thrown exceptions.
 */
export function verifySettlementSafe(
  ctx: SettlementVerificationContext,
): VerificationResult {
  try {
    return verifySettlement(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `verification_error: ${message}` };
  }
}

/**
 * Safe wrapper for verifySettlementWithReport. Catches thrown exceptions.
 */
export function verifySettlementWithReportSafe(
  ctx: SettlementVerificationContext,
): VerificationReport {
  try {
    return verifySettlementWithReport(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: { valid: false, reason: `verification_error: ${message}` },
      steps: [{ name: "Verification.error", ok: false, reason: message }],
    };
  }
}

/**
 * Safe wrapper for verifySettlementDetailed. Catches thrown exceptions.
 */
export function verifySettlementDetailedSafe(
  ctx: SettlementVerificationContext,
): DetailedVerificationReport {
  try {
    return verifySettlementDetailed(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // phase: "policy" by convention for synthetic failures; consider "system" if enum extended
    return {
      valid: false,
      checks: [{ name: "Verification.error", phase: "policy", artifact: "Verification", check: "error", valid: false, reason: message }],
    };
  }
}
