/**
 * Intent anchoring types for PR10.
 * Optional support for publishing intent hashes to distributed ledgers.
 */

/** Supported anchoring rails. */
export type AnchorRail = "hedera-hcs" | "xrpl" | "evm" | "mock" | "xrpl-nft";

/** Result of anchoring an intent hash to a ledger. */
export interface AnchorResult {
  /** Anchoring rail used. */
  rail: AnchorRail;
  /** Transaction hash for tx-based rails (XRPL, EVM). Not used for Hedera HCS. */
  txHash?: string;
  /** Rail-neutral ledger reference (e.g. topicId:sequenceNumber for Hedera). */
  reference?: string;
  /** Hedera HCS: consensus timestamp (ISO 8601). */
  consensusTimestamp?: string;
  /** Hedera HCS topic ID. */
  topicId?: string;
  /** Hedera HCS sequence number. */
  sequenceNumber?: string;
  /** Intent hash that was anchored (for verification). */
  intentHash?: string;
  /** Timestamp when anchor was recorded (ISO 8601). */
  anchoredAt?: string;
}

// ---------------------------------------------------------------------------
// Policy anchoring — PR28
// ---------------------------------------------------------------------------

/**
 * How the policy document is submitted to the ledger.
 *   "hash-only"     — only policyHash on-chain (default; GDPR-safe)
 *   "full-document" — full document in message body; HCS only; caller asserts PII-free
 *   "encrypted"     — AES-256-GCM encrypted; HCS: in message body; XRPL: IPFS + NFT URI
 */
export type PolicyAnchorSubmitMode = "hash-only" | "full-document" | "encrypted";

/** AES-256-GCM encrypted policy document as stored on-chain. */
export interface EncryptedPolicyDocument {
  algorithm: "AES-256-GCM";
  /** Base64-encoded 12-byte IV. */
  iv: string;
  /** Base64-encoded ciphertext (encrypted JSON + 16-byte GCM auth tag appended). */
  ciphertext: string;
}

/** Encryption options for submitMode="encrypted". */
export interface PolicyAnchorEncryptionOptions {
  /** AES-256 raw key: 32-byte Uint8Array or an imported CryptoKey (AES-GCM, encrypt). */
  key: CryptoKey | Uint8Array;
  /** Optional IV (12 bytes). Generated randomly if omitted. */
  iv?: Uint8Array;
}

/**
 * Pluggable IPFS upload interface.
 * Callers inject their own IPFS client (web3.storage, nft.storage, local node, etc.)
 * so the SDK does not bundle a heavy IPFS dependency.
 */
export interface PolicyDocumentIpfsStore {
  /** Upload raw bytes and return the IPFS CID string. */
  upload(data: Uint8Array, filename?: string): Promise<string>;
}

/**
 * Off-chain policy document custody interface.
 * Used by the Service layer (mpcp-policy-authority) as the document custodian
 * when submitMode="hash-only". Auditors retrieve the full document from the
 * Service and verify it against the on-chain policyHash.
 */
export interface PolicyDocumentCustody {
  store(policyHash: string, document: object): Promise<void>;
  retrieve(policyHash: string): Promise<object | null>;
}

/** Result of anchoring a policy document to a ledger. */
export interface PolicyAnchorResult {
  /** Anchoring rail used. */
  rail: AnchorRail;
  /** Rail-neutral reference string suitable for use as PolicyGrant.anchorRef. */
  reference: string; // "hcs:{topicId}:{seq}" | "xrpl:nft:{tokenId}"
  /** Transaction hash, where applicable. */
  txHash?: string;
  /** Timestamp when anchor was recorded (ISO 8601). */
  anchoredAt: string;
  /** SHA-256 of the canonical policy document — always included for verification. */
  policyHash: string;
  /** What was actually submitted to the ledger. */
  submitMode: PolicyAnchorSubmitMode;
  /** IPFS CID of the encrypted document blob (XRPL encrypted mode only). */
  encryptedRef?: string;
}

/** Options for anchoring an intent hash. */
export interface AnchorOptions {
  /** Target rail for anchoring. Omit for mock (default). */
  rail?: AnchorRail;
  /** Optional metadata for the anchor message. */
  metadata?: Record<string, string>;
}
