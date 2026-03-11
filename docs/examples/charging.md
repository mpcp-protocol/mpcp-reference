# Charging Example

MPCP for EV charging: variable session length, multiple kWh, charging operator destinations.

## Scenario

EV connects to a charging station. The station requests payment authorization. The vehicle (or charging session manager) evaluates policy and budget, signs an SPA for the charging session, and the station verifies the MPCP chain before supplying power.

## Profile

The [Charging reference profile](../doc/architecture/REFERENCE_PROFILES.md#charging-profile) defines:

- **Rails** — xrpl, evm
- **Offline** — Yes (pre-authorized budgets)
- **Destinations** — Charging operators
- **Typical session** — Variable length, multiple kWh

## Policy Shape

Similar to parking, but with higher `maxSessionSpend` and charging-specific destinations:

```json
{
  "_profile": "charging",
  "maxSessionSpend": 100,
  "maxSessionSpendMinor": "10000",
  "allowedRails": ["xrpl", "evm"],
  "allowedAssets": [{ "kind": "IOU", "currency": "RLUSD", "issuer": "rIssuer" }],
  "destinations": ["rCharging"],
  "expiresAt": "2030-12-31T23:59:59Z"
}
```

## Flow

1. Vehicle (or fleet) obtains PolicyGrant + SBA with charging destinations
2. Charging station requests payment (amount may be estimated or updated during session)
3. Vehicle signs SPA for the authorized amount
4. Station verifies MPCP chain
5. Power is supplied; settlement executes when session ends

## Run Parking Example (Same Flow)

The parking example uses the same MPCP flow. For charging, adjust:

- `maxAmountMinor` — Higher for charging (e.g., 10000 = $100)
- `destinationAllowlist` — Charging operator addresses
- Session length — May span multiple payment authorizations for variable charging

```bash
npm run example:parking
```

Then modify the generated artifacts for charging parameters, or use the fleet simulator with a charging profile.

## See Also

- [Parking Example](parking.md)
- [Fleet Payments](../guides/fleet-payments.md)
- [Reference Profiles](../doc/architecture/REFERENCE_PROFILES.md)
