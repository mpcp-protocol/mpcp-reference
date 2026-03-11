/**
 * Hedera HCS (Hashgraph Consensus Service) intent anchor.
 * Publishes intent hashes to a Hedera topic for public auditability.
 *
 * Requires: HEDERA_OPERATOR_ACCOUNT_ID, HEDERA_OPERATOR_PRIVATE_KEY, HEDERA_TOPIC_ID
 * Optional: HEDERA_NETWORK (testnet|mainnet, default: testnet)
 */

import type { AnchorOptions, AnchorResult } from "./types.js";

const HEX_RE = /^[0-9a-fA-F]{64}$/;

function validateIntentHash(intentHash: string): void {
  if (typeof intentHash !== "string" || intentHash.length !== 64 || !HEX_RE.test(intentHash)) {
    throw new Error("intentHash must be a 64-char hex string");
  }
}

/** MPCP anchor message format for HCS topic. */
interface HcsAnchorMessage {
  intentHash: string;
  version: "1.0";
}

/**
 * Anchor an intent hash to Hedera HCS.
 *
 * @param intentHash - 64-char hex intent hash
 * @param options - Anchor options (rail must be "hedera-hcs")
 * @returns Anchor result with topicId, sequenceNumber, anchoredAt
 */
export async function hederaHcsAnchorIntentHash(
  intentHash: string,
  options?: AnchorOptions,
): Promise<AnchorResult> {
  validateIntentHash(intentHash);

  const rail = options?.rail ?? "hedera-hcs";
  if (rail !== "hedera-hcs") {
    throw new Error("hederaHcsAnchorIntentHash only supports rail 'hedera-hcs'");
  }

  const accountId = process.env.HEDERA_OPERATOR_ACCOUNT_ID;
  const privateKeyStr = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
  const topicIdStr = process.env.HEDERA_TOPIC_ID;

  if (!accountId || !privateKeyStr || !topicIdStr) {
    throw new Error(
      "Hedera HCS requires HEDERA_OPERATOR_ACCOUNT_ID, HEDERA_OPERATOR_PRIVATE_KEY, HEDERA_TOPIC_ID",
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

  const network = process.env.HEDERA_NETWORK ?? "testnet";
  const client = Client.forName(network);
  client.setOperator(AccountId.fromString(accountId), PrivateKey.fromString(privateKeyStr));

  const message: HcsAnchorMessage = { intentHash, version: "1.0" };
  const messageBytes = new TextEncoder().encode(JSON.stringify(message));

  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicIdStr))
    .setMessage(messageBytes);

  const txResponse = await tx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  const sequenceNumber = receipt.topicSequenceNumber?.toString();
  const consensusTs = receipt.consensusTimestamp;
  const anchoredAtIso = consensusTs ? new Date(consensusTs.toDate()).toISOString() : undefined;

  client.close();

  return {
    rail: "hedera-hcs",
    topicId: topicIdStr,
    sequenceNumber: sequenceNumber ?? undefined,
    reference: sequenceNumber ? `${topicIdStr}:${sequenceNumber}` : undefined,
    consensusTimestamp: anchoredAtIso,
    intentHash,
    anchoredAt: anchoredAtIso,
  };
}

const MIRROR_TESTNET = "https://testnet.mirrornode.hedera.com";
const MIRROR_MAINNET = "https://mainnet-public.mirrornode.hedera.com";

/**
 * Verify an Hedera HCS anchor by fetching the message from the mirror node.
 *
 * @param anchor - Anchor result with topicId and sequenceNumber
 * @param expectedIntentHash - Intent hash to verify
 * @returns true if anchor exists and intentHash matches
 */
export async function verifyHederaHcsAnchor(
  anchor: { topicId?: string; sequenceNumber?: string },
  expectedIntentHash: string,
): Promise<{ valid: boolean; reason?: string }> {
  if (!anchor.topicId || !anchor.sequenceNumber) {
    return { valid: false, reason: "hedera_hcs_anchor_missing_topic_or_sequence" };
  }

  const network = process.env.HEDERA_NETWORK ?? "testnet";
  const baseUrl = network === "mainnet" ? MIRROR_MAINNET : MIRROR_TESTNET;
  const url = `${baseUrl}/api/v1/topics/${anchor.topicId}/messages/${anchor.sequenceNumber}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `hedera_hcs_fetch_failed: ${msg}` };
  }

  if (!res.ok) {
    return { valid: false, reason: `hedera_hcs_fetch_failed: ${res.status} ${res.statusText}` };
  }

  const data = (await res.json()) as { message?: string };
  const messageB64 = data.message;
  if (!messageB64 || typeof messageB64 !== "string") {
    return { valid: false, reason: "hedera_hcs_message_missing" };
  }

  let messageJson: string;
  try {
    messageJson = Buffer.from(messageB64, "base64").toString("utf-8");
  } catch {
    return { valid: false, reason: "hedera_hcs_message_invalid_base64" };
  }

  let parsed: HcsAnchorMessage;
  try {
    parsed = JSON.parse(messageJson) as HcsAnchorMessage;
  } catch {
    return { valid: false, reason: "hedera_hcs_message_invalid_json" };
  }

  if (parsed.intentHash !== expectedIntentHash) {
    return { valid: false, reason: "intent_hash_mismatch" };
  }

  return { valid: true };
}
