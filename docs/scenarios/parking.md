# Parking Scenario

MPCP for parking: vehicle enters, pays on exit, offline-capable.

## Scenario

Vehicle parks at a meter or garage gate. The parking system requests payment. The vehicle evaluates fleet policy and session budget, signs an SPA, and returns the authorization. The parking system verifies the MPCP chain locally and opens the gate.

## Flow

1. Vehicle enters parking facility
2. PolicyGrant + SBA loaded (or issued at entry)
3. On exit, parking system requests payment
4. Vehicle signs SPA for session amount
5. Parking system verifies MPCP chain locally
6. Gate opens; settlement executes

## Characteristics

- **Offline-capable** — Underground garages may have no connectivity
- **Fixed or variable pricing** — Per-session or time-based
- **Local verification** — No central backend required at payment time

## Run Example

```bash
npm run build
npm run example:parking
```

Or:

```bash
node examples/parking-session/generate.mjs
```

## See Also

- [MPCP Reference Flow — EV Charging](../architecture/reference-flow.md) — Same authorization flow, different use case
- [EV Charging](ev-charging.md)
- [Machine Commerce](machine-commerce.md)
- [Offline Payments](../guides/fleet-payments.md#offline-flow)
