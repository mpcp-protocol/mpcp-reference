# Dispute Verification (PR11)

Tooling to verify disputed settlements using the full MPCP chain plus optional ledger anchor.

## Purpose

When a settlement is disputed, `verifyDisputedSettlement` validates:

1. **MPCP chain** — PolicyGrant → SignedBudgetAuthorization → SignedPaymentAuthorization → SettlementIntent
2. **Ledger anchor** (optional) — When provided, verifies the anchor is consistent with the settlement intent

## Usage

```typescript
import { verifyDisputedSettlement, mockAnchorIntentHash } from "mpcp-service";
import { computeSettlementIntentHash } from "mpcp-service";

const result = verifyDisputedSettlement({
  context: settlementVerificationContext,
  ledgerAnchor: await mockAnchorIntentHash(computeSettlementIntentHash(intent)),
});

if (result.verified) {
  // Settlement and anchor are valid
} else {
  // result.reason describes the failure
}
```

## Inputs

- **context** — Full `SettlementVerificationContext` (settlement, artifacts, policy grant, SBA, SPA, decision, settlement intent)
- **ledgerAnchor** — Optional `AnchorResult` from intent anchoring (PR10)

## Output

- `{ verified: true }` — Settlement chain valid; anchor (if provided) consistent
- `{ verified: false, reason: string }` — Failure with reason

## Failure Reasons

- `settlement_verification_failed` — Standard MPCP chain verification failed
- `anchor_provided_but_settlement_intent_missing` — Anchor provided but context has no settlement intent
- `anchor_mismatch: ...` — Mock anchor txHash does not match intent hash
- `anchor_rail_not_supported: ...` — Real ledger anchor verification not yet implemented

## Mock Anchor

Only mock anchors are supported. Real ledger verification (Hedera HCS, XRPL, EVM) is future work.
