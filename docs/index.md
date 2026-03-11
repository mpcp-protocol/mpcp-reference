# Machine Payment Control Protocol (MPCP)

**Protocol Version: MPCP 1.0**

**A protocol for verifiable machine-to-service payments.**

Autonomous vehicles, AI agents, and machines increasingly pay for real-world services like parking, charging, and tolls.

MPCP provides a **cryptographically verifiable authorization chain** for these payments.

<div class="grid cards" markdown>

- **Understand the Problem**  
  Why existing payment APIs are not designed for autonomous machines.  
  → [Read the problem](overview/problem.md)

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
PolicyGrant
      ↓
BudgetAuthorization
      ↓
PaymentAuthorization
      ↓
Settlement
```

1. **PolicyGrant**  
   Defines where a machine is allowed to pay.

2. **BudgetAuthorization**  
   Defines spending limits for a session.

3. **PaymentAuthorization**  
   Authorizes a specific payment.

4. **Settlement**  
   Final transaction verification.

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
3. The vehicle presents a **BudgetAuthorization** for the session.
4. When exiting, a **PaymentAuthorization** is issued.
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

The full protocol specification is in the [MPCP specification](../doc/protocol/mpcp.md). The [reference implementation](https://github.com/naory/mpcp-service) is available on GitHub.

## Start Building

- [Quickstart](quickstart.md)
- [SDK Reference](reference/sdk.md)
- [Service API](reference/service-api.md)
- [CLI](reference/cli.md)
