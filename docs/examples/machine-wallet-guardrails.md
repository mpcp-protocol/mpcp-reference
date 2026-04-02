# Machine Wallet Guardrails Example

Runnable example showing how MPCP acts as a **machine wallet guardrail layer**.

## Overview

A machine wallet should not authorize payments unless payment requests satisfy:

- **PolicyGrant** constraints (rails, assets, expiration)
- **SignedBudgetAuthorization** session limits (max amount, destination allowlist)

Once the SBA is issued, the **Trust Gateway** verifies the chain and executes the XRPL payment.

This example shows the integration pattern: check both layers before issuing an SBA.

This example focuses on wallet-side guardrail logic and uses a preloaded SBA-shaped authorization object rather than demonstrating full SBA issuance and signature verification.

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

1. **Allowed request** — $15 to rParking passes all checks; SignedBudgetAuthorization is created
2. **Wrong destination** — $5 to rAttacker is rejected (not in allowlist)
3. **Would exceed budget** — $20 to rCharging when session already spent $15 is rejected

## Guardrail Check Flow

```
Payment request → PolicyGrant validation → SignedBudgetAuthorization validation → SBA issued (or reject) → Trust Gateway → XRPL
```

See [Machine Wallet Guardrails](../implementation/machine-wallet-guardrails.md) for the full guide and threat model.
