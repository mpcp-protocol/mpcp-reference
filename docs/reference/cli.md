# CLI Reference

The CLI is included with the mpcp-service package. The `mpcp` command-line tool provides verification and policy summary.

## Install

```bash
npm install mpcp-service
npx mpcp --help
```

Or use the local build:

```bash
npm run build
./node_modules/.bin/mpcp --help
```

## verify

Verify a settlement bundle.

```bash
mpcp verify <settlement-file> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--explain` | Step-by-step diagnostics (schema, expected/actual) |
| `--json` | Machine-readable JSON output |
| `--append-log <file>` | Append verification result to JSONL audit log |

### Accepts

- Full `SettlementVerificationContext` (policyGrant, signedBudgetAuthorization, etc.)
- JSON artifact bundle: settlement, intent, spa, sba, policyGrant

### Examples

```bash
mpcp verify examples/parking-session/settlement-bundle.json
mpcp verify vectors/valid-settlement.json
mpcp verify settlement.json --explain
mpcp verify settlement.json --append-log audit.jsonl
```

---

## policy-summary

Print fleet policy constraints.

```bash
mpcp policy-summary <policy-file> [--profile <name>]
```

### Options

| Option | Description |
|--------|-------------|
| `--profile <name>` | Validate policy against a reference profile (parking, charging, fleet-offline, hosted-rail) |

### Examples

```bash
mpcp policy-summary examples/fleet-simulator/fleet-policy.json
mpcp policy-summary profiles/parking.json --profile parking
```

---

## Golden Protocol Vectors

Golden test vectors are in `vectors/` for interoperability and regression testing:

- `vectors/valid-settlement.json` — valid settlement with intent hash
- `vectors/expired-grant.json` — expired policy grant
- `vectors/budget-exceeded.json` — payment exceeds budget
- `vectors/intent-hash-mismatch.json` — intent hash mismatch
- `vectors/settlement-mismatch.json` — settlement amount mismatch

`npm test` runs the golden vector suite. Other implementations can verify compatibility by running their verifier against these vectors.

---

## See Also

- [Fleet Operator Tooling](../doc/architecture/FLEET_OPERATOR_TOOLING.md)
- [Reference Profiles](../doc/architecture/REFERENCE_PROFILES.md)
- [Protocol: Verification](../protocol/verification.md)
