# Machine Wallet Guardrails

Runnable example showing how a machine wallet integrates MPCP guardrails before signing payments.

## Concept

A machine wallet should **not** send funds unless the payment request satisfies:

1. **PolicyGrant** — Rail, asset, expiration
2. **SignedBudgetAuthorization (SBA)** — Session limits, destination allowlist
3. **SignedPaymentAuthorization (SPA)** — Payment binding (amount, destination)

## Wallet Integration Example

`wallet-integration.mjs` demonstrates the check-before-sign flow:

- Load PolicyGrant and SBA
- For each payment request: check guardrails, sign SPA only if all pass
- Rejects: wrong destination, overspend, wrong rail/asset
- Prints allowed vs rejected scenarios

**Run:**

```bash
npm run build
node examples/machine-wallet-guardrails/wallet-integration.mjs
```

## Full Flow Demo

For a complete narrative demo (policy → budget → SPA → verification → tamper detection), see:

```bash
npm run example:guardrails
```

Or `examples/parking/demo-guardrails.mjs`.

## Guide

See [Machine Wallet Guardrails](../../docs/implementation/machine-wallet-guardrails.md) for the full guardrail model, integration checklist, and threat-model notes.
