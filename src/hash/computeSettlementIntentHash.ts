import { canonicalJson } from "./canonicalJson.js";
import { sha256Hex } from "./sha256.js";

const MPCP_INTENT_HASH_DOMAIN = "MPCP:SettlementIntent:1.0:";

/**
 * Fields excluded from canonical hashing. Metadata fields MUST NOT affect the hash
 * so that semantically identical intents produce the same hash across implementations.
 * See doc/protocol/SettlementIntentHash.md and SettlementIntent.md.
 */
const METADATA_FIELDS_EXCLUDED_FROM_HASH = new Set(["intentHash", "createdAt"]);

function toCanonicalPayload(intent: unknown): unknown {
  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
    return intent;
  }
  const obj = intent as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!METADATA_FIELDS_EXCLUDED_FROM_HASH.has(k) && v !== undefined && v !== null) {
      filtered[k] = v;
    }
  }
  return filtered;
}

/**
 * Compute deterministic SHA256 hash of a settlement intent.
 * Per MPCP spec: intentHash = SHA256(domain + canonicalJson(canonicalPayload))
 *
 * Canonical payload: only semantic fields (version, rail, amount, destination, asset,
 * referenceId). Metadata fields (intentHash, createdAt) are excluded.
 *
 * The verifier MUST recompute from the intent object — never trust intent.intentHash.
 *
 * @param intent - Settlement intent (object with rail, amount, etc.)
 * @returns 64-char hex string
 */
export function computeSettlementIntentHash(intent: unknown): string {
  const payload = toCanonicalPayload(intent);
  const canonical = canonicalJson(payload);
  return sha256Hex(`${MPCP_INTENT_HASH_DOMAIN}${canonical}`);
}
