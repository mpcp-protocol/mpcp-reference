# Service API Reference

Lightweight facade for backend teams. Import from `mpcp-service/service`.

## Import

```typescript
import {
  issueBudget,
  verifySettlementService,
  verifyDispute,
  verifyDisputeAsync,
  anchorIntent,
} from "mpcp-service/service";
```

## issueBudget

Issue a signed budget authorization from a policy grant.

```typescript
const sba = issueBudget({
  policyGrant,
  sessionId: "session-123",
  vehicleId: "vehicle-456",
  maxAmountMinor: "3000",
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
// Sync (mock anchor, or Hedera with intentHash in anchor)
const result = verifyDispute({ context, ledgerAnchor });

// Async (Hedera HCS mirror verification)
const result = await verifyDisputeAsync({ context, ledgerAnchor });
```

---

## anchorIntent

Publish an intent hash to a ledger.

```typescript
// Mock (development)
const anchor = await anchorIntent(intentHash, { rail: "mock" });

// Hedera HCS (requires HEDERA_OPERATOR_ACCOUNT_ID, etc.)
const anchor = await anchorIntent(intentHash, { rail: "hedera-hcs" });
```

Supported rails: `mock`, `hedera-hcs`.

---

## See Also

- [Fleet Payments](../implementation/offline-payments.md)
- [SDK Reference](sdk.md)
- [Fleet Payments](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/fleet-payments.md)
- [Dispute Resolution](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/dispute-resolution.md)
