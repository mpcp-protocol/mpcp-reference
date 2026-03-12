# MPCP Reference Implementation

This repository provides the **reference implementation** of the [Machine Payment Control Protocol (MPCP)](https://github.com/mpcp-protocol/mpcp-spec).

For the **canonical protocol specification** — overview, architecture, protocol definitions, and conceptual guides — see [mpcp-spec](https://github.com/mpcp-protocol/mpcp-spec).

## What This Repo Provides

- **SDK** — Create and verify MPCP artifacts (PolicyGrant, SBA, SPA, SettlementIntent)
- **Verifier** — Settlement verification pipeline
- **CLI** — `mpcp verify` and `mpcp policy-summary`
- **Service API** — Backend facade for `issueBudget`, `verifySettlementService`, `anchorIntent`
- **Examples** — Parking, EV charging, machine commerce

## Quick Start

```bash
npm install mpcp-service
npm run build
npm run example:parking
npx mpcp verify examples/parking/settlement-bundle.json --explain
```

→ [Full quickstart](quickstart.md)

## Documentation

| Section | Description |
|---------|-------------|
| [Quickstart](quickstart.md) | Get running in 5 minutes |
| [Implementation](implementation/sdk.md) | SDK, verifier, conformance |
| [Reference](reference/sdk.md) | API reference (SDK, Service, CLI) |
| [Examples](examples/parking.md) | Parking, charging, fleet |

## Specification

The [MPCP specification](https://github.com/mpcp-protocol/mpcp-spec) is maintained in the `mpcp-spec` repository.
