import { createHash } from "node:crypto";

/**
 * Compute SHA256 hash of input string, output as hex.
 * Uses UTF-8 encoding.
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
