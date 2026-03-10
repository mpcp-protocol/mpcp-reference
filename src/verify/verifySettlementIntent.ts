import { canonicalJson } from "../canonical/canonicalJson.js";
import { computeSettlementIntentHash } from "../hash/computeSettlementIntentHash.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import type { VerificationResult } from "./types.js";

/**
 * Verify a settlement intent matches the SPA's authorized parameters.
 *
 * Order: 1 schema validation, 2 hash validation (intentHash), 5 policy constraints (field match).
 *
 * Rule: intentHash == SHA256(domain + canonicalJson(intent))
 * The verifier MUST recompute the hash from the intent object — never trust intent.intentHash.
 *
 * @param envelope - SPA envelope (defines authorized params)
 * @param intent - Settlement intent to verify
 * @returns Deterministic result with clear failure reason
 */
export function verifySettlementIntent(
  envelope: unknown,
  intent: unknown,
): VerificationResult {
  // 1. Schema validation
  const spaResult = signedPaymentAuthorizationSchema.safeParse(envelope);
  if (!spaResult.success) {
    const first = spaResult.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? spaResult.error.message}`, artifact: "signedPaymentAuthorization" };
  }
  const intentResult = settlementIntentForVerificationSchema.safeParse(intent);
  if (!intentResult.success) {
    const first = intentResult.error.errors[0];
    const path = first?.path?.length ? first.path.join(".") + ": " : "";
    return { valid: false, reason: `invalid_artifact: ${path}${first?.message ?? intentResult.error.message}`, artifact: "settlementIntent" };
  }
  const auth = spaResult.data.authorization;
  const intentParsed = intentResult.data;

  // 2. Hash validation (intentHash)
  if (auth.intentHash) {
    const computed = computeSettlementIntentHash(intentParsed);
    if (computed !== auth.intentHash) {
      return { valid: false, reason: "intent_hash_mismatch", artifact: "settlementIntent" };
    }
  }

  // 5. Policy constraints (intent fields match SPA)
  if (intentParsed.rail !== auth.rail) {
    return { valid: false, reason: "intent_rail_mismatch", artifact: "settlementIntent" };
  }
  if (intentParsed.amount !== auth.amount) {
    return { valid: false, reason: "intent_amount_mismatch", artifact: "settlementIntent" };
  }
  if (
    intentParsed.destination != null &&
    auth.destination &&
    intentParsed.destination !== auth.destination
  ) {
    return { valid: false, reason: "intent_destination_mismatch", artifact: "settlementIntent" };
  }
  if (intentParsed.asset != null && auth.asset) {
    if (canonicalJson(intentParsed.asset) !== canonicalJson(auth.asset)) {
      return { valid: false, reason: "intent_asset_mismatch", artifact: "settlementIntent" };
    }
  }

  return { valid: true };
}
