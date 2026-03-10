import { canonicalJson } from "../canonical/canonicalJson.js";
import { sha256Hex } from "../canonical/hash.js";

export function computeIntentHash(intent: unknown): string {
  return sha256Hex(canonicalJson(intent));
}
