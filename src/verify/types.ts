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

/**
 * Fixed verification order applied across all verifiers:
 * 1. Schema validation
 * 2. Hash validation (intentHash recompute)
 * 3. Artifact linkage (chain references)
 * 4. Budget limits
 * 5. Policy constraints (signatures, expiry, settlement match)
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
