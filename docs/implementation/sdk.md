# SDK — Implementation Guide

The MPCP SDK creates and verifies authorization artifacts. This guide shows how the artifacts fit together as a connected lifecycle.

For the full API reference (all function signatures, parameters, and env vars), see [SDK Reference](../reference/sdk.md).

## Artifact Lifecycle

MPCP authorization flows through three artifact types, each constraining the next:

```
PolicyGrant  →  SBA (session budget)  →  SPA (per-payment)  →  Settlement
```

Each artifact references the previous via shared fields:

| Field | Carried by | Links to |
|-------|-----------|----------|
| `grantId` | SBA | `PolicyGrant.grantId` |
| `sessionId` | SPA | `SBA.authorization.sessionId` |
| `intentHash` | SPA | `computeSettlementIntentHash(intent)` |

## Full Lifecycle Example

```typescript
import {
  createPolicyGrant,
  createSignedBudgetAuthorization,
  createSettlementIntent,
  createSignedPaymentAuthorization,
  computeSettlementIntentHash,
} from "mpcp-service/sdk";

// 1. PolicyGrant — fleet policy evaluation result
//    Defines allowed rails, assets, and expiration for this session.
const grant = createPolicyGrant({
  policyHash: "a1b2c3",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: "2030-12-31T23:59:59Z",
});

// 2. SBA — session spending envelope
//    grantId binds this SBA to the PolicyGrant above.
//    Returns null if MPCP_SBA_SIGNING_PRIVATE_KEY_PEM is not set.
const sba = createSignedBudgetAuthorization({
  grantId: grant.grantId,
  sessionId: "sess-123",
  vehicleId: "veh-456",
  policyHash: "a1b2c3",
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rParking"],
  expiresAt: "2030-12-31T23:59:59Z",
});

// 3. SettlementIntent — canonical representation of the payment
const intent = createSettlementIntent({
  rail: "xrpl",
  amount: "1000",
  destination: "rParking",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
});

// 4. SPA — per-payment authorization
//    sessionId matches SBA. intentHash binds SPA to the specific settlement.
//    Returns null if MPCP_SPA_SIGNING_PRIVATE_KEY_PEM is not set.
const spa = createSignedPaymentAuthorization({
  decisionId: "dec-789",
  sessionId: "sess-123",
  policyHash: "a1b2c3",
  quoteId: "quote-17",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  amount: "1000",
  destination: "rParking",
  intentHash: computeSettlementIntentHash(intent),
  expiresAt: "2030-12-31T23:59:59Z",
});

// 5. Verify the settlement bundle
import { verifySettlement } from "mpcp-service/sdk";

const result = verifySettlement({
  policyGrant: grant,
  signedBudgetAuthorization: sba,
  signedPaymentAuthorization: spa,
  settlementIntent: intent,
  settlement: { rail: "xrpl", amount: "1000", destination: "rParking", asset: intent.asset },
});
// result.valid === true
```

## Vehicle Wallet Roles

In an autonomous deployment, the wallet plays both roles in this lifecycle:

- **Session authority** — signs the SBA, establishing the session budget
- **Payment decision service** — evaluates each payment request and signs the SPA locally

See [Machine Wallet Guardrails](machine-wallet-guardrails.md) for the full guardrail model, threat analysis, and integration checklist.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| MPCP_SBA_SIGNING_PRIVATE_KEY_PEM | Private key for signing SBAs |
| MPCP_SBA_SIGNING_PUBLIC_KEY_PEM | Public key for verifying SBAs |
| MPCP_SBA_SIGNING_KEY_ID | Key identifier (default: `mpcp-sba-signing-key-1`) |
| MPCP_SPA_SIGNING_PRIVATE_KEY_PEM | Private key for signing SPAs |
| MPCP_SPA_SIGNING_PUBLIC_KEY_PEM | Public key for verifying SPAs |
| MPCP_SPA_SIGNING_KEY_ID | Key identifier (default: `mpcp-spa-signing-key-1`) |

## See Also

- [SDK Reference](../reference/sdk.md) — Full API reference
- [MPCP Reference Flow](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/architecture/reference-flow.md) — End-to-end flow with SDK usage
- [Service API](../reference/service-api.md) — Higher-level facade
- [Build a Machine Wallet](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/build-a-machine-wallet.md)
