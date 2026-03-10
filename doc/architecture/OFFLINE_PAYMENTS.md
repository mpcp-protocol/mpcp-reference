# Offline Payment Authorization (PR8D)

MPCP enables **offline machine payments** using pre-authorized spending envelopes. Autonomous systems can complete payments when network connectivity is unavailable.

## Problem

Autonomous fleets operate in environments where connectivity may be intermittent:

- Underground parking garages
- Tunnels
- Charging facilities
- Dense urban environments
- Rural infrastructure

Traditional payment systems rely on centralized approval APIs. When connectivity is lost, transactions cannot complete.

## MPCP Solution

MPCP allows machines to hold **pre-authorized spending budgets** that can be used locally. No central backend is required at payment time.

### Pre-Authorized Policy Chain

Before going offline, the vehicle obtains:

1. **PolicyGrant** — Fleet policy constraints (allowed rails, assets, expiration)
2. **BudgetAuthorization** — Session spending envelope (max amount, destinations)
3. **SignedBudgetAuthorization (SBA)** — Cryptographically signed budget

The vehicle stores this chain onboard. When connectivity is restored, it can refresh the chain.

### Offline Payment Flow

1. Vehicle enters garage (no network available).

2. Parking meter issues a payment request.

3. Vehicle evaluates the request **locally**:
   - Within authorized budget?
   - Destination in allowlist?
   - Asset and rail permitted?

4. Vehicle signs **SignedPaymentAuthorization (SPA)** locally.

5. Parking system verifies the MPCP artifact chain **locally** (PolicyGrant → SignedBudgetAuthorization → SignedPaymentAuthorization → SettlementIntent).

6. Payment succeeds. Gate opens. **No central backend contacted.**

### Reconciliation

When connectivity returns, the parking system (or settlement rail) can:

- Submit the offline payment for settlement
- Reconcile with the fleet operator
- Update session state

## Key Behaviors

- **Local authorization** — BudgetAuthorization decisions use only onboard data
- **Deterministic verification** — MPCP artifacts can be verified without network
- **Successful payment during outage** — No central approval API required
- **Later reconciliation** — Settlement can complete when connectivity returns

## Demo

Run the offline payment demo:

```bash
npm run build
npm run example:offline
```

The demo simulates the full flow: vehicle with pre-authorized chain, enters garage (no network), payment request, local SPA signing, local verification, gate opens.
