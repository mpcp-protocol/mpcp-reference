# Fleet Example

Machine-to-machine payment loop for autonomous fleet vehicles.

## Scenario

Robotaxi enters parking facility → parking meter sends payment request → vehicle evaluates fleet policy and session budget → vehicle issues SBA → Trust Gateway verifies chain and executes XRPL payment → parking system verifies MPCP chain → gate opens.

## Architecture

```
┌─────────────────┐     payment request      ┌─────────────────┐
│ Parking Service │ ────────────────────────► │  Vehicle Agent  │
│ (meter/gate)    │                            │ (MPCP SDK +     │
│                 │                            │  wallet)        │
│ • request       │     MPCP artifacts         │                 │
│ • verify        │ ◄────────────────────────  │ • policy check  │
└────────┬────────┘     (PolicyGrant, SBA)     │ • budget check  │
         │                                      │ • issue SBA     │
         │ verify                               └────────┬────────┘
         ▼                                                │
┌─────────────────┐                                      │ SBA to gateway
│    Verifier     │                                      ▼
│ (local, no API) │                            ┌─────────────────┐
└─────────────────┘                            │  Trust Gateway  │
         │                                      │ verify chain +  │
         │ PASS                                 │ submit XRPL     │
         ▼                                      └────────┬────────┘
    Gate opens                                           │
                                                         ▼
                                               ┌─────────────────┐
                                               │   XRPL Ledger   │
                                               │ (mpcp/grant-id  │
                                               │  memo attached) │
                                               └─────────────────┘
```

## Components

| Component | Role |
|-----------|------|
| **Vehicle Agent** | MPCP SDK, wallet/signing keys, policy + budget enforcement |
| **Parking Service** | Payment request endpoint, MPCP verification |
| **Verifier** | Validates PolicyGrant → SBA → Settlement chain |
| **Trust Gateway** | Verifies SBA chain, submits XRPL payment with `mpcp/grant-id` memo |

## Run

```bash
npm run build
npm run example:fleet
```

Or:

```bash
node examples/machine-commerce/demo-fleet.mjs
```

## Output

Produces `fleet-demo-bundle.json`, a self-contained MPCP artifact bundle:

```bash
npx mpcp verify examples/machine-commerce/fleet-demo-bundle.json --explain
```

## Fleet Simulator

Simulate multiple vehicles and sessions:

```bash
npm run example:simulate
```

Uses `examples/machine-commerce/fleet-policy.json` and `simulate.mjs`.

## Key Behaviors

- Autonomous payment authorization within fleet limits
- Session budget enforcement
- Trust Gateway handles XRPL execution with on-chain audit trail
- Verification without centralized payment infrastructure

## See Also

- [Fleet Payments (spec)](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/fleet-payments.md)
- [Parking Example](parking.md)
- [Reference Profiles](../implementation/reference-profiles.md)
