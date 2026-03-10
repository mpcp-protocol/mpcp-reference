import { canonicalJson } from "../canonical/canonicalJson.js";
import { sha256Hex } from "../canonical/hash.js";

const MPCP_INTENT_HASH_DOMAIN = "MPCP:SettlementIntent:1.0:";

/**
 * Compute deterministic SHA256 hash of a settlement intent.
 * Per MPCP spec: intentHash = SHA256(domain + canonicalJson(settlementIntent))
 *
 * The verifier MUST recompute from the intent object — never trust intent.intentHash.
 * If the intent includes an intentHash field, it is stripped before hashing (intentHash
 * is the output of this function, not part of the hashed payload).
 *
 * Domain separation ensures the hash cannot collide with other MPCP artifact hashes.
 *
 * @param intent - Settlement intent (object with rail, amount, etc.)
 * @returns 64-char hex string
 */
export function computeSettlementIntentHash(intent: unknown): string {
  let toHash = intent;
  if (
    typeof intent === "object" &&
    intent !== null &&
    !Array.isArray(intent) &&
    "intentHash" in (intent as object)
  ) {
    const { intentHash: _strip, ...rest } = intent as Record<string, unknown>;
    toHash = rest;
  }
  const canonical = canonicalJson(toHash);
  return sha256Hex(`${MPCP_INTENT_HASH_DOMAIN}${canonical}`);
}
