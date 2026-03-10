# MPCP Service

**Reference implementation of the Machine Payment Control Protocol (MPCP).**

MPCP defines a policy‑bounded authorization pipeline for autonomous and software‑initiated payments.  
This repository contains the **core protocol implementation** used to issue, verify, and enforce MPCP authorization artifacts.

The service is designed to sit between **application logic** (such as parking systems, EV charging networks, robotics platforms, or AI agents) and **settlement rails** (XRPL, EVM chains, or hosted payment providers).

For the rationale behind the protocol, see:

[Why MPCP Exists](./doc/Why_MPCP.md)

For the full protocol specification, see:

[Machine Payment Control Protocol Specification](./doc/protocol/mpcp.md)

This document defines the MPCP artifacts, verification rules, canonical hashing, replay protection, the authorization lifecycle, and the verification algorithm used by MPCP implementations.

---

# Quick Start

The following example demonstrates the core MPCP lifecycle: entry policy evaluation → payment authorization → settlement verification.

```ts
import {
  evaluateEntryPolicy,
  evaluatePaymentPolicy,
  enforcePayment,
  computeIntentHash,
  canonicalJson,
  type MPCPPolicy,
} from "mpcp-service/sdk";

// Policy schema version is numeric (1). Protocol artifact versioning uses semantic strings ("1.0") per the spec.
const policy: MPCPPolicy = { version: 1, lotAllowlist: ["LOT-A"], railAllowlist: ["xrpl"], capPerTxMinor: "5000" };
const now = new Date().toISOString();
const asset = { kind: "IOU" as const, currency: "USDC", issuer: "rIssuer" };

// 1. Entry: evaluate policy → PolicyGrant
const grant = evaluateEntryPolicy({ policy, lotId: "LOT-A", nowISO: now, railsOffered: ["xrpl"], assetsOffered: [asset] });
// grant.grantAction === "ALLOW"

// 2. Payment: evaluate payment policy → PaymentPolicyDecision
const decision = evaluatePaymentPolicy({
  policy,
  lotId: "LOT-A",
  nowISO: now,
  sessionGrantId: grant.grantId,
  priceFiat: { amountMinor: "1000", currency: "USD" },
  railsOffered: ["xrpl"],
  assetsOffered: [asset],
});
// decision.action === "ALLOW"

// 3. Settlement: verify executed payment matches decision
const result = enforcePayment(decision, {
  amount: "1000",
  rail: "xrpl",
  destination: "rDestination",
  asset,
});
// result.allowed === true

// Canonical intent helpers
const intent = {
  rail: "xrpl",
  destination: "rDestination",
  amount: "1000",
  asset: { kind: "IOU" as const, currency: "USDC", issuer: "rIssuer" },
};

const hash = computeIntentHash(intent);

const canonical = canonicalJson({
  rail: "xrpl",
  destination: "rDestination",
  amount: "1000",
});

console.log(hash);
console.log(canonical);
```

To issue **SignedBudgetAuthorization** and **SignedPaymentAuthorization**, configure `MPCP_SBA_SIGNING_*` and `MPCP_SPA_SIGNING_*` env vars, then use `createSignedBudgetAuthorization` and `createSignedPaymentAuthorization` from `mpcp-service/sdk`.

---

# What MPCP Solves

Traditional payment systems assume a **human approving every transaction**.

Machine economies require a different model:

- autonomous vehicles paying for parking or charging
- delivery robots paying for infrastructure access
- IoT devices purchasing services
- AI agents executing programmatic purchases

MPCP introduces a **cryptographically enforced authorization pipeline** that constrains these payments through signed artifacts and deterministic verification.

---

# MPCP Artifacts

## PolicyGrant

The result of entry policy evaluation. Grants a session permission to enter a lot (or scope) and defines the allowed rails, assets, and spending caps for that session. Includes a `policyHash` that binds subsequent authorizations to the evaluated policy.

## SBA (SignedBudgetAuthorization)

SignedBudgetAuthorization authorizes a spending envelope for a session. It specifies a budget (`maxAmountMinor`), allowed rails, allowed assets, and destination allowlist. The SBA is cryptographically signed before the session begins. It constrains subsequent payment authorizations.

## SPA (SignedPaymentAuthorization)

SignedPaymentAuthorization binds a specific payment to a policy decision. It includes the decision ID, rail, asset, amount, destination, and optional `intentHash`. The SPA is signed when the payment is authorized. It is verified against the executed settlement.

