/**
 * Mock intent anchor for development and testing.
 * Simulates publishing an intent hash without contacting a real ledger.
 */

import type { AnchorOptions, AnchorResult } from "./types.js";

/**
 * Mock anchor: returns a stub proof without publishing to any ledger.
 * Use for development, testing, and demos.
 *
 * @param intentHash - 64-char hex intent hash
 * @param options - Anchor options (rail: "mock")
 * @returns Stub anchor result
 */
export async function mockAnchorIntentHash(
  intentHash: string,
  _options?: AnchorOptions,
): Promise<AnchorResult> {
  return {
    rail: "mock",
    txHash: `mock-${intentHash.slice(0, 16)}`,
    anchoredAt: new Date().toISOString(),
  };
}
