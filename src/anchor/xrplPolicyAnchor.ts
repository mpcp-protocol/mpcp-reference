/**
 * XRPL policy document anchor — encrypted mode.
 *
 * Encrypts a policy document and uploads the ciphertext to IPFS.
 * The returned CID is intended as the NFT URI value ("ipfs://{CID}") when
 * minting the XRPL NFToken that backs the PolicyGrant.
 *
 * NFT minting (write side) is handled by mpcp-policy-authority, not here.
 * This adapter is the preparation step: encrypt → store → return CID + metadata.
 *
 * No XRPL SDK dependency — IPFS upload is injected by the caller via PolicyDocumentIpfsStore.
 */

import { createHash } from "node:crypto";
import type {
  PolicyAnchorEncryptionOptions,
  PolicyDocumentIpfsStore,
  EncryptedPolicyDocument,
} from "./types.js";
import { encryptPolicyDocument } from "./encrypt.js";

/** Result of preparing an XRPL-backed encrypted policy anchor. */
export interface XrplPolicyAnchorPreparation {
  /** IPFS CID of the encrypted document blob. Use as NFT URI: "ipfs://{cid}" */
  cid: string;
  /** SHA-256 of the canonical policy document — same value as PolicyGrant.policyHash. */
  policyHash: string;
  /** The encrypted document envelope (for on-chain verification or off-chain storage). */
  encryptedDocument: EncryptedPolicyDocument;
}

/**
 * Encrypt a policy document and upload the ciphertext to IPFS.
 *
 * The caller injects an IPFS store implementation so this adapter
 * does not bundle a heavy IPFS client dependency.
 *
 * @param policyDocument - The policy document object to encrypt and store
 * @param options - Encryption options and IPFS store implementation
 * @returns CID, policyHash, and encrypted document envelope
 *
 * @example
 * const prep = await xrplEncryptAndStorePolicyDocument(policyDoc, {
 *   encryption: { key: aes256Key },
 *   ipfsStore: myIpfsClient,
 * });
 * // mint NFToken with URI = `ipfs://${prep.cid}`
 * // set anchorRef = `xrpl:nft:${mintedTokenId}`
 */
export async function xrplEncryptAndStorePolicyDocument(
  policyDocument: object,
  options: {
    encryption: PolicyAnchorEncryptionOptions;
    ipfsStore: PolicyDocumentIpfsStore;
  },
): Promise<XrplPolicyAnchorPreparation> {
  // Compute policyHash
  const canonicalPolicy = JSON.stringify(policyDocument, Object.keys(policyDocument).sort());
  const policyHash = createHash("sha256").update(canonicalPolicy).digest("hex");

  // Encrypt the policy document
  const encryptedDocument = await encryptPolicyDocument(policyDocument, options.encryption);

  // Serialise the encrypted envelope for IPFS upload
  const payload = new TextEncoder().encode(JSON.stringify(encryptedDocument));

  // Upload to IPFS and get CID
  const cid = await options.ipfsStore.upload(payload, `policy-${policyHash}.json`);

  return { cid, policyHash, encryptedDocument };
}
