# mpcp-reference — Implementation Roadmap

TypeScript reference implementation and canonical protocol SDK for the [Machine Payment Control Protocol (MPCP)](https://github.com/mpcp-protocol/mpcp-spec).

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

## Phase 6 — Adoption Acceleration ✓

| PR | Title | Status |
|----|-------|--------|
| PR21 | Payment profiles expansion (XRPL Stablecoin, RLUSD) | ✓ |
| PR22 | Layer-1 ecosystem evaluation (XRPL, Hedera, Stellar, EVM) | ✓ |
| PR23 | Machine wallet guardrails documentation | ✓ |
| PR24 | Automated fleet payment demo (visual end-to-end) | ✓ |
| PR25 | MPCP conformance badge | ✓ |
| PR26 | Human-to-Agent Delegation Profile (`revocationEndpoint`, `allowedPurposes`, TRIP scope, `checkRevocation()`) | ✓ |
| PR27 | On-Chain Policy Anchoring (`anchorRef`, `resolveXrplDid`, `hederaHcsAnchorPolicyDocument`, `checkXrplNftRevocation`) | ✓ |
| PR28 | Encrypted Policy Anchoring (`submitMode`, AES-256-GCM via `crypto.subtle`, `PolicyDocumentCustody`, XRPL IPFS prep) | ✓ |
| PR29 | Trust Bundle — types, signing, verification, and key resolution integration | ✓ |

---

## PR29 — Trust Bundle

Implement the Trust Bundle specification as defined in the MPCP spec (see `mpcp-spec/docs/protocol/trust-bundles.md`).

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

All three functions flat-exported from `src/sdk/index.ts`, consistent with existing SDK exports (`checkRevocation`, `resolveXrplDid`, etc.).

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

## PR21 — Payment Profiles Expansion ✓

XRPL Stablecoin profile — RLUSD / issued-asset payment constraints, wallet and verifier expectations.

Delivered:
- `docs/implementation/xrpl-stablecoin-profile.md` — full profile doc (asset constraints, policy shape, wallet/verifier expectations, Trust Gateway integration)
- `profiles/xrpl-stablecoin.json` — machine-readable profile definition
- `examples/xrpl-stablecoin/` — example artifact bundle + README
- `docs/implementation/reference-profiles.md` updated with XRPL Stablecoin entry

---

## PR22 — Layer-1 Ecosystem Evaluation ✓

Research document comparing XRPL, Stellar, Hedera, and EVM (L2) against MPCP settlement requirements: stablecoin maturity, budget reservation, finality, fees, identity, offline friendliness, tooling.

Delivered:
- `docs/implementation/l1-ecosystem-evaluation.md` — full comparison matrix and recommendation
- **Recommendation:** Stellar (USDC + Claimable Balances) as next rail; EVM L2 second; Hedera continues as anchoring layer

---

## PR23 — Machine Wallet Guardrails ✓

How MPCP acts as a machine wallet guardrail layer: PolicyGrant constraints, SBA session limits, Trust Gateway verification.

Delivered:
- `docs/implementation/machine-wallet-guardrails.md` — guardrail model, Layer 1/2/3 enforcement, threat model, XRPL memo integration
- `docs/examples/machine-wallet-guardrails.md` — example walkthrough
- `examples/machine-wallet-guardrails/wallet-integration.mjs` — runnable script with allowed/rejected scenarios

---

## PR24 — Automated Fleet Payment Demo ✓

End-to-end fleet payment demonstrations with architecture diagrams and runnable scripts.

Delivered:
- `examples/fleet-trip/` — multi-stop robotaxi demo (toll, charging, parking, tamper detection); `demo-fleet-trip.mjs`
- `examples/machine-commerce/` — fleet spend simulator (`simulate.mjs`), fleet demo (`demo-fleet.mjs`), scenarios + policy JSON
- `docs/examples/fleet.md` — architecture diagram (Vehicle Agent → Verifier → Trust Gateway → XRPL), run instructions, key behaviors

---

## PR25 — MPCP Conformance Badge ✓

Formal conformance tiers (L0–L3), Shields.io badge, `package.json` claim format, implementer checklist.

Delivered:
- `docs/implementation/conformance.md` — expanded with L0 Hash / L1 Structural / L2 Full-chain / L3 Profile tiers; badge format; `package.json` claim schema; per-tier implementer checklist
- Aligns with `mpcp-spec/test-vectors/CONFORMANCE.md` (L0/L1/L2 definitions)

---

## Deferred

- **Multi-SBA batching** — verify multiple SBAs in a single call (bulk settlement)
- **Streaming payment verification** — incremental spend verification for micropayment streams
- **Push revocation** — WebSocket listener for real-time revocation events
- **EVM stablecoin anchor adapter** — extend intent anchoring to EVM chains
