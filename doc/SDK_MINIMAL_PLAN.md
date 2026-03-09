# SDK Minimal Plan

The **root package** (`mpcp-service`) is the SDK. A single source of truth for the SDK scope. Implementation must stay within these bounds.

---

## Goals

1. **Feel easy** — Developers should use MPCP without hand‑rolling fetch calls or digging into protocol internals.
2. **Stay tiny** — Minimal surface area. No bloat.
3. **Clear split** — Service client for API calls; local helpers for protocol logic without the hosted service.
4. **Adoption** — One import, clear API. Adoption matters; ergonomics matter.

---

## Exports

```ts
// Artifact helpers
createSignedSessionBudgetAuthorization
verifySignedSessionBudgetAuthorizationForDecision
createSignedPaymentAuthorization
verifySignedPaymentAuthorizationForSettlement

// Canonical intent
canonicalJson
computeIntentHash

// Policy-only verification (no SPA)
enforcePayment

// Client
MPCPClient

// Types
VerificationResult
MPCPClientConfig
GrantRequest
BudgetRequest
AuthorizeRequest
VerifySettlementRequest
MPCPError
Rail
Asset
SettlementResult
SettlementIntent
PaymentPolicyDecision
SessionPolicyGrant
PolicyGrant
SignedBudgetAuthorization
SignedPaymentAuthorization
EnforcementResult
Policy
```

---

## Client API

`MPCPClient` wraps the MPCP Service HTTP endpoints.

```ts
class MPCPClient {
  constructor(config: { baseUrl: string; apiKey?: string })

  createGrant(input: GrantRequest): Promise<PolicyGrant>
  createBudget(input: BudgetRequest): Promise<SignedBudgetAuthorization>
  createAuthorization(input: AuthorizeRequest): Promise<SignedPaymentAuthorization>
  verifySettlement(input: VerifySettlementRequest): Promise<VerificationResult>
  computeIntentHash(intent: unknown): Promise<{ intentHash: string; canonicalIntent: object }>
}
```

Endpoints: `/grant`, `/budget`, `/authorize`, `/verify-settlement`, `/intent/hash`.

---

## Local Helper API

Pure functions. No network calls.

| Function | Signature |
|----------|-----------|
| `canonicalJson` | `(value: unknown) => string` |
| `computeIntentHash` | `(intent: SettlementIntent) => string` |
| `createSignedSessionBudgetAuthorization` | `(input: SBAInput) => SignedBudgetAuthorization \| null` |
| `verifySignedSessionBudgetAuthorizationForDecision` | `(envelope, input) => { ok } \| { ok: false; reason }` |
| `createSignedPaymentAuthorization` | `(sessionId, decision, options?) => SignedPaymentAuthorization \| null` |
| `verifySignedPaymentAuthorizationForSettlement` | `(envelope, decisionId, settlement, options?) => { ok } \| { ok: false; reason }` |
| `enforcePayment` | `(decision, settlement) => EnforcementResult` |

Local helpers live in `src/sdk/`. No separate npm package.

---

## Example Usage

### With the hosted service

```ts
import { MPCPClient } from "mpcp-service/sdk";

const client = new MPCPClient({
  baseUrl: "https://mpcp.example.com",
  apiKey: process.env.MPCP_API_KEY,
});

const grant = await client.createGrant({ policy, lotId: "LOT-A", railsOffered: ["xrpl"], assetsOffered: [asset] });
const budget = await client.createBudget({ sessionId, vehicleId, grantId: grant.grantId, ... });
const spa = await client.createAuthorization({ sessionId, decision });
const result = await client.verifySettlement({ decisionId, settlement, spa });
const { intentHash, canonicalIntent } = await client.computeIntentHash(intent);
```

### Without the hosted service (local / testing)

```ts
import {
  computeIntentHash,
  canonicalJson,
  createSignedSessionBudgetAuthorization,
  verifySignedSessionBudgetAuthorizationForDecision,
  createSignedPaymentAuthorization,
  verifySignedPaymentAuthorizationForSettlement,
} from "mpcp-service/sdk";

const hash = computeIntentHash(intent);
const canonical = canonicalJson(value);

const sba = createSignedSessionBudgetAuthorization({ ... });  // requires env: MPCP_SBA_SIGNING_*
const spa = createSignedPaymentAuthorization(sessionId, decision);  // requires env: MPCP_SPA_SIGNING_*

const ok = verifySignedSessionBudgetAuthorizationForDecision(sba, { sessionId, decision });
const ok2 = verifySignedPaymentAuthorizationForSettlement(spa, decisionId, settlement);
```

---

## Out of Scope

**Explicitly not in the minimal SDK:**

1. **HTTP service implementation** — The SDK is a client. The service (Express, Hono, etc.) lives in `mpcp-service` or a separate service repo.
2. **Rail-specific intent builders** — e.g. `buildXrplIntent()`. Maybe later; not in MVP.
3. **Retries, backoff, or request middleware** — Plain fetch. No axios, no retry logic.
4. **Streaming / WebSockets** — Request/response only.
5. **Persistence** — No replay protection storage, no DB. Pure functions.
6. **CLI or tooling** — SDK is a library.
7. **Intent attestation / anchoring** — Separate layer (IAL). Not in SDK.
8. **Multi-rail orchestration** — Single-rail flows only. No automatic rail selection.
9. **Schema validation** — Types only. No runtime JSON schema checks.
10. **Documentation generation** — README and this plan only.

---

## Discipline

- New exports require an update to this document.
- If a feature is in “Out of Scope,” it does not go in the SDK without revising this plan first.
- Keep the SDK surface small. Prefer re-exports over new logic.
