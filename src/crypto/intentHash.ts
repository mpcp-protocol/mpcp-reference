import { createHash } from "node:crypto";
import { canonicalJson } from "./canonicalJson.js";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function computeIntentHash(intent: unknown): string {
  return sha256Hex(canonicalJson(intent));
}
