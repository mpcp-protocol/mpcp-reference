# Offline Payment Authorization

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
2. **BudgetAuthorization** — Per-payment spending envelope (max amount, destinations)
3. **SignedBudgetAuthorization (SBA)** — Cryptographically signed budget

The vehicle stores this chain onboard. When connectivity is restored, it can refresh the chain.

### Trust Bundles for Offline Key Resolution

To verify SBA signatures without network access, the verifier needs the issuer's public key. MPCP solves this with **Trust Bundles** — pre-distributed signed documents that package trusted issuer public keys.

Before going offline, the verifier (e.g., parking meter) obtains one or more Trust Bundles from the fleet's Policy Authority. Each bundle contains approved issuer identities and their public keys (as JWKs). The bundle itself is signed by the Policy Authority's root key, so the verifier can confirm authenticity locally.

When the SBA envelope includes an `issuer` field, the verifier resolves the signing key from the Trust Bundle by matching `issuer` + `issuerKeyId` — no network call required.

### Offline Payment Flow

1. Vehicle enters garage (no network available).

2. Parking meter issues a payment request.

3. Vehicle evaluates the request **locally**:
   - Within authorized budget?
   - Destination in allowlist?
   - Asset and rail permitted?

4. Vehicle presents the SBA to the local verifier (parking meter).

5. Parking system verifies the MPCP artifact chain **locally** (PolicyGrant → SignedBudgetAuthorization → Settlement). Signing keys are resolved from the pre-loaded **Trust Bundle** — no network call needed.

6. When connectivity returns, the vehicle or merchant submits the payment via the **Trust Gateway**, which executes the XRPL transaction with the `mpcp/grant-id` memo. **No central backend is needed for the authorization check.**

### Reconciliation

When connectivity returns:

- The Trust Gateway submits the XRPL payment referencing the SBA
- The `mpcp/grant-id` memo on the XRPL transaction provides an on-chain audit trail
- Fleet operator can reconcile with the on-chain record

## Key Behaviors

- **Local authorization** — BudgetAuthorization decisions use only onboard data
- **Deterministic verification** — MPCP artifacts can be verified without network
- **Successful payment during outage** — No central approval API required at authorization time
- **Later settlement** — XRPL payment executes via Trust Gateway when connectivity returns

## Demo

Run the offline payment demo:

```bash
npm run build
npm run example:offline
```

The demo simulates the full flow: vehicle with pre-authorized chain, enters garage (no network), payment request, local SBA verification, gate opens, settlement submitted via Trust Gateway when back online.
