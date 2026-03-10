import type {
  PaymentPolicyDecision,
  SettlementResult,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";

/** Minimal grant shape for verification */
export interface PolicyGrantLike {
  grantId?: string;
  policyHash: string;
  expiresAt?: string;
  expiresAtISO?: string;
  allowedRails: string[];
  allowedAssets?: unknown[];
}

/** Shared verification result for all verifiers. Use with CLI and callers. */
export type VerificationResult =
  | { valid: true }
  | { valid: false; reason: string; artifact?: string };

/** Single step in verification chain, for CLI and debugging. */
export interface VerificationStep {
  name: string;
  ok: boolean;
  reason?: string;
}

/** Result with per-step breakdown for formatted CLI output. */
export interface VerificationReport {
  result: VerificationResult;
  steps: VerificationStep[];
}

/** Check phase for ordering: schema → linkage → hash → policy */
export type VerificationCheckPhase = "schema" | "linkage" | "hash" | "policy";

/** Single check in a detailed verification report (--explain mode). */
export interface VerificationCheck {
  /** Combined identifier: artifact.check (e.g. SettlementIntent.intentHash) */
  name: string;
  /** Phase for ordering: schema → linkage → hash → policy */
  phase: VerificationCheckPhase;
  /** Artifact type, PascalCase (e.g. SettlementIntent, PolicyGrant). Omitted for synthetic error checks. */
  artifact?: string;
  /** Check type (e.g. schema, valid, intentHash). Omitted for synthetic error checks. */
  check?: string;
  valid: boolean;
  reason?: string;
  expected?: unknown;
  actual?: unknown;
}

/** Detailed report for CLI --explain and --json. */
export interface DetailedVerificationReport {
  valid: boolean;
  checks: VerificationCheck[];
}

/**
 * Check phase ordering for report output: schema → linkage → hash → policy
 */

/** Context for full settlement verification */
export interface SettlementVerificationContext {
  policyGrant: PolicyGrantLike;
  signedBudgetAuthorization: SignedSessionBudgetAuthorization;
  signedPaymentAuthorization: SignedPaymentAuthorization;
  settlement: SettlementResult;
  /** Decision used to create the SPA; required for budget limit verification */
  paymentPolicyDecision: PaymentPolicyDecision;
  settlementIntent?: unknown;
  decisionId: string;
  nowMs?: number;
}
