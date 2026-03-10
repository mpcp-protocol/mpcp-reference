import { canonicalJson } from "../canonical/canonicalJson.js";
import { sha256Hex } from "../canonical/hash.js";

/**
 * Compute deterministic SHA256 hash of a settlement intent.
 * Per MPCP spec: intentHash = SHA256(canonicalJson(settlementIntent))
 *
 * @param intent - Settlement intent (object with rail, amount, etc.)
 * @returns 64-char hex string
 */
export function computeSettlementIntentHash(intent: unknown): string {
  return sha256Hex(canonicalJson(intent));
}
