import type {
  PaymentPolicyDecision,
  SettlementResult,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";
import type { PolicyGrantLike } from "../verifier/types.js";
import type { SettlementVerificationContext } from "../verifier/types.js";

/**
 * JSON artifact bundle format for CLI verification.
 * Alternative to full SettlementVerificationContext — artifacts keyed by type.
 *
 * Optional sbaPublicKeyPem and spaPublicKeyPem make the bundle self-contained:
 * verification can run without env vars when these are present.
 */
export interface SettlementBundle {
  settlement: SettlementResult;
  settlementIntent?: unknown;
  spa: SignedPaymentAuthorization;
  sba: SignedSessionBudgetAuthorization;
  policyGrant: PolicyGrantLike;
  paymentPolicyDecision?: PaymentPolicyDecision;
  /** PEM of SBA signing public key. When present, enables verify without MPCP_SBA_SIGNING_PUBLIC_KEY_PEM env. */
  sbaPublicKeyPem?: string;
  /** PEM of SPA signing public key. When present, enables verify without MPCP_SPA_SIGNING_PUBLIC_KEY_PEM env. */
  spaPublicKeyPem?: string;
}

function isBundleLike(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

/**
 * Detect if parsed JSON is a settlement bundle (artifact-keyed) vs full context.
 */
export function isSettlementBundle(obj: unknown): obj is SettlementBundle {
  if (!isBundleLike(obj)) return false;
  return (
    "settlement" in obj &&
    "spa" in obj &&
    "sba" in obj &&
    "policyGrant" in obj &&
    !("signedBudgetAuthorization" in obj) &&
    !("signedPaymentAuthorization" in obj)
  );
}

/**
 * Build a minimal PaymentPolicyDecision from SPA authorization.
 * Used when bundle omits paymentPolicyDecision.
 */
function decisionFromSpa(spa: SignedPaymentAuthorization): PaymentPolicyDecision {
  const a = spa.authorization;
  const quote = {
    quoteId: a.quoteId,
    rail: a.rail,
    amount: { amount: a.amount, decimals: 6 },
    destination: a.destination ?? "",
    expiresAt: a.expiresAt,
    asset: a.asset,
  };
  return {
    decisionId: a.decisionId,
    policyHash: a.policyHash,
    action: "ALLOW",
    reasons: ["OK"],
    expiresAtISO: a.expiresAt,
    rail: a.rail,
    asset: a.asset,
    chosen: { rail: a.rail, quoteId: a.quoteId },
    settlementQuotes: [quote],
  };
}

/**
 * Convert a settlement bundle to SettlementVerificationContext.
 */
export function bundleToContext(bundle: SettlementBundle): SettlementVerificationContext {
  const decision =
    bundle.paymentPolicyDecision ?? decisionFromSpa(bundle.spa);
  return {
    policyGrant: bundle.policyGrant,
    signedBudgetAuthorization: bundle.sba,
    signedPaymentAuthorization: bundle.spa,
    settlement: bundle.settlement,
    paymentPolicyDecision: decision,
    decisionId: bundle.spa.authorization.decisionId,
    settlementIntent: bundle.settlementIntent ?? (bundle as { intent?: unknown }).intent,
  };
}
