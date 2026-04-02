import type {
  PaymentPolicyDecision,
} from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { PolicyGrantLike } from "../verifier/types.js";
import type { SettlementVerificationContext } from "../verifier/types.js";

/**
 * JSON artifact bundle format for CLI verification.
 * Alternative to full SettlementVerificationContext — artifacts keyed by type.
 *
 * Optional sbaPublicKeyPem makes the bundle self-contained:
 * verification can run without env vars when this is present.
 */
export interface SettlementBundle {
  sba: SignedSessionBudgetAuthorization;
  policyGrant: PolicyGrantLike;
  paymentPolicyDecision?: PaymentPolicyDecision;
  /** PEM of SBA signing public key. When present, enables verify without MPCP_SBA_SIGNING_PUBLIC_KEY_PEM env. */
  sbaPublicKeyPem?: string;
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
    "sba" in obj &&
    "policyGrant" in obj &&
    !("signedBudgetAuthorization" in obj)
  );
}

/**
 * Convert a settlement bundle to SettlementVerificationContext.
 */
export function bundleToContext(bundle: SettlementBundle): SettlementVerificationContext {
  if (!bundle.paymentPolicyDecision) {
    console.warn("[mpcp] Warning: paymentPolicyDecision absent — budget policy evaluation not verified.");
  }
  const decision = bundle.paymentPolicyDecision ?? ({
    decisionId: "unknown",
    policyHash: bundle.sba.authorization.policyHash,
    action: "ALLOW",
    reasons: ["synthesized"] as unknown as import("../policy-core/types.js").PolicyReasonCode[],
    expiresAtISO: bundle.sba.authorization.expiresAt,
    rail: bundle.sba.authorization.allowedRails[0] ?? "xrpl",
    _synthesized: true,
  } as unknown as PaymentPolicyDecision & { _synthesized: true });
  return {
    policyGrant: bundle.policyGrant,
    signedBudgetAuthorization: bundle.sba,
    paymentPolicyDecision: decision,
  };
}
