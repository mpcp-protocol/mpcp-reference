# Fleet Payment Demo (PR8B)

A runnable demonstration of the **machine-to-machine payment loop** for autonomous fleet vehicles.

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
| **Settlement Rail Adapter** | Mock rail (or XRPL reference) |

## Run

```bash
npm run build
npm run example:fleet
```

Or:

```bash
node examples/fleet-payment/demo-fleet.mjs
```

## Output

The script produces `fleet-demo-bundle.json`, a self-contained MPCP artifact bundle suitable for verification:

```bash
npx mpcp verify examples/fleet-payment/fleet-demo-bundle.json --explain
```

## Key Behaviors

- Autonomous payment authorization within fleet limits
- Session budget enforcement
- Deterministic SettlementIntent hashing
- Verification without centralized payment infrastructure
