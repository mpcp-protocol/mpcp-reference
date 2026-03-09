export type {
  VerificationResult,
  MPCPClientConfig,
  GrantRequest,
  BudgetRequest,
  AuthorizeRequest,
  VerifySettlementRequest,
  MPCPError,
} from "./client.js";

export type {
  Rail,
  Asset,
  SettlementResult,
  PaymentPolicyDecision,
  SessionPolicyGrant,
  EnforcementResult,
  Policy,
  Policy as MPCPPolicy,
} from "../policy-core/types.js";

export type { PolicyGrant, SignedBudgetAuthorization } from "../protocol/types.js";
export type { SignedPaymentAuthorization } from "../protocol/spa.js";

/** Intent object for settlement (rail-specific). Use unknown for custom shapes. */
export type SettlementIntent = unknown;
