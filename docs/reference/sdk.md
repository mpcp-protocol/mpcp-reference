# SDK Reference

The MPCP SDK provides lower-level artifact creation, hashing, and verification.

For a narrative walkthrough showing how the artifacts connect end-to-end, see [SDK — Implementation Guide](../implementation/sdk.md).

## Install

```bash
npm install mpcp-service
```

## Import

```typescript
import {
  createPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
  createSignedPaymentAuthorization,
  createSettlementIntent,
  computeSettlementIntentHash,
  computeIntentHash,
  canonicalJson,
  verifyPolicyGrant,
  verifySettlement,
  verifySettlementWithReport,
  verifySettlementDetailed,
} from "mpcp-service/sdk";
```

## Policy Grant

```typescript
import { createPolicyGrant } from "mpcp-service/sdk";

const grant = createPolicyGrant({
  policyHash: "a1b2c3",
  allowedRails: ["xrpl", "evm"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: "2030-12-31T23:59:59Z",
});
```

## Budget Authorization

```typescript
import {
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
} from "mpcp-service/sdk";

const budgetAuth = createBudgetAuthorization({
  grantId: grant.grantId,      // from createPolicyGrant
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

// Signed (requires MPCP_SBA_SIGNING_PRIVATE_KEY_PEM — returns null if not set)
const sba = createSignedBudgetAuthorization({
  grantId: budgetAuth.grantId,
  sessionId: budgetAuth.sessionId,
  vehicleId: budgetAuth.vehicleId,
  policyHash: budgetAuth.policyHash,
  currency: budgetAuth.currency,
  maxAmountMinor: budgetAuth.maxAmountMinor,
  allowedRails: budgetAuth.allowedRails,
  allowedAssets: budgetAuth.allowedAssets,
  destinationAllowlist: budgetAuth.destinationAllowlist,
  expiresAt: budgetAuth.expiresAt,
});
```

## Payment Authorization

```typescript
import {
  createSignedPaymentAuthorization,
  createSettlementIntent,
  computeSettlementIntentHash,
} from "mpcp-service/sdk";

const intent = createSettlementIntent({
  rail: "xrpl",
  amount: "1000",
  destination: "rParking",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
});

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
```

Requires `MPCP_SPA_SIGNING_PRIVATE_KEY_PEM`.

## Hashing

```typescript
import { computeSettlementIntentHash, computeIntentHash, canonicalJson } from "mpcp-service/sdk";

const intentHash = computeSettlementIntentHash(intent);
const canonical = canonicalJson({ rail: "xrpl", amount: "1000", destination: "rDest" });
```

## Verification

```typescript
import { verifySettlement, verifySettlementWithReport, verifySettlementDetailed } from "mpcp-service/sdk";

const result = verifySettlement(context);
const { result, steps } = verifySettlementWithReport(context);
const { valid, checks } = verifySettlementDetailed(context);
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| MPCP_SBA_SIGNING_PRIVATE_KEY_PEM | Private key for signing SBAs |
| MPCP_SBA_SIGNING_PUBLIC_KEY_PEM | Public key for verifying SBAs |
| MPCP_SBA_SIGNING_KEY_ID | Key identifier (default: mpcp-sba-signing-key-1) |
| MPCP_SPA_SIGNING_PRIVATE_KEY_PEM | Private key for signing SPAs |
| MPCP_SPA_SIGNING_PUBLIC_KEY_PEM | Public key for verifying SPAs |
| MPCP_SPA_SIGNING_KEY_ID | Key identifier (default: mpcp-spa-signing-key-1) |

## See Also

- [Service API](service-api.md) — Higher-level facade
- [Build a Machine Wallet](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/build-a-machine-wallet.md)
- [Protocol: Artifacts](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/artifacts.md)
