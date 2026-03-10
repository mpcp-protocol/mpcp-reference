import { canonicalJson } from "../canonical/canonicalJson.js";
import { sha256Hex } from "../canonical/hash.js";

const MPCP_INTENT_HASH_DOMAIN = "MPCP:SettlementIntent:1.0:";

/**
 * Compute deterministic SHA256 hash of a settlement intent.
 * Per MPCP spec: intentHash = SHA256(MPCP_INTENT_HASH_DOMAIN + canonicalJson(settlementIntent))
 *
 * Domain separation ensures the hash cannot collide with other MPCP artifact hashes.
 *
 * @param intent - Settlement intent (object with rail, amount, etc.)
 * @returns 64-char hex string
 */
export function computeSettlementIntentHash(intent: unknown): string {
  const canonical = canonicalJson(intent);
  return sha256Hex(`${MPCP_INTENT_HASH_DOMAIN}${canonical}`);
}
