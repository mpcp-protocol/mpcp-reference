/**
 * PR11 — Dispute Verification
 *
 * Verifies disputed settlements using the full MPCP chain plus optional ledger anchor.
 */

import type { AnchorResult } from "../anchor/types.js";
import { computeSettlementIntentHash } from "../hash/index.js";
import type { SettlementVerificationContext } from "./types.js";
import { verifySettlement } from "./verifySettlement.js";

const HEDERA_REQUIRES_ASYNC = "hedera_hcs_requires_async_verification";

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
 * Verify a disputed settlement (sync). For hedera-hcs anchors, use verifyDisputedSettlementAsync.
 *
 * 1. Runs standard MPCP settlement verification (policy grant → SBA → SPA → intent).
 * 2. If ledgerAnchor is provided, verifies the anchor is consistent with the settlement intent.
 *
 * For mock anchors: checks txHash format matches intentHash.
 * For hedera-hcs: returns unverified (use async version to verify against mirror node).
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

  if (ledgerAnchor.rail === "hedera-hcs") {
    // Sync path: trust anchor if intentHash is present and matches
    if (ledgerAnchor.intentHash) {
      if (ledgerAnchor.intentHash === intentHash) return { verified: true };
      return { verified: false, reason: "intent_hash_mismatch" };
    }
    // No intentHash in anchor: verifyDisputedSettlementAsync will verify via mirror node
    return {
      verified: false,
      reason: `${HEDERA_REQUIRES_ASYNC}: use verifyDisputedSettlementAsync`,
    };
  }

  return {
    verified: false,
    reason: `anchor_rail_not_supported: ${ledgerAnchor.rail} verification not yet implemented`,
  };
}

/**
 * Verify a disputed settlement (async). Supports hedera-hcs verification via mirror node.
 * When anchor has topicId+sequenceNumber but no intentHash, verifies against mirror node.
 */
export async function verifyDisputedSettlementAsync(
  input: DisputeVerificationInput,
): Promise<DisputeVerificationResult> {
  const syncResult = verifyDisputedSettlement(input);

  const { context, ledgerAnchor } = input;
  const isHederaNeedingMirror =
    ledgerAnchor?.rail === "hedera-hcs" &&
    !ledgerAnchor.intentHash &&
    syncResult.verified === false &&
    syncResult.reason?.startsWith(HEDERA_REQUIRES_ASYNC);

  if (!syncResult.verified && !isHederaNeedingMirror) {
    return syncResult;
  }

  if (!ledgerAnchor || ledgerAnchor.rail !== "hedera-hcs") {
    return syncResult;
  }

  const settlementIntent = context.settlementIntent!;
  const intentHash = computeSettlementIntentHash(settlementIntent);

  const { verifyHederaHcsAnchor } = await import("../anchor/hederaHcsAnchor.js");
  const verifyResult = await verifyHederaHcsAnchor(ledgerAnchor, intentHash);

  if (!verifyResult.valid) {
    return { verified: false, reason: verifyResult.reason ?? "hedera_hcs_verification_failed" };
  }

  return { verified: true };
}
