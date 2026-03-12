# MPCP Quickstart (5 minutes)

Get the full MPCP artifact chain running locally in under 5 minutes.

## Prerequisites

- Node.js 18+
- npm

## 1. Clone and Install

```bash
git clone https://github.com/mpcp-protocol/mpcp-reference.git
cd mpcp-reference
npm install
```

## 2. Build

```bash
npm run build
```

## 3. Generate the Artifact Chain

Run the parking session example. This creates ephemeral keys, generates the full MPCP chain, writes artifacts to disk, and runs verification.

```bash
npm run example:parking
```

You should see verification pass (exit 0). The script writes artifacts to `examples/parking/`.

## 4. The Artifact Chain Produced

The example generates the MPCP authorization chain:

| File | Artifact | Description |
|------|----------|-------------|
| policy-grant.json | PolicyGrant | Permission envelope (allowedRails, policyHash, expiresAt) |
| budget-auth.json | BudgetAuthorization | Unsigned spending envelope |
| signed-budget-auth.json | SignedBudgetAuthorization (SBA) | Signed budget; session max $30 |
| spa.json | SignedPaymentAuthorization (SPA) | Signed payment binding (amount, destination, intentHash) |
| settlement-intent.json | SettlementIntent | Canonical intent for hashing |
| settlement.json | Settlement | Executed settlement record |
| settlement-bundle.json | Bundle | All artifacts combined for verification |

Chain flow: **PolicyGrant → SBA → SPA → Settlement → Verification**

## 5. Verify the Bundle

Verify the settlement bundle with the CLI:

```bash
npx mpcp verify examples/parking/settlement-bundle.json --explain
```

The `--explain` flag shows step-by-step diagnostics. The bundle is self-contained (includes public keys), so verification works without env vars.

## 6. Policy Summary (Optional)

View fleet policy constraints:

```bash
npx mpcp policy-summary examples/machine-commerce/fleet-policy.json
```

Or validate against a reference profile:

```bash
npx mpcp policy-summary examples/machine-commerce/fleet-policy.json --profile parking
```

## Next Steps

- [What is MPCP?](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/overview/what-is-mpcp.md) — Understand the protocol
- [Build a Machine Wallet](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/build-a-machine-wallet.md) — Integrate into your app
- [Parking Example](examples/parking.md) — Deep dive on the example flow
