/**
 * PR11 — Dispute Verification
 *
 * Verifies disputed settlements using the full MPCP chain plus optional ledger anchor.
 */

import type { AnchorResult } from "../anchor/types.js";
import { computeSettlementIntentHash } from "../hash/index.js";
import type { SettlementVerificationContext } from "./types.js";
import { verifySettlement } from "./verifySettlement.js";

export interface DisputeVerificationInput {
  /** Full MPCP verification context (settlement + artifacts). */
  context: SettlementVerificationContext;
  /** Optional ledger anchor. When present, verifies anchor is consistent with intent. */
  ledgerAnchor?: AnchorResult;
}

export type DisputeVerificationResult =
  | { verified: true }
  | { verified: false; reason: string };

/**
 * Verify a disputed settlement.
 *
 * 1. Runs standard MPCP settlement verification (policy grant → SBA → SPA → intent).
 * 2. If ledgerAnchor is provided, verifies the anchor is consistent with the settlement intent.
 *
 * For mock anchors: checks txHash format matches intentHash.
 * For real anchors (future): would verify against ledger.
 *
 * @param input - Settlement context and optional ledger anchor
 * @returns verified or invalid with reason
 */
export function verifyDisputedSettlement(
  input: DisputeVerificationInput,
): DisputeVerificationResult {
  const { context, ledgerAnchor } = input;

  if (ledgerAnchor) {
    const settlementIntent = context.settlementIntent;
    if (!settlementIntent) {
      return {
        verified: false,
        reason: "anchor_provided_but_settlement_intent_missing",
      };
    }
  }

  const settlementResult = verifySettlement(context);
  if (!settlementResult.valid) {
    return {
      verified: false,
      reason: settlementResult.reason ?? "settlement_verification_failed",
    };
  }

  if (!ledgerAnchor) {
    return { verified: true };
  }

  const settlementIntent = context.settlementIntent!;

  const intentHash = computeSettlementIntentHash(settlementIntent);

  if (ledgerAnchor.rail === "mock") {
    const expectedTxHash = `mock-${intentHash.slice(0, 16)}`;
    if (ledgerAnchor.txHash !== expectedTxHash) {
      return {
        verified: false,
        reason: `anchor_mismatch: mock txHash expected ${expectedTxHash}, got ${ledgerAnchor.txHash ?? "undefined"}`,
      };
    }
    return { verified: true };
  }

  return {
    verified: false,
    reason: `anchor_rail_not_supported: ${ledgerAnchor.rail} verification not yet implemented`,
  };
}
