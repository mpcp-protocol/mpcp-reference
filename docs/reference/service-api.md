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
const result = await anchorPolicyDocument(policyDoc, { rail: "hedera-hcs" });
// result.anchorRef: "hcs:{topicId}:{sequenceNumber}"

// XRPL NFT
const result = await anchorPolicyDocument(policyDoc, { rail: "xrpl-nft" });
// result.anchorRef: "xrpl:nft:{tokenId}"
```

Supported rails: `hedera-hcs`, `xrpl-nft`.

The returned `anchorRef` can be stored on the PolicyGrant (`grant.anchorRef`) to provide on-chain auditability.

---

## See Also

- [Fleet Payments](../implementation/offline-payments.md)
- [SDK Reference](sdk.md)
- [Fleet Payments](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/fleet-payments.md)
- [Dispute Resolution](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/dispute-resolution.md)
