# Fleet Operator Tooling (PR12)

CLI features for fleet operators: settlement verification logs and fleet policy summary.

## Settlement Verification Logs

Append verification results to a JSONL audit log for payment audit trails.

```bash
mpcp verify settlement-bundle.json --append-log audit.jsonl
```

Each verification appends one JSON line. When valid:

```json
{"ts":"2026-03-10T20:41:06.284Z","event":"settlement_verification","file":"settlement-bundle.json","resolvedPath":"/path/to/settlement-bundle.json","valid":true}
```

When invalid, `reason` and `artifact` are included:

```json
{"ts":"...","event":"settlement_verification","file":"...","resolvedPath":"...","valid":false,"reason":"policy_grant_expired","artifact":"policyGrant"}
```

- **ts** — ISO 8601 timestamp
- **event** — `settlement_verification`
- **file** — Path as passed to CLI
- **resolvedPath** — Absolute path
- **valid** — Verification result
- **reason** — (when invalid) Failure reason
- **artifact** — (when invalid) Artifact that failed

Use with `--explain` or `--json`; the audit log receives the same `valid` result.

## Fleet Policy Summary

Print fleet policy constraints in a readable format.

```bash
mpcp policy-summary examples/machine-commerce/fleet-policy.json
```

Output:

```
Fleet Policy Summary
====================
  Max session spend:  $30.00
  Allowed rails:      xrpl
  Allowed assets:     RLUSD
  Destinations:       rParking, rCharging, rToll
  Expires:            2030-12-31T23:59:59Z
```

Supports fleet policy JSON with `maxSessionSpend`/`maxSessionSpendMinor`, `allowedRails`, `allowedAssets`, `destinations`, `expiresAt`.

## Use Cases

- **Payment audit trails** — Run `mpcp verify` with `--append-log` on each settlement to build an audit log
- **Settlement verification logs** — Review `audit.jsonl` for verification history
- **Fleet policy dashboards** — Use `policy-summary` output or parse policy JSON for dashboard display
