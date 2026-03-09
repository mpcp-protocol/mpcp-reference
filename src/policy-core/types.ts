/**
 * Policy schema and boundaries for MPCP policy core.
 * Pure types only - no DB, Express, or chain clients.
 */

export type Rail = "xrpl" | "evm" | "stripe" | "hosted";

export type Asset =
  | { kind: "XRP" }
  | { kind: "IOU"; currency: string; issuer: string }
  | { kind: "ERC20"; chainId: number; token: string };

/** ISO 4217 currency code (e.g. "USD", "EUR"). */
export type ISO4217 = string;

/** Semantic version of the policy schema. */
export const POLICY_SCHEMA_VERSION = 1 as const;
export type PolicySchemaVersion = typeof POLICY_SCHEMA_VERSION;

/** Layer at which a policy applies; precedence: platform < owner < vehicle < lot. */
export type PolicyLayer = "platform" | "owner" | "vehicle" | "lot";

/** Deny / approval reason codes (auditable). */
export type PolicyReasonCode =
  | "OK"
  | "LOT_NOT_ALLOWED"
  | "VENDOR_NOT_ALLOWED"
  | "GEO_NOT_ALLOWED"
  | "ASSET_NOT_ALLOWED"
  | "RAIL_NOT_ALLOWED"
  | "QUOTE_NOT_FOUND"
  | "QUOTE_AMOUNT_MISMATCH"
  | "DESTINATION_MISMATCH"
  | "DECISION_NOT_FOUND"
  | "PAYMENT_AUTH_INVALID_SIGNATURE"
  | "PAYMENT_AUTH_EXPIRED"
  | "PAYMENT_AUTH_MISMATCH"
  | "POLICY_HASH_MISMATCH"
  | "CAP_EXCEEDED_TX"
  | "CAP_EXCEEDED_SESSION"
  | "CAP_EXCEEDED_DAY"
  | "PRICE_SPIKE"
  | "RISK_HIGH"
  | "NEEDS_APPROVAL"
  | "GRANT_EXPIRED";

export type PolicyDecisionAction = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

/** Geo circle for allowlist. */
export interface GeoCircle {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface FiatMoneyMinor {
  amountMinor: string;
  currency: ISO4217;
}

export interface AtomicAmount {
  amount: string;
  decimals: number;
}

export type AssetAtomic = AtomicAmount;

export interface FxSnapshot {
  baseCurrency: ISO4217;
  quoteAssetSymbol: string;
  rate: string;
  asOf: string;
  provider?: string;
}

export interface SettlementQuote {
  quoteId: string;
  rail: Rail;
  asset?: Asset;
  amount: AtomicAmount;
  destination: string;
  expiresAt: string;
  fx?: FxSnapshot;
}

/** @deprecated Prefer FiatMoneyMinor for fiat; AtomicAmount for on-chain. */
export interface MoneyMinor {
  amountMinor: string;
  currencyId: string;
  currency?: string;
}

export interface Policy {
  version: PolicySchemaVersion;
  lotAllowlist?: string[];
  operatorAllowlist?: string[];
  vendorAllowlist?: string[];
  geoAllowlist?: GeoCircle[];
  railAllowlist?: Rail[];
  assetAllowlist?: Asset[];
  capPerTxMinor?: string;
  capPerSessionMinor?: string;
  capPerDayMinor?: string;
  requireApprovalOverMinor?: string;
}

export interface PolicyStack {
  platform: Policy;
  owner?: Policy;
  vehicle?: Policy;
  lot?: Policy;
}

export interface EntryPolicyContext {
  policy: Policy;
  vehicleId?: string;
  lotId: string;
  operatorId?: string;
  nowISO: string;
  railsOffered: Rail[];
  assetsOffered: Asset[];
  geo?: { lat: number; lng: number };
  riskScore?: number;
}

export interface SessionPolicyGrant {
  grantAction: PolicyDecisionAction;
  grantId: string;
  policyHash: string;
  allowedRails: Rail[];
  allowedAssets: Asset[];
  capsFiatMinor?: {
    perTx?: FiatMoneyMinor;
    perSession?: FiatMoneyMinor;
    perDay?: FiatMoneyMinor;
  };
  maxSpend?: { perTxMinor?: string; perSessionMinor?: string; perDayMinor?: string };
  expiresAtISO: string;
  vehicleId?: string;
  lotId: string;
  operatorId?: string;
  reasons: PolicyReasonCode[];
  requireApproval?: boolean;
}

export interface PaymentPolicyContext {
  policy: Policy;
  vehicleId?: string;
  lotId: string;
  operatorId?: string;
  nowISO: string;
  grantExpiresAtISO?: string;
  grantReasons?: PolicyReasonCode[];
  priceFiat?: FiatMoneyMinor;
  spendTotalsFiat?: { dayTotal: FiatMoneyMinor; sessionTotal: FiatMoneyMinor };
  railsOffered: Rail[];
  assetsOffered: Asset[];
  riskScore?: number;
  sessionGrantId?: string;
  quote?: MoneyMinor;
  spend?: { dayTotalMinor: string; sessionTotalMinor: string };
}

export interface PaymentPolicyDecision {
  action: PolicyDecisionAction;
  rail?: Rail;
  asset?: Asset;
  reasons: PolicyReasonCode[];
  expiresAtISO: string;
  decisionId: string;
  policyHash: string;
  sessionGrantId?: string | null;
  grantId?: string | null;
  priceFiat?: FiatMoneyMinor;
  settlementQuotes?: SettlementQuote[];
  chosen?: { rail: Rail; quoteId: string };
  createdAt?: string;
  maxSpend?: { perTxMinor?: string; perSessionMinor?: string; perDayMinor?: string };
}

export interface SettlementResult {
  amount: string;
  asset: Asset;
  rail: Rail;
  txHash?: string;
  payer?: string;
  destination?: string;
  quoteId?: string;
  expectedSessionGrantId?: string | null;
  expectedPolicyHash?: string;
  nowISO?: string;
}

export type EnforcementResult = { allowed: true } | { allowed: false; reason: PolicyReasonCode };

// Legacy aliases for backward compatibility
export type PolicyContext = PaymentPolicyContext;
export type PolicyDecision = PaymentPolicyDecision;
