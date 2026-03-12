# EV Charging Scenario

MPCP for EV charging: variable session length, multiple kWh, charging operator destinations.

## Scenario

EV connects to a charging station. The station requests payment authorization. The vehicle (or charging session manager) evaluates policy and budget, signs an SPA for the charging session, and the station verifies the MPCP chain before supplying power.

## Flow

1. Vehicle (or fleet) obtains PolicyGrant + SBA with charging destinations
2. Charging station requests payment (amount may be estimated or updated during session)
3. Vehicle signs SPA for the authorized amount
4. Station verifies MPCP chain
5. Power is supplied; settlement executes when session ends

## Characteristics

- **Variable session length** — Amount may be estimated or adjusted
- **Multiple kWh** — Higher budgets than parking
- **Charging operator destinations** — Station/network-specific payment addresses

## See Also

- [MPCP Reference Flow — EV Charging](../architecture/reference-flow.md) — Complete end-to-end scenario with actors, artifacts, timeline, and verification
- [Parking](parking.md)
- [Machine Commerce](machine-commerce.md)
