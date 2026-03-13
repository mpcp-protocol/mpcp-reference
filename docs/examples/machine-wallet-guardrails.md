# Machine Wallet Guardrails Example

Runnable example demonstrating MPCP as a **machine wallet guardrail layer**.

## Overview

A machine wallet should not send funds unless payment requests satisfy:

- **PolicyGrant** constraints (rails, assets, expiration)
- **SignedBudgetAuthorization** session limits (max amount, destination allowlist)
- **SignedPaymentAuthorization** approval rules (amount binding, intent hash)

This example shows the integration pattern: check all three layers before signing.

## Run

```bash
npm run build
npm run example:wallet-guardrails
```

Or:

```bash
node examples/machine-wallet-guardrails/wallet-integration.mjs
```

## What It Demonstrates

1. **Allowed request** — $15 to rParking passes all checks; SPA is signed
2. **Wrong destination** — $5 to rAttacker is rejected (not in allowlist)
3. **Would exceed budget** — $20 to rCharging when session already spent $15 is rejected

## Guardrail Check Flow

```
Payment request → PolicyGrant check → SBA check → Sign SPA (or reject)
```

See [Machine Wallet Guardrails](../implementation/machine-wallet-guardrails.md) for the full guide and threat model.
