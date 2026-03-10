

# MPCP Implementation Roadmap

This document defines the implementation plan for the **Machine Payment Control Protocol (MPCP)** reference implementation.

The goal of this roadmap is to evolve MPCP from a **specification and prototype** into a **deterministic, verifiable, production‑ready protocol stack**.

The roadmap is divided into phases. Each phase is intended to be implemented through **small focused PRs** to keep review scope manageable.

---

# Guiding Principles

The implementation roadmap follows several principles:

**Protocol first**  
The protocol specification remains the source of truth. Code must conform to the protocol definitions.

**Determinism**  
All MPCP artifacts must serialize and hash deterministically across implementations.

**Rail agnostic**  
MPCP must remain independent of any specific payment rail.

**Verifiable**  
Every payment decision and settlement must be independently verifiable.

**Small PRs**  
Each feature is implemented in isolated PRs to ensure safe review and easy rollback.

---

# Phase 1 — Protocol Determinism

Goal: Ensure MPCP artifacts produce **deterministic hashes and serialization**.

This phase establishes the foundation required for:

- SettlementIntentHash
- cross‑implementation verification
- distributed anchoring

---

## PR 1 — Canonical Serialization

Create a deterministic JSON canonicalization implementation.

Directory:

src/canonical/

Files:

- canonicalJson.ts
- hash.ts

Responsibilities:

- stable key ordering
- UTF‑8 encoding
- whitespace removal
- deterministic serialization

Example flow:

SettlementIntent

→ canonical JSON

→ SHA256

→ SettlementIntentHash

Acceptance Criteria:

- identical hash across multiple runs
- identical hash across Node versions
- deterministic ordering verified in tests

Tests:

- canonical serialization snapshot tests
- hash stability tests

---

## PR 2 — Artifact Schemas

Define strict schemas for all MPCP artifacts.

Directory:

src/schema/

Schemas:

- PolicyGrant
- BudgetAuthorization
- SignedBudgetAuthorization
- SignedPaymentAuthorization
- SettlementIntent
- FleetPolicyAuthorization

Recommended tooling:

- zod

Responsibilities:

- validate artifact structure
- enforce required fields
- prevent malformed artifacts

Acceptance Criteria:

- all artifacts validate through schema
- invalid artifacts rejected with clear errors

---

## PR 3 — SettlementIntentHash Implementation

Implement deterministic hashing of settlement intents.

Directory:

src/hash/

Functions:

computeSettlementIntentHash(intent)

Responsibilities:

- canonicalize intent
- compute SHA256
- produce deterministic intentHash

Acceptance Criteria:

- identical hash across identical intents
- mismatch detected if any field changes

Tests:

- intent mutation tests
- hash equality tests

---

# Phase 2 — Verification Engine

Goal: Implement a complete **MPCP verification engine**.

The verifier confirms that a settlement is valid according to all prior protocol artifacts.

---

## PR 4 — Core Verifier

Directory:

src/verify/

Functions:

- verifyPolicyGrant()
- verifyBudgetAuthorization()
- verifyPaymentAuthorization()
- verifySettlementIntent()
- verifySettlement()

Responsibilities:

Verify that:

- artifacts form a valid chain
- spending limits are respected
- policies are satisfied

Acceptance Criteria:

- settlement verification returns deterministic result
- clear failure reasons provided

---

## PR 5 — MPCP Verifier CLI

Create a command line verifier tool.

Directory:

src/cli/

Example usage:

npx mpcp verify settlement.json

Output example:

✔ intent hash valid

✔ SPA signature valid

✔ budget within limits

✔ policy grant valid

MPCP verification PASSED

Purpose:

- debugging
- dispute resolution
- protocol compliance checks

---

## PR 6 — Protocol Conformance Tests

Directory:

test/protocol/

Tests:

- intent hash correctness
- policy grant validation
- budget authorization limits
- SPA verification
- settlement verification

Acceptance Criteria:

- full protocol verification suite passes

---

# Phase 3 — Developer Adoption

Goal: Make MPCP easy to integrate.

---

## PR 7 — SDK Improvements

Expand the SDK to support:

- artifact construction
- artifact signing
- verification helpers

Directory:

src/sdk/

Add helpers:

createPolicyGrant()

createBudgetAuthorization()

createSignedPaymentAuthorization()

createSettlementIntent()

computeIntentHash()

---

## PR 8 — End‑to‑End Example

Create a full working example flow.

Directory:

examples/parking-session/

Artifacts:

- fleet-policy.json
- policy-grant.json
- budget-auth.json
- signed-budget-auth.json
- spa.json
- settlement-intent.json
- settlement.json

Purpose:

Provide a full reference flow for developers.

---

## PR 9 — Integration Tests

Simulate a full MPCP lifecycle.

Test flow:

fleet policy

→ policy grant

→ budget authorization

→ SPA

→ settlement intent

→ settlement verification

Acceptance Criteria:

- full lifecycle passes verification

---

# Phase 4 — Protocol Network Effects

Goal: Enable MPCP to operate in **multi‑party environments**.

---

## PR 10 — Intent Anchoring

Add optional support for publishing intent hashes to distributed ledgers.

Possible rails:

- Hedera HCS
- XRPL
- EVM

Purpose:

Provide:

- public auditability
- dispute protection
- replay protection

---

## PR 11 — Dispute Verification

Add tooling to verify disputed settlements.

Functions:

verifyDisputedSettlement()

Inputs:

- settlement
- artifacts
- ledger anchor

Output:

verified / invalid

---

## PR 12 — Fleet Operator Tooling

Add features for fleet operators.

Examples:

- fleet policy dashboards
- payment audit trails
- settlement verification logs

---

# Expected Outcome

After completion of this roadmap MPCP will provide:

- a formal protocol specification
- deterministic artifact hashing
- a reference verifier
- an SDK
- integration examples

This enables MPCP to serve as a **machine‑to‑machine payment control protocol** for autonomous systems.

---

# Long Term Vision

MPCP aims to become a **standard protocol for autonomous machine payments** including:

- autonomous vehicles
- delivery robots
- machine marketplaces
- energy infrastructure

The reference implementation in this repository serves as the foundation for that ecosystem.