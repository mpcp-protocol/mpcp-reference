# XRPL Stablecoin Example

Example bundle for the **XRPL Stablecoin Profile**. Demonstrates MPCP settlement with XRPL issued assets (RLUSD).

## Profile

See `profiles/xrpl-stablecoin.json` and `docs/implementation/xrpl-stablecoin-profile.md`.

## Bundle

`xrpl-stablecoin-bundle.json` — Full settlement chain for a 19.44 RLUSD payment to `rDestination`.

## Verify

```bash
mpcp verify xrpl-stablecoin-bundle.json
mpcp verify xrpl-stablecoin-bundle.json --explain
```

## Policy Summary

```bash
mpcp policy-summary ../../profiles/xrpl-stablecoin.json --profile xrpl-stablecoin
```
