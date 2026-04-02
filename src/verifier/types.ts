import type {
  PaymentPolicyDecision,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { TrustBundle } from "../protocol/trustBundle.js";

/** Minimal grant shape for verification */
export interface PolicyGrantLike {
  grantId: string;
  policyHash: string;
  expiresAt?: string;
  expiresAtISO?: string;
  allowedRails: string[];
  allowedAssets?: unknown[];
  revocationEndpoint?: string;
  allowedPurposes?: string[];
  anchorRef?: string; // "hcs:{topicId}:{seq}" | "xrpl:nft:{tokenId}"
  /** Total authorized spend for this grant in minor units (e.g. drops for XRP). PA-signed. */
  budgetMinor?: string;
  /** Currency code for budgetMinor (e.g. "XRP"). Required when budgetMinor is set. */
  budgetCurrency?: string;
  /**
   * On-chain budget escrow reference — proof that budgetMinor is locked on-chain.
   * Format is rail-specific:
   *   XRPL:    "xrpl:escrow:{account}:{sequence}"
   *   (future) "eth:timelock:{contract}:{lockId}"
   * Included in the PA signature, making the escrow commitment tamper-evident.
   */
  budgetEscrowRef?: string;
  /** Address of the only gateway authorized to spend against this grant's escrow. Rail-specific format. PA-signed. */
  authorizedGateway?: string;
  /** PA-signed per-transaction cap for offline merchant acceptance, in minor units (see offlineMaxSinglePaymentCurrency). */
  offlineMaxSinglePayment?: string;
  /** Currency for offlineMaxSinglePayment (e.g. "XRP"). */
  offlineMaxSinglePaymentCurrency?: string;
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
  /** Combined identifier: artifact.check (e.g. PolicyGrant.schema) */
  name: string;
  /** Phase for ordering: schema → linkage → hash → policy */
  phase: VerificationCheckPhase;
  /** Artifact type, PascalCase (e.g. PolicyGrant). Omitted for synthetic error checks. */
  artifact?: string;
  /** Check type (e.g. schema, valid). Omitted for synthetic error checks. */
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
  /** Decision used to create the SBA; required for budget limit verification */
  paymentPolicyDecision: PaymentPolicyDecision;
  nowMs?: number;
  /** Running total of minor-unit amounts spent in this session before this payment.
   *  When provided, budget check becomes: cumulativeSpentMinor + currentAmount <= maxAmountMinor.
   *  Session authority MUST maintain this counter for correct cumulative enforcement. */
  cumulativeSpentMinor?: string;
  /** Pre-verified Trust Bundles for offline key resolution.
   *  When provided, SBA and PolicyGrant signature verification resolves issuer keys
   *  from the bundles before falling back to pre-configured key or HTTPS well-known. */
  trustBundles?: TrustBundle[];
}
