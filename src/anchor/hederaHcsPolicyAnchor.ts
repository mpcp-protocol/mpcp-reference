/**
 * Hedera HCS policy document anchor.
 * Publishes a PolicyGrant's policy document (or its hash) to a Hedera HCS topic
 * for tamper-evident, third-party-auditable policy trails.
 *
 * Default submitMode is "hash-only" — only the policyHash is published.
 * This is GDPR-safe and sufficient for most audit use cases.
 *
 * Environment variables:
 *   MPCP_HCS_POLICY_TOPIC_ID   — Target HCS topic for policy anchoring
 *   MPCP_HCS_OPERATOR_ID       — Hedera operator account ID
 *   MPCP_HCS_OPERATOR_KEY      — Hedera operator private key
 *   HEDERA_NETWORK             — testnet | mainnet (default: testnet)
 */

import { createHash } from "node:crypto";
import type {
  PolicyAnchorResult,
  PolicyAnchorSubmitMode,
  PolicyAnchorEncryptionOptions,
} from "./types.js";
import { encryptPolicyDocument } from "./encrypt.js";

// ---------------------------------------------------------------------------
// HCS message shapes
// ---------------------------------------------------------------------------

interface HcsPolicyAnchorMessageBase {
  type: "MPCP:PolicyAnchor:1.0";
  policyHash: string;
  anchoredAt: string;
}

interface HcsHashOnlyMessage extends HcsPolicyAnchorMessageBase {
  submitMode: "hash-only";
}

interface HcsFullDocumentMessage extends HcsPolicyAnchorMessageBase {
  submitMode: "full-document";
  policyDocument: object;
}

interface HcsEncryptedMessage extends HcsPolicyAnchorMessageBase {
  submitMode: "encrypted";
  encryptedDocument: {
    algorithm: "AES-256-GCM";
    iv: string;
    ciphertext: string;
  };
}

type HcsPolicyAnchorMessage =
  | HcsHashOnlyMessage
  | HcsFullDocumentMessage
  | HcsEncryptedMessage;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Anchor a policy document to Hedera HCS.
 *
 * @param policyDocument - The policy document object to anchor
 * @param options - submitMode (default "hash-only"), encryption, and HCS credentials
 * @returns PolicyAnchorResult with anchorRef "hcs:{topicId}:{sequenceNumber}"
 */
export async function hederaHcsAnchorPolicyDocument(
  policyDocument: object,
  options?: {
    topicId?: string;
    operatorId?: string;
    operatorKey?: string;
    submitMode?: PolicyAnchorSubmitMode;
    encryption?: PolicyAnchorEncryptionOptions;
  },
): Promise<PolicyAnchorResult> {
  const submitMode: PolicyAnchorSubmitMode = options?.submitMode ?? "hash-only";

  if (submitMode === "encrypted" && !options?.encryption) {
    throw new Error(
      "hederaHcsAnchorPolicyDocument: encryption options required when submitMode is 'encrypted'",
    );
  }

  const accountId = options?.operatorId ?? process.env.MPCP_HCS_OPERATOR_ID;
  const privateKeyStr = options?.operatorKey ?? process.env.MPCP_HCS_OPERATOR_KEY;
  const topicIdStr = options?.topicId ?? process.env.MPCP_HCS_POLICY_TOPIC_ID;

  if (!accountId || !privateKeyStr || !topicIdStr) {
    throw new Error(
      "HCS policy anchor requires MPCP_HCS_OPERATOR_ID, MPCP_HCS_OPERATOR_KEY, MPCP_HCS_POLICY_TOPIC_ID",
    );
  }

  let sdk: typeof import("@hashgraph/sdk");
  try {
    sdk = await import("@hashgraph/sdk");
  } catch {
    throw new Error(
      "Hedera HCS requires @hashgraph/sdk. Install with: npm install @hashgraph/sdk",
    );
  }
  const { Client, TopicMessageSubmitTransaction, PrivateKey, AccountId, TopicId } = sdk;

  // Compute SHA-256 of canonical policy document
  const canonicalPolicy = JSON.stringify(policyDocument, Object.keys(policyDocument).sort());
  const policyHash = createHash("sha256").update(canonicalPolicy).digest("hex");

  const anchoredAt = new Date().toISOString();

  // Build message body based on submitMode
  let message: HcsPolicyAnchorMessage;

  if (submitMode === "hash-only") {
    message = { type: "MPCP:PolicyAnchor:1.0", policyHash, anchoredAt, submitMode };
  } else if (submitMode === "full-document") {
    message = {
      type: "MPCP:PolicyAnchor:1.0",
      policyHash,
      anchoredAt,
      submitMode,
      policyDocument,
    };
  } else {
    // encrypted
    const encryptedDocument = await encryptPolicyDocument(policyDocument, options!.encryption!);
    message = {
      type: "MPCP:PolicyAnchor:1.0",
      policyHash,
      anchoredAt,
      submitMode,
      encryptedDocument,
    };
  }

  const messageBytes = new TextEncoder().encode(JSON.stringify(message));

  const network = process.env.HEDERA_NETWORK ?? "testnet";
  const client = Client.forName(network);
  client.setOperator(AccountId.fromString(accountId), PrivateKey.fromString(privateKeyStr));

  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicIdStr))
    .setMessage(messageBytes);

  const txResponse = await tx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  const sequenceNumber = receipt.topicSequenceNumber?.toString();
  const consensusTs = receipt.consensusTimestamp;
  const anchoredAtIso = consensusTs ? new Date(consensusTs.toDate()).toISOString() : anchoredAt;

  client.close();

  return {
    rail: "hedera-hcs",
    reference: `hcs:${topicIdStr}:${sequenceNumber ?? "unknown"}`,
    anchoredAt: anchoredAtIso,
    policyHash,
    submitMode,
  };
}
