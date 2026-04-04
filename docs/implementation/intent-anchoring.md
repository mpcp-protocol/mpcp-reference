# Policy Anchoring

Optional support for publishing MPCP policy documents to distributed ledgers. Provides public auditability, dispute protection, and tamper-evident policy history.

**Hedera HCS** and **XRPL NFT** adapters support **policy document** anchoring: HCS publishes to a topic; the XRPL path encrypts (optional), stores ciphertext on IPFS, and records the policy via an NFToken whose URI points at that content (`anchorRef` = `xrpl:nft:{tokenId}` with the policy hash in the anchoring flow). Store the returned reference on the PolicyGrant for auditability and dispute resolution.

> **Grant liveness** (revoking or invalidating a grant) is a **separate** mechanism: XRPL **XLS-70** credentials (`CredentialCreate` / `CredentialDelete`). That replaces the older **NFT mint-on-issue / burn-on-revoke** pattern for **grants**. Do not conflate XLS-70 grant credentials with **policy** `anchorRef` on HCS or XRPL NFT.

## Purpose

- **Public auditability** — Policy documents can be verified against a public ledger record
- **Dispute protection** — Timestamped proof that a policy document existed before settlement
- **Tamper evidence** — On-chain record makes retroactive policy modification detectable

## anchorRef Format

The `anchorRef` field on a PolicyGrant identifies the on-chain location of the anchored policy document:

| Format | Rail | Example |
|--------|------|---------|
| `hcs:{topicId}:{seq}` | Hedera HCS | `hcs:0.0.12345:42` |
| `xrpl:nft:{tokenId}` | XRPL NFT (policy document URI) | `xrpl:nft:00080000...` |

## Usage

```typescript
import {
  hederaHcsAnchorPolicyDocument,
  xrplEncryptAndStorePolicyDocument,
  checkXrplNftRevocation,
} from "mpcp-service/anchor";

const policyDoc = { version: "1.0", policyHash: "a1b2c3...", issuedAt: "2026-01-01T00:00:00Z" };

// Hedera HCS (requires MPCP_HCS_POLICY_TOPIC_ID, MPCP_HCS_OPERATOR_ID, MPCP_HCS_OPERATOR_KEY)
const result = await hederaHcsAnchorPolicyDocument(policyDoc);
// { reference: "hcs:0.0.12345:42", rail: "hedera-hcs", anchoredAt: "..." }

// XRPL NFT path: encrypt + IPFS → CID for NFToken URI (`ipfs://{cid}`); mint off-chain / policy authority, then anchorRef = `xrpl:nft:{tokenId}`
// const prep = await xrplEncryptAndStorePolicyDocument(policyDoc, { encryption: {...}, ipfsStore: myStore });

// Optional: verify the policy-anchor NFT still exists on XRPL (policy audit / tamper check).
// This is not grant liveness — use XLS-70 credentials for that (see PolicyGrant).
const nftStatus = await checkXrplNftRevocation("00080000ABCD...");
// { revoked: false } if the anchor NFT still exists; { revoked: true } if burned

// Store the anchor reference on the PolicyGrant (maps to anchorRef on the grant)
const grant = createPolicyGrant({
  policyHash: "a1b2c3",
  allowedRails: ["xrpl"],
  allowedAssets: [...],
  expiresAt: "2030-12-31T23:59:59Z",
  anchorRef: result.reference,
});
```

## PolicyAnchorResult

```typescript
interface PolicyAnchorResult {
  anchorRef: string;         // "hcs:{topicId}:{seq}" | "xrpl:nft:{tokenId}" (SDK field: `reference`)
  rail: AnchorRail;
  txHash?: string;           // Optional ledger record id (implementation-specific)
  topicId?: string;          // Hedera HCS topic ID
  sequenceNumber?: string;   // Hedera HCS sequence number
  anchoredAt?: string;       // ISO 8601
}
```

## Integration

Anchoring is **optional**. MPCP verification does not require an anchor. Anchors are used for:

- Dispute resolution
- Audit trails
- Compliance and attestation

## Hedera HCS Adapter

The Hedera HCS adapter publishes policy documents to a Hedera Consensus Service topic.

**Requirements:**
- `npm install @hashgraph/sdk` (optional peer dependency; install when using Hedera HCS)
- `MPCP_HCS_OPERATOR_ID` — Operator account ID
- `MPCP_HCS_OPERATOR_KEY` — Operator private key (DER or hex)
- `MPCP_HCS_POLICY_TOPIC_ID` — HCS topic ID for policy anchoring
- `HEDERA_NETWORK` (optional) — `testnet` or `mainnet`, default `testnet`

## XRPL NFT Adapter (policy document anchoring)

> **Scope:** This path is for **policy document anchoring** only (tamper-evident policy history on XRPL). **Grant liveness** (revocation) uses **XLS-70 Credentials** — see PolicyGrant and the XRPL profile; do not use NFToken burn as the grant revocation mechanism.

The reference SDK provides `xrplEncryptAndStorePolicyDocument` (in `mpcp-service/anchor`): it encrypts the policy document, uploads the ciphertext via an injected IPFS client, and returns a **CID** intended as the NFToken URI (`ipfs://{cid}`). **NFTokenMint** (and setting `anchorRef` to `xrpl:nft:{tokenId}`) is typically performed by the policy authority service, not inside the lightweight SDK.

**Requirements:**
- Caller-supplied **IPFS store** (`PolicyDocumentIpfsStore`) — no bundled IPFS client
- Encryption options when using encrypted submit mode (`PolicyAnchorEncryptionOptions`)
- XRPL account with NFToken issuance rights for minting the policy anchor NFT

## XRPL Payment Memos

Every XRPL payment submitted via the Trust Gateway includes an `mpcp/grant-id` memo field. This provides a lightweight on-chain audit trail linking each payment to its PolicyGrant — even without a full policy document anchor.
