# SDK — Implementation Guide

The MPCP SDK creates and verifies authorization artifacts. This guide shows how the artifacts fit together as a connected lifecycle.

For the full API reference (all function signatures, parameters, and env vars), see [SDK Reference](../reference/sdk.md).

## Artifact Lifecycle

MPCP authorization flows through two artifact types before reaching the Trust Gateway:

```
PolicyGrant  →  SBA (per-payment budget)  →  Trust Gateway  →  XRPL Settlement
```

Each artifact references the previous via shared fields:

| Field | Carried by | Links to |
|-------|-----------|----------|
| `grantId` | SBA | `PolicyGrant.grantId` |
| `sessionId` | SBA | Session identifier |
| `policyHash` | SBA | `PolicyGrant.policyHash` |
| `anchorRef` | PolicyGrant | On-chain policy document anchor (optional) |

The Trust Gateway verifies the SBA chain and submits the XRPL payment. Every XRPL payment includes an `mpcp/grant-id` memo for on-chain audit trail.

## Full Lifecycle Example

```typescript
import {
  createPolicyGrant,
  createSignedBudgetAuthorization,
} from "mpcp-service/sdk";

// 1. PolicyGrant — fleet policy evaluation result
//    Defines allowed rails, assets, and expiration for this session.
//    Optional anchorRef links to on-chain policy document.
const grant = createPolicyGrant({
  policyHash: "a1b2c3",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: "2030-12-31T23:59:59Z",
  // anchorRef: "hcs:0.0.12345:42",  // optional on-chain anchor
});

// 2. SBA — per-payment spending envelope
//    grantId binds this SBA to the PolicyGrant above.
//    maxAmountMinor is the amount for this specific payment.
//    Returns null if MPCP_SBA_SIGNING_PRIVATE_KEY_PEM is not set.
const sba = createSignedBudgetAuthorization({
  grantId: grant.grantId,
  sessionId: "sess-123",
  actorId: "actor-001",
  policyHash: "a1b2c3",
  currency: "USD",
  maxAmountMinor: "1000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rParking"],
  expiresAt: "2030-12-31T23:59:59Z",
  // Required when the merchant uses Trust Bundle key resolution:
  // issuer: "vehicle:ev-001.fleet.example.com",
});

// 3. Trust Gateway submits the XRPL payment
//    The gateway verifies the SBA chain (PolicyGrant → SBA) then
//    executes the XRPL transaction with mpcp/grant-id memo attached.

// 4. Verify the settlement bundle
import { verifySettlement } from "mpcp-service/sdk";

const result = verifySettlement({
  policyGrant: grant,
  signedBudgetAuthorization: sba,
  settlement: { rail: "xrpl", amount: "1000", destination: "rParking", asset: grant.allowedAssets[0] },
});
// result.valid === true
```

## Actor Roles

In an autonomous deployment, the wallet acts as the session authority and the Trust Gateway handles payment execution:

- **Session authority** — signs the SBA, establishing the per-payment budget envelope
- **Trust Gateway** — mandatory actor that verifies the SBA chain and submits XRPL payments with `mpcp/grant-id` memo

See [Machine Wallet Guardrails](machine-wallet-guardrails.md) for the full guardrail model, threat analysis, and integration checklist.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| MPCP_SBA_SIGNING_PRIVATE_KEY_PEM | Private key for signing SBAs |
| MPCP_SBA_SIGNING_PUBLIC_KEY_PEM | Public key for verifying SBAs |
| MPCP_SBA_SIGNING_KEY_ID | Key identifier (default: `mpcp-sba-signing-key-1`) |

## See Also

- [SDK Reference](../reference/sdk.md) — Full API reference
- [MPCP Reference Flow](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/architecture/reference-flow.md) — End-to-end flow with SDK usage
- [Service API](../reference/service-api.md) — Higher-level facade
- [Build a Machine Wallet](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/build-a-machine-wallet.md)
