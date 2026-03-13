# Profile Model

Profiles make MPCP concrete for specific rails and asset systems without changing the core protocol.

## What a profile is

A deployment profile is a named constraint set that makes MPCP concrete for a specific payment environment without changing the base protocol.

---

## What stays in the base protocol

The following remain fixed in MPCP and are not profile-specific:

- **PolicyGrant** — Fleet policy authorization
- **SignedBudgetAuthorization** — Session budget envelope
- **SignedPaymentAuthorization** — Signed payment binding
- **SettlementIntent** — Canonical intent for hashing
- **Canonical hashing** — Deterministic JSON serialization and SHA-256
- **Verification chain** — PolicyGrant → SBA → SPA → SettlementIntent → Settlement

---

## What belongs in a profile

Profiles define constraints and expectations for a given deployment:

- **Settlement rail** — Which rail(s) are allowed (xrpl, evm, stripe, hosted, etc.)
- **Asset model** — Native vs issued asset, currency codes, decimals
- **Issuer validation rules** — Which issuers are trusted for IOU assets
- **Destination conventions** — Allowed payees, address formats
- **Decimal / unit expectations** — Minor units, precision
- **Verifier requirements** — What the verifier must check
- **Wallet requirements** — What the wallet must enforce before signing

---

## Why profiles exist

Profiles serve several goals:

- **Keep MPCP rail-agnostic** — The base protocol does not hard-code rails or assets
- **Avoid forking the protocol per ecosystem** — Each ecosystem gets a profile instead of a protocol fork
- **Make adoption concrete** — Adopters choose a profile and know exactly what to implement
- **Support interoperability** — Implementations following the same profile interoperate

---

## Current profiles

| Profile | Rail | Asset Model | Notes |
|---------|------|-------------|-------|
| Parking | xrpl | native/simple | Short sessions |
| Charging | xrpl, evm | variable | Longer sessions |
| Hosted Rail | stripe, hosted | backend-managed | Online approval |
| XRPL Stablecoin | xrpl | issued asset / IOU | RLUSD-style payments |

See [Reference Profiles](reference-profiles.md) for full details and policy examples.

---

## How to add a new profile

A new profile should define:

- **Rail identifier** — The settlement rail(s) allowed
- **Asset representation** — How amounts and currencies are expressed
- **Wallet constraints** — What the wallet must validate before signing
- **Verifier constraints** — What the verifier must check
- **Example policy** — A JSON policy conforming to the profile
- **Example bundle** — A verifiable settlement bundle

Add the profile JSON to `profiles/`, document it in [Reference Profiles](reference-profiles.md), and provide at least one example bundle that passes `mpcp verify`.