## intentHash

A deterministic hash of a settlement intent (e.g. `SHA256(canonicalJson(intent))`). Used to bind a payment authorization to a specific settlement intent. Ensures the executed settlement matches the authorized intent.

---

# MPCP Authorization Pipeline

```
Policy
   ↓
PolicyGrant
   ↓
SignedBudgetAuthorization (SBA)
   ↓
SignedPaymentAuthorization (SPA)
   ↓
Settlement Execution
   ↓
Settlement Verification
   ↓
Optional Intent Attestation
```

Each stage cryptographically constrains the next.

---

# Core Components in This Repository

This repository implements the MPCP protocol core and reference verification engine.
It does not yet include the full MPCP network service.

## Policy Engine

Evaluates machine payment policies and produces `PolicyGrant` artifacts.

```
policy-core/
```

Responsibilities:

- policy evaluation
- operator allowlists
- lot / geographic restrictions
- spending caps
- approval requirements

---

## Authorization Artifacts

Definitions and helpers for the core MPCP artifacts:

- **PolicyGrant**
- **SignedBudgetAuthorization (SBA)**
- **SignedPaymentAuthorization (SPA)**

Artifacts contain the parameters that bound autonomous spending.

---

## Intent Hashing

Implements deterministic hashing for payment intents.

Components include:

- canonical JSON serialization
- `intentHash` computation

These are used to bind authorizations to a specific settlement intent.

## Intent Anchoring (optional)

Optional support for publishing intent hashes to distributed ledgers (public auditability, dispute protection). Currently provides a **mock anchor** for development and testing. Real ledger adapters (Hedera HCS, XRPL, EVM) are planned. See [Intent Anchoring](./doc/architecture/INTENT_ANCHORING.md).

## Dispute Verification (optional)

`verifyDisputedSettlement` validates disputed settlements using the full MPCP chain plus optional ledger anchor. See [Dispute Verification](./doc/architecture/DISPUTE_VERIFICATION.md).

---

## Verification Engine

Settlement verification logic ensures that executed transactions match the authorized parameters.

Verification checks include:

- rail verification
- asset verification
- amount verification
- destination verification
- expiration enforcement
- replay protection

---

## Replay Protection

The protocol prevents reuse of authorization artifacts by tracking:

- consumed `decisionId`s
- settlement transaction identifiers

---

# Architecture Overview

MPCP Service sits between application logic and settlement rails:

```
Application (Parking, EV, Robots, AI Agents)
        │
        │ MPCP API
        ▼
   MPCP Service
 (Policy + Authorization + Verification)
        │
        ▼
Settlement Rails (XRPL / EVM / Hosted)
        │
        ▼
Intent Attestation (optional, e.g. Hedera HCS)
```

---

# Example Flow

Example machine payment flow using MPCP:

```
Vehicle enters parking lot
  → Parker requests PolicyGrant

Session begins
  → MPCP issues SignedBudgetAuthorization

Vehicle exits
  → MPCP issues SignedPaymentAuthorization

Wallet executes settlement
  → MPCP verifies settlement transaction
```

---

# Repository Structure

```
mpcp-service
 ├── src
 │   ├── crypto
 │   ├── policy-core
 │   ├── protocol
 │   ├── sdk
 │   └── ...
 │
 ├── test
 ├── doc
 ├── package.json
 └── tsconfig.json
```

---

# Building

```
npm install
npm run build
```

---

# Testing

```
npm test
```

---

# Relationship to Parker

The **Parker parking system** is the first production client of MPCP.

Architecture:

```
Parker App
      ↓
MPCP Service
      ↓
Settlement Rails
```

Parker handles:

- parking sessions
- pricing
- entry / exit orchestration

MPCP Service handles:

- policy enforcement
- payment authorization
- settlement verification

---

# Status

This repository currently contains the **core protocol implementation**.

Planned additions:

- HTTP service layer
- persistent replay protection storage
- intent attestation layer
- real ledger anchoring (Hedera HCS, XRPL, EVM) — mock anchor available now
- multi‑application support

---

# Long-Term Vision

MPCP Service aims to become the **reference implementation of the Machine Payment Control Protocol**.

Potential future applications:

- autonomous vehicle payments
- EV charging networks
- robotic logistics
- machine‑to‑machine commerce
- AI agent marketplaces

---

# License

MIT
