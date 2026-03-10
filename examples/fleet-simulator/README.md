# Fleet Spend Policy Simulator (PR8C)

A lightweight tool to simulate MPCP spend policies against payment scenarios before deploying to real vehicles or robots.

## Purpose

Fleet operators need confidence that policies will behave correctly before allowing autonomous machines to spend money. The simulator evaluates the MPCP chain (FleetPolicy → PolicyGrant → BudgetAuthorization → SPA decision) and reports whether each payment would be allowed or rejected.

## Policy

Define a fleet policy in `fleet-policy.json`:

```json
{
  "maxSessionSpend": 30,
  "maxSessionSpendMinor": "3000",
  "allowedRails": ["xrpl"],
  "allowedAssets": [{ "kind": "IOU", "currency": "RLUSD", "issuer": "rIssuer" }],
  "destinations": ["rParking", "rCharging", "rToll"],
  "expiresAt": "2030-12-31T23:59:59Z"
}
```

## Scenarios

Define payment scenarios in `scenarios.json`:

```json
[
  { "id": "parking", "description": "Parking payment", "amountMinor": "250", "amountUsd": "$2.50", "destination": "rParking" },
  { "id": "toll", "description": "Toll payment", "amountMinor": "600", "amountUsd": "$6.00", "destination": "rToll" },
  { "id": "charging", "description": "Charging payment", "amountMinor": "1800", "amountUsd": "$18.00", "destination": "rCharging" },
  { "id": "unexpected-vendor", "description": "Over budget", "amountMinor": "5000", "amountUsd": "$50.00", "destination": "rUnknownVendor" }
]
```

## Run

```bash
npm run build
npm run example:simulate
```

With custom files:

```bash
node examples/fleet-simulator/simulate.mjs path/to/policy.json path/to/scenarios.json
```

## Output

The simulator reports ALLOW or REJECT for each scenario with the reason:

- **budget_exceeded** — Amount exceeds session max
- **mismatch** — Destination not in allowlist, or rail/asset mismatch

## Features

- Define fleet policies via JSON
- Simulate payment requests
- Visualize policy enforcement (ALLOW/REJECT)
- Show rejection reasons (budget_exceeded, mismatch)
- Uses real MPCP SBA verification logic
