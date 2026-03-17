# mpcp-reference — Implementation Roadmap

TypeScript reference implementation and canonical protocol SDK for the [Machine Payment Control Protocol (MPCP)](https://mpcp-protocol.github.io/spec/).

Implements: protocol verification engine, artifact schemas, cryptographic signing, on-chain anchoring adapters, golden test vectors, and the full SDK consumed by `mpcp-policy-authority`, `mpcp-wallet-sdk`, and `mpcp-merchant-sdk`.

**Stack:** Node.js 22 + TypeScript (ESM), Vitest, Zod.

---

## Guiding Principles

**Protocol first** — the specification is the source of truth; code conforms to it, not the other way around.

**Determinism** — all artifacts serialize and hash identically across implementations and runtimes.

**Rail agnostic** — no dependency on a specific payment rail or ledger.

**Verifiable** — every payment decision and settlement can be independently verified without contacting a central service.

**Small PRs** — each feature lands in an isolated PR for safe review and easy rollback.

---

## Phase 1 — Protocol Determinism ✓

| PR | Title | Status |
|----|-------|--------|
| PR1 | Canonical serialization (`canonicalJson`, SHA-256) | ✓ |
| PR2 | Artifact schemas (Zod — PolicyGrant, SBA, SPA, SettlementIntent, FleetPolicyAuthorization) | ✓ |
| PR3 | `SettlementIntentHash` implementation | ✓ |

---

## Phase 2 — Verification Engine ✓

| PR | Title | Status |
|----|-------|--------|
| PR4 | Core verifier (`verifyPolicyGrant`, `verifyBudgetAuthorization`, `verifyPaymentAuthorization`, `verifySettlement`) | ✓ |
| PR5 | CLI verifier (`npx mpcp verify settlement.json`) | ✓ |
| PR5A | CLI explain mode (`--explain`, `--json`; `DetailedVerificationReport`) | ✓ |
| PR6 | Protocol conformance tests | ✓ |

---

## Phase 3 — Developer Adoption ✓

| PR | Title | Status |
|----|-------|--------|
| PR7 | SDK helpers (`createPolicyGrant`, `createBudgetAuthorization`, `createSignedPaymentAuthorization`, `createSettlementIntent`, `computeIntentHash`); `policy-core/` evaluation engine (`evaluateEntryPolicy`, `evaluatePaymentPolicy`, `enforcePayment`) | ✓ |
| PR8 | End-to-end parking example + guardrails demo + fleet demo + offline flow | ✓ |
| PR9 | Integration tests — full lifecycle verification | ✓ |

---

## Phase 4 — Protocol Network Effects ✓

| PR | Title | Status |
|----|-------|--------|
| PR10 | Intent anchoring — Hedera HCS, XRPL, EVM, mock adapters | ✓ |
| PR11 | Dispute verification (`verifyDisputedSettlementAsync`) | ✓ |
| PR12 | Fleet operator tooling | ✓ |
| PR12A | Artifact Bundle specification + schema | ✓ |

---

## Phase 5 — External Adoption ✓

| PR | Title | Status |
|----|-------|--------|
| PR13/PR20 | Golden protocol vectors (valid settlement, expired grant, budget exceeded, hash mismatch) | ✓ |
| PR14 | Real ledger anchor adapters (Hedera HCS: `hederaHcsAnchorIntentHash`, `verifyHederaHcsAnchor`) | ✓ |
| PR15 | Reference deployment profiles (fleet-offline, parking, charging, hosted-rail) | ✓ |
| PR16 | Compatibility and versioning policy | ✓ |
| PR17 | Reference service API (`src/service/`) | ✓ |
| PR18 | Protocol documentation site (`docs/`) | ✓ |
| PR19 | Docs site deployment (MkDocs + GitHub Pages CI) | ✓ |

---

## Phase 6 — Adoption Acceleration

| PR | Title | Status |
|----|-------|--------|
| PR21 | Payment profiles expansion (XRPL Stablecoin, RLUSD) | pending |
| PR22 | Layer-1 ecosystem evaluation (XRPL, Hedera, Stellar, EVM) | pending |
| PR23 | Machine wallet guardrails documentation | pending |
| PR24 | Automated fleet payment demo (visual end-to-end) | pending |
| PR25 | MPCP conformance badge | pending |
| PR26 | Human-to-Agent Delegation Profile (`revocationEndpoint`, `allowedPurposes`, TRIP scope, `checkRevocation()`) | ✓ |
| PR27 | On-Chain Policy Anchoring (`anchorRef`, `resolveXrplDid`, `hederaHcsAnchorPolicyDocument`, `checkXrplNftRevocation`) | ✓ |
| PR28 | Encrypted Policy Anchoring (`submitMode`, AES-256-GCM via `crypto.subtle`, `PolicyDocumentCustody`, XRPL IPFS prep) | ✓ |
| PR29 | Trust Bundle — types, signing, verification, and key resolution integration | pending |

---

## PR29 — Trust Bundle

Implement the [Trust Bundle](https://mpcp-protocol.github.io/spec/protocol/trust-bundles/) specification as defined in the MPCP spec.

Trust Bundles are pre-distributed signed documents that package trusted issuer public keys for MPCP verifiers operating without network access at verification time.

### New types (`src/protocol/trustBundle.ts`)

```typescript
export interface TrustBundleIssuerEntry {
  issuer: string;
  keys: JsonWebKey[];
}

export interface TrustBundle {
  version: "1.0";
  bundleId: string;
  bundleIssuer: string;
  bundleKeyId: string;
  category: string;
  geography?: { region?: string; countryCodes?: string[] };
  approvedIssuers: string[];
  issuers: TrustBundleIssuerEntry[];
  expiresAt: string;
  signature: string;
}
```

### New functions

- `signTrustBundle(bundleWithoutSig, privateKeyPem)` — constructs canonical payload (`"MPCP:TrustBundle:1.0:" + canonicalJson(bundle)`), signs with Ed25519 or ECDSA P-256, returns signed bundle
- `verifyTrustBundle(bundle, rootPublicKeyPem)` — verifies the bundle's own signature and expiry before use; returns `{ valid: true }` or `{ valid: false; reason: string }`
- `resolveFromTrustBundle(issuer, issuerKeyId, bundles)` — step-1 key resolution; searches non-expired loaded bundles in descending `expiresAt` order; returns matching JWK or `null`

### Key resolution integration

`verifySignedBudgetAuthorization`, `verifyPolicyGrant`, and related verifiers gain an optional `trustBundles?: TrustBundle[]` parameter. When provided, key resolution checks bundles before falling back to HTTPS well-known and DID resolution (per the 3-step algorithm in the spec).

### Exports

All three functions exported from `src/sdk/index.ts` under the `trust` namespace.

### Tests

- `signTrustBundle` + `verifyTrustBundle` roundtrip
- Expired bundle rejected by `verifyTrustBundle`
- Tampered bundle signature rejected
- `resolveFromTrustBundle` returns correct key from matching non-expired bundle
- `resolveFromTrustBundle` skips expired bundles; falls through to `null`
- `resolveFromTrustBundle` prefers bundle with latest `expiresAt` when multiple match
- `verifySignedBudgetAuthorization` resolves signing key from Trust Bundle when `trustBundles` provided (no env var needed)

### Deliverables

- `src/protocol/trustBundle.ts`
- `src/sdk/index.ts` updated
- `test/protocol/trustBundle.test.ts`

---

## PR21 — Payment Profiles Expansion

Expand reference profiles so MPCP is immediately usable for real payment ecosystems.

Initial focus:
- XRPL Stablecoin Profile — RLUSD / issued-asset payment constraints
- Wallet and verifier expectations for stablecoin settlement

Future candidates: Stellar, Hedera, EVM stablecoin.

Deliverables:
- Profile document(s)
- Example artifact bundles
- Verification guidance per profile

---

## PR22 — Layer-1 Ecosystem Evaluation

Research and document which L1/payment ecosystem to prioritize next for MPCP deployment profiles.

Evaluation criteria: stablecoin support, settlement finality, fees, compliance features, offline/verifier friendliness, developer tooling.

Deliverables:
- Research document comparing candidates
- Recommended next profile target with rationale

---

## PR23 — Machine Wallet Guardrails

Document and demonstrate how MPCP acts as a machine wallet guardrail layer: a machine wallet may not send funds unless the payment satisfies the full PolicyGrant → SBA → SPA constraint chain.

Deliverables:
- Guide describing the guardrail model
- Wallet integration example
- Threat-model notes for overspend and misuse prevention

---

## PR24 — Automated Fleet Payment Demo

Visual end-to-end demonstration of an MPCP-controlled fleet payment (vehicle → parking/charging facility → verifier → settlement).

Deliverables:
- Runnable demo script
- Architecture diagram
- Companion documentation

---

## PR25 — MPCP Conformance Badge

Lightweight conformance process: implementations that pass the golden vectors and required verification checks may claim compatibility.

Deliverables:
- Conformance criteria
- Badge / claim format
- Documentation for external implementers

---

## Deferred

- **Multi-SBA batching** — verify multiple SBAs in a single call (bulk settlement)
- **Streaming payment verification** — incremental spend verification for micropayment streams
- **Push revocation** — WebSocket listener for real-time revocation events
- **EVM stablecoin anchor adapter** — extend intent anchoring to EVM chains
