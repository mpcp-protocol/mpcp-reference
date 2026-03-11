# Why MPCP Exists

The **Machine Payment Control Protocol (MPCP)** exists because machine economies require a different payment architecture than human‑centered systems. This document explains the rationale.

---

## Machine Payments Need Bounded Authorization

Traditional payment systems assume a human approves every transaction. A card swipe, a bank transfer, or a wallet signature—each involves an explicit human decision at the moment of payment.

Machine payments do not. An autonomous vehicle cannot pause at a toll gate to open a wallet popup. A delivery robot cannot wait for a human to approve each charging station payment. An AI agent cannot interrupt a workflow every few seconds for manual consent.

**Machines need to spend within bounds, not per transaction.**

Bounded authorization means:

- A **policy** defines the rules: where, when, how much, and under what conditions spending is allowed.
- A **budget** (SignedBudgetAuthorization) authorizes a spending envelope for a session or scope.
- A **payment authorization** (SignedPaymentAuthorization) binds a specific settlement to the approved quote.

Each artifact cryptographically constrains the next. The machine can execute payments autonomously—as long as they stay within the bounds established by policy and budget. No human approval at payment time; the approval happens when the session and budget are granted.

Without bounded authorization, machine payments either:

- Block on human approval (slow, doesn’t scale), or
- Grant unbounded access (risky, unacceptable for real assets).

MPCP provides bounded authorization that is verifiable, enforceable, and suitable for autonomous spending.

---

## Wallet Popups Don’t Scale

In Web3 and wallet‑based flows, the dominant pattern is “sign to approve.” Each payment triggers a wallet interaction: connect, sign message, confirm transaction. This works when a human is at the keyboard.

It does **not** work when:

- **Volume is high.** Hundreds of micropayments per vehicle per day (parking, charging, tolls) cannot each require a popup.
- **Latency matters.** A gate does not wait 30 seconds for a user to find their phone and approve.
- **The user is absent.** A robot, IoT device, or background agent has no human to click “Confirm.”
- **UX matters.** Frequent popups destroy usability and adoption.

Wallet popups assume one‑to‑one human attention. Machine payments assume many‑to‑one: many transactions, minimal human involvement.

MPCP shifts approval upstream. The human (or policy administrator) approves a **session** and a **budget**. The machine spends within that budget using pre‑authorized intents. Settlement becomes a background operation, not an interactive one.

---

## Policy → Budget → Payment → Verification Is the Right Architecture

MPCP’s architecture is deliberate:

```
Policy
   ↓
PolicyGrant (session entry)
   ↓
SignedBudgetAuthorization (spending envelope)
   ↓
SignedPaymentAuthorization (binding to specific settlement)
   ↓
Settlement Execution
   ↓
Settlement Verification
```

**Policy** defines rules: allowlists, caps, approval thresholds. It is evaluated at session entry and at payment time.

**Budget** (SBA) authorizes a spending envelope. It answers: “How much can this session spend, on which rails, to which destinations?” It is issued once per session (or scope).

**Payment** (SPA) binds a specific settlement to a policy decision and quote. It answers: “This exact payment—this amount, this destination, this quote—was authorized.” It is issued per payment.

**Verification** ensures the executed settlement matches the authorization. No drift, no replay, no modification.

This sequence is correct because:

1. **Separation of concerns.** Policy evaluation is distinct from budget issuance, which is distinct from payment binding. Each layer can be audited, tested, and replaced independently.
2. **Minimal disclosure.** The budget does not need to know every future payment. The payment authorization only binds what is necessary for that settlement.
3. **Verifiable chain.** Each step produces a signed or verifiable artifact. An operator or auditor can trace from settlement back to policy.
4. **Settlement‑agnostic policy.** Policy and budget are expressed in abstract terms (caps, rails, destinations). Settlement details (tx hash, chain) are handled at execution and verification.

Alternative designs—e.g., a single omnibus “approve everything” signature, or policy evaluated only at payment time—either fail to bound risk or introduce unacceptable latency and complexity.

---

## Summary

MPCP exists because:

1. **Machine payments need bounded authorization**—spending within policy and budget, without per‑transaction human approval.
2. **Wallet popups don’t scale**—approval must move upstream to session and budget.
3. **Policy → Budget → Payment → Verification** is the right architecture—separation of concerns, verifiable chain, settlement‑agnostic policy.

For the protocol specification and implementation, see the [Machine Payment Control Protocol Specification](./protocol/mpcp.md) and the [MPCP Service README](https://github.com/naory/mpcp-service#readme).
