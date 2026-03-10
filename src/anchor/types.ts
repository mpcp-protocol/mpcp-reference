/**
 * Intent anchoring types for PR10.
 * Optional support for publishing intent hashes to distributed ledgers.
 */

/** Supported anchoring rails. */
export type AnchorRail = "hedera-hcs" | "xrpl" | "evm" | "mock";

/** Result of anchoring an intent hash to a ledger. */
export interface AnchorResult {
  /** Anchoring rail used. */
  rail: AnchorRail;
  /** Transaction hash (XRPL, EVM) or consensus timestamp (Hedera). */
  txHash?: string;
  /** Hedera HCS topic ID. */
  topicId?: string;
  /** Hedera HCS sequence number. */
  sequenceNumber?: string;
  /** Timestamp when anchor was recorded (ISO 8601). */
  anchoredAt?: string;
}

/** Options for anchoring an intent hash. */
export interface AnchorOptions {
  /** Target rail for anchoring. */
  rail: AnchorRail;
  /** Optional metadata for the anchor message. */
  metadata?: Record<string, string>;
}
