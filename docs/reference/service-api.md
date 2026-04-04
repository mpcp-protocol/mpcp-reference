# Service API Reference

Lightweight facade for backend teams. Import from `mpcp-service/service`.

## Import

```typescript
import {
  issueBudget,
  verifySettlementService,
  verifyDispute,
  verifyDisputeAsync,
  anchorPolicyDocument,
} from "mpcp-service/service";
```

## issueBudget

Issue a signed budget authorization from a policy grant.

```typescript
const sba = issueBudget({
  policyGrant,
  sessionId: "session-123",
  actorId: "actor-001",
  maxAmountMinor: "1000",
  destinationAllowlist: ["rParking", "rCharging"],
});

if (!sba) {
  // MPCP_SBA_SIGNING_PRIVATE_KEY_PEM not configured
}
```

**Requires:** `MPCP_SBA_SIGNING_PRIVATE_KEY_PEM` (and related env vars).

---

## verifySettlementService

Verify a settlement against the full MPCP chain.

```typescript
const result = verifySettlementService(context);
// result: { valid: true } | { valid: false; reason: string }
```

---

## verifyDispute / verifyDisputeAsync

Verify a disputed settlement with optional ledger anchor.

```typescript
// Sync (in-memory verification against SBA chain)
const result = verifyDispute({ context, ledgerAnchor });

// Async (Hedera HCS mirror verification for policy anchor)
const result = await verifyDisputeAsync({ context, ledgerAnchor });
```

---

## anchorPolicyDocument

Publish a policy document to a ledger and return an `anchorRef` for use in PolicyGrant.

```typescript
// Hedera HCS (requires MPCP_HCS_POLICY_TOPIC_ID, MPCP_HCS_OPERATOR_ID, MPCP_HCS_OPERATOR_KEY)
const hcs = await anchorPolicyDocument(policyDoc, { rail: "hedera-hcs" });
// hcs.anchorRef: "hcs:{topicId}:{sequenceNumber}"

// XRPL NFT — policy document anchoring (encrypted doc → IPFS URI on NFToken; mint completed by policy authority)
const nft = await anchorPolicyDocument(policyDoc, { rail: "xrpl-nft" /* + encryption / ipfs options */ });
// nft.anchorRef: "xrpl:nft:{tokenId}"
```

Supported rails for **policy document** anchoring: **`hedera-hcs`**, **`xrpl-nft`**.

> **Grant liveness** (whether a grant is still valid) is **not** defined by burning the policy anchor NFT. Use **XLS-70** `CredentialCreate` / `CredentialDelete` on XRPL for credential-based grant revocation. Policy `anchorRef` (HCS or XRPL NFT) remains the tamper-evident **policy document** anchor only.

The returned `anchorRef` can be stored on the PolicyGrant (`grant.anchorRef`) to provide on-chain auditability of the **policy document**.

---

## See Also

- [Fleet Payments](../implementation/offline-payments.md)
- [SDK Reference](sdk.md)
- [Fleet Payments](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/fleet-payments.md)
- [Dispute Resolution](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/dispute-resolution.md)
