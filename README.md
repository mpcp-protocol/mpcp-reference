# MPCP Reference Implementation

**Canonical TypeScript implementation of the Machine Payment Control Protocol (MPCP).**

MPCP defines a policy-bounded authorization pipeline for autonomous and software-initiated payments.
This repository contains the **core protocol SDK** used to issue, verify, and enforce MPCP authorization artifacts.

For the protocol rationale, see [What is MPCP](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/overview/what-is-mpcp.md).

For the full specification, see [mpcp-spec](https://github.com/mpcp-protocol/mpcp-spec).

For developer documentation (guides, examples, reference), see **[docs/](./docs/)**.

---

# Quick Start

```ts
import {
  createPolicyGrant,
  createSignedBudgetAuthorization,
  verifyPolicyGrant,
  verifySettlement,
} from "mpcp-service/sdk";

// 1. Issue a PolicyGrant (Policy Authority)
const grant = createPolicyGrant({
  policyHash: "a1b2c3d4e5f6",
  expiresAt: "2030-12-31T23:59:59Z",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
});

// 2. Create and sign an SBA (machine wallet / AI agent)
// Requires MPCP_SBA_SIGNING_PRIVATE_KEY_PEM env var
const sba = createSignedBudgetAuthorization({
  grantId: grant.grantId,
  sessionId: "sess-123",
  actorId: "agent-1",
  policyHash: "a1b2c3d4e5f6",
  currency: "USD",
  maxAmountMinor: "1500",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rMerchant"],
  expiresAt: "2030-12-31T23:59:59Z",
  // issuer: "vehicle:ev-001.fleet.example.com", // for Trust Bundle key resolution
});

// 3. Verify the chain (merchant / Trust Gateway)
const decision = { /* PaymentPolicyDecision from evaluatePaymentPolicy() */ };
const result = verifySettlement({
  policyGrant: grant,
  signedBudgetAuthorization: sba,
  paymentPolicyDecision: decision,
});
// result.valid === true
```

---

# MPCP Authorization Pipeline

```
PolicyGrant (issued by Policy Authority)
      ↓
SignedBudgetAuthorization / SBA (signed by machine wallet or AI agent)
      ↓
Trust Gateway (verifies chain, enforces budget ceiling, submits XRPL payment)
      ↓
XRPL Settlement (EscrowFinish + mpcp/grant-id memo)
```

Each stage cryptographically constrains the next. The Trust Gateway is the mandatory settlement actor for the XRPL profile — it holds the budget escrow and submits on-chain payments.

---

# MPCP Artifacts

## PolicyGrant

Issued by the Policy Authority. Grants a session permission to spend within a defined budget envelope. Specifies allowed rails, allowed assets, destination constraints, and budget ceiling (`budgetMinor`). Includes a `policyHash` that binds downstream SBAs to the evaluated policy. Optionally includes `revocationEndpoint`, `anchorRef`, and `authorizedGateway`.

## SBA (SignedBudgetAuthorization)

Signed by the machine wallet or AI agent for each payment. Specifies `maxAmountMinor`, allowed rails, allowed assets, and destination allowlist. Cryptographically binds the payment to the grant's `policyHash` and `grantId`. The Trust Gateway verifies the full chain (SBA → PolicyGrant) before submitting to XRPL.

---

# Core SDK Exports

```ts
// Artifact construction
createPolicyGrant, createSignedPolicyGrant, createSignedBudgetAuthorization

// Verification
verifyPolicyGrant, verifySettlement, verifySettlementWithReport, verifySettlementDetailed

// On-chain adapters
resolveXrplDid, hederaHcsAnchorPolicyDocument, checkXrplNftRevocation

// Revocation
checkRevocation

// Trust Bundles (offline key resolution)
signTrustBundle, verifyTrustBundle, resolveFromTrustBundle

// Schemas and canonical JSON hashing
canonicalJson, hashPolicyDocument
```

Import from `mpcp-service/sdk`.

---

# Repository Structure

```
mpcp-reference
 ├── src
 │   ├── anchor/          # On-chain adapters: did:xrpl, HCS, XRPL NFT policy anchoring, XLS-70 credential revocation
 │   ├── hash/            # Canonical JSON serialization and SHA-256 hashing
 │   ├── policy-core/     # Policy evaluation engine and types
 │   ├── protocol/        # Artifact types, schemas, SBA/PolicyGrant signing, Trust Bundles
 │   ├── sdk/             # Public SDK barrel exports
 │   └── verifier/        # PolicyGrant and SBA verifiers
 │
 ├── test
 │   └── vectors/         # Golden protocol test vectors
 ├── docs/                # Developer documentation
 ├── examples/            # Runnable examples (build first)
 ├── package.json
 └── tsconfig.json
```

---

# Building

```
npm install
npm run build
```

# Testing

```
npm test
```

# Running Examples

Build first, then run any example:

```
npm run build
node examples/ev-charging/generate.mjs
node examples/parking/demo-offline.mjs
node examples/human-agent-trip/demo-human-agent-trip.mjs
```

---

# License

MIT
