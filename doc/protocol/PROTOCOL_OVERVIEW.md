

# MPCP Protocol Overview

Machine Payment Control Protocol (MPCP) defines a set of signed artifacts and verification rules that allow autonomous systems (vehicles, agents, machines) to perform payments safely under policy constraints.

The protocol separates **policy**, **authorization**, and **settlement** so that machines can transact automatically while still remaining auditable and controllable by fleet operators.

This document provides a high‑level overview of how the MPCP artifacts interact during a payment lifecycle.

---

# Design Goals

MPCP is designed around several core principles:

**Autonomous operation**  
Machines must be able to complete payments without requiring human approval for each transaction.

**Policy enforcement**  
Fleet operators must be able to control where, how, and how much machines can spend.

**Cryptographic auditability**  
Every authorization and payment step must be verifiable after the fact.

**Rail agnosticism**  
MPCP does not depend on any specific payment network. It can work with:

- XRPL
- EVM chains
- hosted payments
- card processors
- future payment rails

**Deterministic verification**  
A verifier must be able to reconstruct and validate the full payment decision using signed artifacts.

---

# Protocol Artifacts

MPCP defines a set of artifacts that represent different stages of the payment lifecycle.

| Artifact | Purpose |
|--------|--------|
| FleetPolicyAuthorization | Defines fleet‑wide policy constraints |
| PolicyGrant | Grants permission for a vehicle/session to transact |
| BudgetAuthorization | Defines spending limits for a session |
| SignedBudgetAuthorization | Signed version of the budget authorization |
| SignedPaymentAuthorization | Authorizes a specific payment |
| SettlementIntent | Canonical description of the intended settlement |
| SettlementIntentHash | Deterministic hash used to verify the intent |

Each artifact is cryptographically signed and may be independently verified.

---

# Payment Lifecycle

A typical MPCP payment follows the sequence below.

```
FleetPolicyAuthorization
        │
        ▼
PolicyGrant
        │
        ▼
BudgetAuthorization
        │
        ▼
SignedBudgetAuthorization
        │
        ▼
SignedPaymentAuthorization
        │
        ▼
SettlementIntent
        │
        ▼
SettlementIntentHash
        │
        ▼
Settlement Verification
```

---

# Step-by-Step Flow

## 1. Fleet Policy Definition

The fleet operator defines policy constraints using **FleetPolicyAuthorization**.

Examples:

- allowed payment rails
- geographic restrictions
- daily spending limits
- allowed merchants or operators

This artifact defines the boundaries within which vehicles may operate.

---

## 2. Policy Grant

When a machine enters a payment environment (for example, a parking lot), a **PolicyGrant** is issued.

The grant confirms that the machine is allowed to transact under the fleet policy.

The grant may include:

- allowed payment rails
- allowed assets
- spending caps
- expiration time

---

## 3. Budget Authorization

A **BudgetAuthorization** establishes how much the machine can spend within a specific context.

Examples:

- maximum parking spend for the session
- daily spending cap
- transaction limit

The authorization is then signed to produce a **SignedBudgetAuthorization**.

---

## 4. Payment Authorization

When a payment is required, the machine generates a **SignedPaymentAuthorization (SPA)**.

This artifact authorizes a specific payment within the previously granted budget.

The SPA includes:

- payment amount
- allowed payment rails
- expiration
- references to the budget authorization

---

## 5. Settlement Intent

Before settlement occurs, the machine creates a **SettlementIntent**.

This artifact describes exactly what settlement will occur.

Examples:

- destination address
- payment asset
- payment amount
- payment rail

---

## 6. Settlement Intent Hash

A deterministic **SettlementIntentHash** is computed from the canonical settlement intent.

This hash ensures that the settlement can be verified independently.

It may also be used for:

- anchoring to distributed ledgers
- replay protection
- dispute resolution

---

## 7. Settlement Verification

After payment occurs, a verifier can validate the transaction by checking:

1. The settlement matches the SettlementIntent
2. The intent matches the SignedPaymentAuthorization
3. The SPA fits within the SignedBudgetAuthorization
4. The SBA fits within the PolicyGrant
5. The PolicyGrant conforms to fleet policy

If all checks pass, the payment is considered valid under MPCP.

---

# Reference Implementation

The `mpcp-service` repository contains a reference implementation including:

- MPCP artifact schemas
- verification utilities
- SDK client helpers

These components allow developers to integrate MPCP into autonomous payment systems.

---

# Use Cases

MPCP is designed for machine‑to‑machine payments such as:

- autonomous vehicle parking
- toll payments
- charging stations
- delivery robot services
- machine marketplaces

Any environment where machines transact without human intervention can benefit from MPCP.

---

# Future Extensions

The protocol is designed to evolve through extensions including:

- multi‑signature fleet approvals
- distributed intent anchoring
- privacy‑preserving payment proofs
- cross‑rail settlement abstraction

These extensions will be introduced as future MPCP protocol versions.

---

# Related Specifications

For detailed definitions of each artifact see:

- `PolicyGrant.md`
- `SignedBudgetAuthorization.md`
- `SignedPaymentAuthorization.md`
- `SettlementIntent.md`
- `SettlementIntentHash.md`
- `FleetPolicyAuthorization.md`
