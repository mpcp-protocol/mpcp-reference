# Fleet Example

Machine-to-machine payment loop for autonomous fleet vehicles.

## Scenario

Robotaxi enters parking facility → parking meter sends payment request → vehicle evaluates fleet policy and session budget → vehicle signs SPA → payment executes on rail → parking system verifies MPCP chain → gate opens.

## Architecture

```
┌─────────────────┐     payment request      ┌─────────────────┐
│ Parking Service │ ────────────────────────► │  Vehicle Agent  │
│ (meter/gate)    │                            │ (MPCP SDK +     │
│                 │                            │  wallet)        │
│ • request       │     MPCP artifacts         │                 │
│ • verify        │ ◄────────────────────────  │ • policy check  │
└────────┬────────┘     (SBA, SPA, intent)     │ • budget check  │
         │                                      │ • sign SPA      │
         │ verify                               └────────┬────────┘
         ▼                                                │
┌─────────────────┐                                      │ execute
│    Verifier     │                                      ▼
│ (local, no API) │                            ┌─────────────────┐
└─────────────────┘                            │ Settlement Rail │
         │                                      │ (mock / XRPL)   │
         │ PASS                                 └─────────────────┘
         ▼
    Gate opens
```

## Components

| Component | Role |
|-----------|------|
| **Vehicle Agent** | MPCP SDK, wallet/signing keys, policy + budget enforcement |
| **Parking Service** | Payment request endpoint, MPCP verification |
| **Verifier** | Validates PolicyGrant → SBA → SPA → SettlementIntent chain |
| **Settlement Rail** | Mock rail or XRPL |

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
- Deterministic SettlementIntent hashing
- Verification without centralized payment infrastructure

## See Also

- [Fleet Payments (spec)](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/fleet-payments.md)
- [Parking Example](parking.md)
- [Reference Profiles](../implementation/reference-profiles.md)
