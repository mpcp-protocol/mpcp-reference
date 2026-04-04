# Dispute Verification

Tooling to verify disputed settlements using the full MPCP chain plus optional policy anchor.

## Purpose

When a settlement is disputed, `verifyDisputedSettlement` validates:

1. **MPCP chain** — PolicyGrant → SignedBudgetAuthorization → Settlement
2. **Policy anchor** (optional) — When provided, verifies the `anchorRef` on the PolicyGrant is consistent with an on-chain record of the policy document

## Usage

```typescript
import { verifyDisputedSettlement } from "mpcp-service";

const result = verifyDisputedSettlement({
  context: settlementVerificationContext,
  // Optional: ledger anchor result from policy document anchoring
  ledgerAnchor: {
    anchorRef: grant.anchorRef,  // e.g. "hcs:0.0.12345:42" or "xrpl:nft:ABC123..."
    rail: "hedera-hcs",
    sequenceNumber: "42",
    topicId: "0.0.12345",
  },
});

if (result.verified) {
  // Settlement and anchor are valid
} else {
  // result.reason describes the failure
}
```

## Inputs

- **context** — Full `SettlementVerificationContext` (settlement, policyGrant, signedBudgetAuthorization, decision)
- **ledgerAnchor** — Optional `PolicyAnchorResult` from policy document anchoring

## Output

- `{ verified: true }` — Settlement chain valid; anchor (if provided) consistent
- `{ verified: false, reason: string }` — Failure with reason

## Failure Reasons

- `settlement_verification_failed` — Standard MPCP chain verification failed
- `anchor_provided_but_anchor_ref_missing` — Anchor provided but PolicyGrant has no `anchorRef`
- `anchor_mismatch` — PolicyGrant `anchorRef` does not match the provided ledger anchor
- `anchor_rail_not_supported` — Anchor rail not available for verification

## Async Verification (Hedera HCS Mirror)

Use `verifyDisputedSettlementAsync` to verify a Hedera HCS anchor by querying the mirror node:

```typescript
const result = await verifyDisputedSettlementAsync({
  context: settlementVerificationContext,
  ledgerAnchor: hcsAnchorResult,
});
```

This fetches the anchored policy document from the Hedera mirror node and confirms it matches the PolicyGrant's `policyHash`.

## XRPL Audit Trail

Even without a policy document anchor, every XRPL payment submitted via the Trust Gateway includes an `mpcp/grant-id` memo. Disputes can reference this memo to confirm the on-chain payment was associated with the correct PolicyGrant.
