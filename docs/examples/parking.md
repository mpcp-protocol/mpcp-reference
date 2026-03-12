# Parking Example

A full MPCP settlement flow for a parking payment scenario.

## Scenario

Vehicle parks at a meter or garage gate. The parking system requests payment. The vehicle evaluates fleet policy and session budget, signs an SPA, and returns the authorization. The parking system verifies the MPCP chain locally and opens the gate.

## Artifacts

| Artifact | Description |
|----------|-------------|
| policy-grant.json | Grant derived from policy constraints |
| budget-auth.json | Unsigned budget authorization |
| signed-budget-auth.json | Signed budget auth (SBA) |
| spa.json | Signed payment authorization |
| settlement-intent.json | Settlement intent |
| settlement.json | Settlement result |
| settlement-bundle.json | Combined bundle for verification |

## Run

```bash
npm run build
npm run example:parking
```

Or:

```bash
node examples/parking/generate.mjs
```

The script creates ephemeral signing keys, generates all artifacts, writes them to JSON files, runs `mpcp verify settlement-bundle.json --explain`, and exits 0 if verification passes.

## Verify Only

If you have already generated artifacts:

```bash
npx mpcp verify examples/parking/settlement-bundle.json --explain
```

The bundle is self-contained (includes public keys) and uses fixed timestamps so it remains verifiable indefinitely.

## Demos

### Machine Wallet Guardrails

Demonstrates autonomous spend guardrails: policy limits, cryptographic signatures, local verification, tamper detection.

```bash
npm run example:guardrails
```

### Offline Payment

Demonstrates offline machine payments: vehicle holds pre-authorized policy chain, completes payment when network is unavailable.

```bash
npm run example:offline
```

See [Offline Payments](../implementation/offline-payments.md).

## See Also

- [Build a Machine Wallet](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/build-a-machine-wallet.md)
- [Fleet Payments](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/fleet-payments.md)
- [Reference Profiles](../implementation/reference-profiles.md) — Parking profile
