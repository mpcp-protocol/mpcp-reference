# Machine Payment Control Protocol (MPCP)

**Protocol Version: MPCP 1.0**

**A protocol for verifiable machine-to-service payments.**

Autonomous vehicles, AI agents, and machines increasingly pay for real-world services like parking, charging, and tolls.

## How MPCP works

A machine payment is accepted only if the recipient can verify a chain of signed artifacts:

**[Fleet Policy](architecture/authorization-chain.md) → [PolicyGrant](protocol/PolicyGrant.md) → [SignedBudgetAuthorization](protocol/SignedBudgetAuthorization.md) → [SignedPaymentAuthorization](protocol/SignedPaymentAuthorization.md) → [SettlementIntent](protocol/SettlementIntent.md) → Settlement**

Each step narrows what the machine is allowed to do.

→ [See the full reference flow](architecture/reference-flow.md)


MPCP is not a settlement rail — it is the authorization layer above settlement.

<div class="grid cards" markdown>

- **Understand the Problem**  
  Why existing payment APIs are not designed for autonomous machines.  
  → [Read the problem](overview/problem-statement.md)

- **Learn the Protocol**  
  See the MPCP authorization chain and how it works.  
  → [Protocol overview](protocol/artifacts.md)

- **Build with MPCP**  
  Implement a machine wallet or service provider.  
  → [Quickstart](quickstart.md)

- **Explore Examples**  
  Autonomous parking, EV charging, and fleet payments.  
  → [Examples](examples/parking.md)

</div>

## The MPCP Authorization Chain

MPCP defines a sequence of artifacts that authorize and verify a machine payment.

```
Fleet Policy
↓
PolicyGrant
↓
SignedBudgetAuthorization
↓
SignedPaymentAuthorization
↓
SettlementIntent
↓
Settlement
```

1. **Fleet Policy** — Defines rules: where, when, how much a machine may spend.

2. **PolicyGrant** — Initial permission envelope derived from policy.

3. **SignedBudgetAuthorization (SBA)** — Session-level spending limits.

4. **SignedPaymentAuthorization (SPA)** — Binds a specific payment to the approved quote.

5. **SettlementIntent** — Canonical description of the payment to execute.

6. **Settlement** — Executed transaction verified against the chain.

→ [Authorization Chain (visual reference)](architecture/authorization-chain.md)

## Where MPCP Fits in the Agent Stack

| Layer | Purpose |
|------|--------|
| MCP | Tool access |
| A2A | Agent communication |
| ACP | Agent messaging |
| **MPCP** | **Machine payments** |

MPCP complements agent protocols by enabling **verifiable payment authorization between machines and services**.

## Example: Autonomous Parking

1. A vehicle enters a parking garage.
2. The garage verifies a **PolicyGrant**.
3. The vehicle presents a **SignedBudgetAuthorization (SBA)** for the session.
4. When exiting, a **SignedPaymentAuthorization (SPA)** is issued.
5. The garage verifies settlement.

This ensures the payment can be independently verified.

→ [Full example](examples/parking.md)

## Why MPCP?

Traditional payment systems assume a human approves every transaction. Machine economies need a different model:

- **Bounded authorization** — Pre-authorized spending envelopes instead of wallet popups
- **Offline-capable** — Payments complete when the network is unavailable
- **Verifiable** — Every settlement can be independently verified against the authorization chain
- **Rail-agnostic** — XRPL, EVM, Stripe, hosted—one authorization model, any settlement rail

## Architecture Overview

MPCP allows machines, service providers, and verification systems to independently validate payment authorization chains.

→ [See architecture diagrams](diagrams/README.md)

## Specification

The full protocol specification is in the [MPCP specification](protocol/mpcp.md). The [reference implementation](https://github.com/naory/mpcp-service) is available on GitHub.

## Start Building

- [Quickstart](quickstart.md)
- [SDK Reference](reference/sdk.md)
- [Service API](reference/service-api.md)
- [CLI](reference/cli.md)
