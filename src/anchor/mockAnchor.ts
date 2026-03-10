/**
 * Mock intent anchor for development and testing.
 * Simulates publishing an intent hash without contacting a real ledger.
 */

import type { AnchorOptions, AnchorResult } from "./types.js";

const HEX_RE = /^[0-9a-fA-F]{64}$/;

function validateIntentHash(intentHash: string): void {
  if (typeof intentHash !== "string") {
    throw new Error("intentHash must be a string");
  }
  if (intentHash.length !== 64) {
    throw new Error(`intentHash must be 64 hex chars, got ${intentHash.length}`);
  }
  if (!HEX_RE.test(intentHash)) {
    throw new Error("intentHash must contain only hex characters [0-9a-fA-F]");
  }
}

/**
 * Mock anchor: returns a stub proof without publishing to any ledger.
 * Use for development, testing, and demos.
 *
 * Only supports rail "mock". Passing other rails throws.
 *
 * @param intentHash - 64-char hex intent hash
 * @param options - Anchor options (rail must be "mock" or omitted)
 * @returns Stub anchor result
 */
export async function mockAnchorIntentHash(
  intentHash: string,
  options?: AnchorOptions,
): Promise<AnchorResult> {
  validateIntentHash(intentHash);

  const rail = options?.rail ?? "mock";
  if (rail !== "mock") {
    throw new Error("mockAnchorIntentHash only supports rail 'mock', not real ledger rails");
  }

  return {
    rail: "mock",
    txHash: `mock-${intentHash.slice(0, 16)}`,
    anchoredAt: new Date().toISOString(),
  };
}
