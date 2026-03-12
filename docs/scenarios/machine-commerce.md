# Machine Commerce Scenario

MPCP for autonomous machine-to-machine commerce: robots, vending, fleet payments.

## Scenario

A machine (robot, vending kiosk, delivery agent) pays for a service or product. The service requests payment. The machine evaluates policy and budget, signs an SPA, and the service verifies the MPCP chain before fulfilling.

## Use Cases

- **Vending machines** — Autonomous restock payments
- **Delivery robots** — Pay for charging, docking, access
- **Fleet vehicles** — Parking, charging, tolls (see [EV Charging](ev-charging.md) and [Parking](parking.md))
- **IoT devices** — Pay for API access, resources
- **AI agents** — Bounded spending within policy

## Flow

1. Machine obtains PolicyGrant + SBA (from fleet or operator)
2. Service requests payment
3. Machine validates policy and budget
4. Machine signs SPA
5. Service verifies MPCP chain
6. Service fulfills; settlement executes

## Characteristics

- **Machine-initiated** — No human at payment time
- **Bounded** — Spending within pre-authorized envelope
- **Verifiable** — Service can independently validate authorization

## See Also

- [MPCP Reference Flow — EV Charging](../architecture/reference-flow.md) — Full reference flow
- [EV Charging](ev-charging.md)
- [Parking](parking.md)
- [Fleet Payments](../guides/fleet-payments.md)
