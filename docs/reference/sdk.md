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
  canonicalJson,
  verifyPolicyGrant,
  verifySettlement,
  verifySettlementWithReport,
  verifySettlementDetailed,
} from "mpcp-service/sdk";
```

## Policy Grant

```typescript
import { createPolicyGrant, createSignedPolicyGrant } from "mpcp-service/sdk";

const grant = createPolicyGrant({
  policyHash: "a1b2c3d4e5f6",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: "2030-12-31T23:59:59Z",
  // Optional: on-chain anchor reference for this policy document
  // anchorRef: "hcs:0.0.12345:42"
});

// Signed (requires MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM — returns null if not set)
const signedGrant = createSignedPolicyGrant(grant);
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
  actorId: "actor-001",
  policyHash: "a1b2c3",
  currency: "USD",
  maxAmountMinor: "1000",      // amount for this specific payment
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rParking"],
  expiresAt: "2030-12-31T23:59:59Z",
});

// Signed (requires MPCP_SBA_SIGNING_PRIVATE_KEY_PEM — returns null if not set)
const sba = createSignedBudgetAuthorization({
  grantId: budgetAuth.grantId,
  sessionId: budgetAuth.sessionId,
  actorId: budgetAuth.actorId,
  policyHash: budgetAuth.policyHash,
  currency: budgetAuth.currency,
  maxAmountMinor: budgetAuth.maxAmountMinor,
  allowedRails: budgetAuth.allowedRails,
  allowedAssets: budgetAuth.allowedAssets,
  destinationAllowlist: budgetAuth.destinationAllowlist,
  expiresAt: budgetAuth.expiresAt,
  // Required when the merchant uses Trust Bundle key resolution:
  // issuer: "vehicle:ev-001.fleet.example.com",
});
```

## Hashing

```typescript
import { canonicalJson } from "mpcp-service/sdk";

const canonical = canonicalJson({ rail: "xrpl", amount: "1000", destination: "rDest" });
```

## Verification

```typescript
import { verifySettlement, verifySettlementWithReport, verifySettlementDetailed } from "mpcp-service/sdk";

const result = verifySettlement(context);
const { result, steps } = verifySettlementWithReport(context);
const { valid, checks } = verifySettlementDetailed(context);
```

## Trust Bundles

Trust Bundles enable offline key resolution for SBA and PolicyGrant signature verification. They are signed documents that package trusted issuer public keys.

```typescript
import {
  signTrustBundle,
  verifyTrustBundle,
  resolveFromTrustBundle,
} from "mpcp-service/sdk";

// Sign a bundle (Policy Authority)
const bundle = signTrustBundle(unsignedBundle, rootPrivateKeyPem);

// Verify a bundle before use (any verifier)
const check = verifyTrustBundle(bundle, rootPublicKeyPem);
if (!check.valid) throw new Error(check.reason);

// Resolve a key from loaded bundles
const jwk = resolveFromTrustBundle("vehicle:ev-001.fleet.example.com", "key-1", [bundle]);
```

### `issuer` and Trust Bundle key resolution

When the verifier uses Trust Bundles, the SBA envelope must include `issuer` so the verifier can match the signing key. Pass `issuer` when creating the SBA:

```typescript
const sba = createSignedBudgetAuthorization({
  ...budgetFields,
  issuer: "vehicle:ev-001.fleet.example.com",
});
```

The `issuer` field is **optional** when the verifier resolves keys via `MPCP_SBA_SIGNING_PUBLIC_KEY_PEM` or HTTPS well-known.

## Cumulative Budget Enforcement

When performing multiple payments in a session, pass `cumulativeSpentMinor` to the verification context so the budget check accounts for all prior spending:

```typescript
const result = verifySettlement({
  ...context,
  cumulativeSpentMinor: "5000", // total minor-unit amount spent before this payment
});
```

The session authority MUST maintain this counter. The verifier is stateless and will not track prior payments on its own.

## Trust Bundle Verification

Pass `trustBundles` to the verification context for offline key resolution:

```typescript
const result = verifySettlement({
  ...context,
  trustBundles: [verifiedBundle],
});
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| MPCP_SBA_SIGNING_PRIVATE_KEY_PEM | Private key for signing SBAs |
| MPCP_SBA_SIGNING_PUBLIC_KEY_PEM | Public key for verifying SBAs |
| MPCP_SBA_SIGNING_KEY_ID | Key identifier (default: mpcp-sba-signing-key-1) |
| MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM | Private key for signing PolicyGrants |
| MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM | Public key for verifying PolicyGrant signatures (when set, unsigned grants are rejected) |
| MPCP_POLICY_GRANT_SIGNING_KEY_ID | Key identifier (default: mpcp-policy-grant-signing-key-1) |

## See Also

- [Service API](service-api.md) — Higher-level facade
- [Build a Machine Wallet](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/build-a-machine-wallet.md)
- [Protocol: Artifacts](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/artifacts.md)
