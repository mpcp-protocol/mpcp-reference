import type {
  PaymentPolicyDecision,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { FleetPolicyAuthorization } from "../protocol/schema/fleetPolicyAuthorization.js";
import type { TrustBundle } from "../protocol/trustBundle.js";
import type { BudgetIdStore } from "./budgetIdStore.js";

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
  anchorRef?: string;
  budgetMinor?: string;
  budgetCurrency?: string;
  budgetEscrowRef?: string;
  authorizedGateway?: string;
  offlineMaxSinglePayment?: string;
  offlineMaxSinglePaymentCurrency?: string;
  offlineMaxCumulativePayment?: string;
  offlineMaxCumulativePaymentCurrency?: string;
  velocityLimit?: { maxPayments: number; windowSeconds: number };
  maxSpend?: { perTxMinor?: string; perSessionMinor?: string; perDayMinor?: string };
  destinationAllowlist?: string[];
  merchantCredentialIssuer?: string;
  merchantCredentialType?: string;
  activeGrantCredentialIssuer?: string;
  gatewayCredentialIssuer?: string;
  gatewayCredentialType?: string;
  subjectCredentialIssuer?: string;
  subjectCredentialType?: string;
  operatorId?: string;
  issuer?: string;
  issuerKeyId?: string;
  signature?: string;
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
  paymentPolicyDecision: PaymentPolicyDecision;
  nowMs?: number;
  /** Running total of minor-unit amounts spent in this session before this payment. */
  cumulativeSpentMinor?: string;
  /** Running total of minor-unit amounts spent against the grant's budgetMinor ceiling.
   *  Trust Gateway tracks this across all sessions for a grantId. */
  grantCumulativeSpentMinor?: string;
  trustBundles?: TrustBundle[];
  /** This gateway's own address (e.g. XRPL r-address) for authorizedGateway check. */
  gatewayAddress?: string;
  /** Payment purpose for allowedPurposes enforcement. */
  purpose?: string;
  /** Expected actorId for actorId binding validation. */
  expectedActorId?: string;
  /** Store for budgetId replay prevention. When provided, verifier rejects duplicate budgetIds. */
  budgetIdStore?: BudgetIdStore;
  /** Clock drift tolerance in milliseconds (default 300000 = 5 min). */
  clockDriftToleranceMs?: number;
  /** Optional FleetPolicyAuthorization artifact for fleet governance. */
  fleetPolicyAuthorization?: FleetPolicyAuthorization;
}
