# Policy Anchoring

Optional support for publishing MPCP policy documents to distributed ledgers. Provides public auditability, dispute protection, and tamper-evident policy history.

**Hedera HCS** adapter is implemented (publish policy document to a topic). **XRPL NFT** adapter is implemented (mint an NFT representing the policy document). Both return an `anchorRef` that is stored on the PolicyGrant.

## Purpose

- **Public auditability** — Policy documents can be verified against a public ledger record
- **Dispute protection** — Timestamped proof that a policy document existed before settlement
- **Tamper evidence** — On-chain record makes retroactive policy modification detectable

## anchorRef Format

The `anchorRef` field on a PolicyGrant identifies the on-chain location of the anchored policy document:

| Format | Rail | Example |
|--------|------|---------|
| `hcs:{topicId}:{seq}` | Hedera HCS | `hcs:0.0.12345:42` |
| `xrpl:nft:{tokenId}` | XRPL NFT | `xrpl:nft:ABC123...` |

## Usage

```typescript
import { hederaHcsAnchorPolicyDocument, checkXrplNftRevocation } from "mpcp-service/anchor";

const policyDoc = { version: "1.0", policyHash: "a1b2c3...", issuedAt: "2026-01-01T00:00:00Z" };

// Hedera HCS (requires MPCP_HCS_POLICY_TOPIC_ID, MPCP_HCS_OPERATOR_ID, MPCP_HCS_OPERATOR_KEY)
const result = await hederaHcsAnchorPolicyDocument(policyDoc);
// { anchorRef: "hcs:0.0.12345:42", rail: "hedera-hcs", anchoredAt: "..." }

// Store the anchorRef on the PolicyGrant
const grant = createPolicyGrant({
  policyHash: "a1b2c3",
  allowedRails: ["xrpl"],
  allowedAssets: [...],
  expiresAt: "2030-12-31T23:59:59Z",
  anchorRef: result.anchorRef,
});
```

## PolicyAnchorResult

```typescript
interface PolicyAnchorResult {
  anchorRef: string;         // "hcs:{topicId}:{seq}" | "xrpl:nft:{tokenId}"
  rail: AnchorRail;
  txHash?: string;           // XRPL transaction hash
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

## XRPL NFT Adapter

The XRPL NFT adapter mints an NFT on the XRP Ledger representing the policy document. The NFT token ID becomes the `anchorRef`.

**Revocation check:** Use `checkXrplNftRevocation(tokenId)` to verify whether the NFT has been burned (which signals policy revocation).

```typescript
import { checkXrplNftRevocation } from "mpcp-service/anchor";

const revoked = await checkXrplNftRevocation("ABC123...");
if (revoked) {
  // Policy has been revoked on-chain
}
```

## XRPL Payment Memos

Every XRPL payment submitted via the Trust Gateway includes an `mpcp/grant-id` memo field. This provides a lightweight on-chain audit trail linking each payment to its PolicyGrant — even without a full policy document anchor.
