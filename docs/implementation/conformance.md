# Conformance

MPCP implementations can be verified for conformance to the protocol specification.

## Conformance Levels

| Level | Scope | Description |
|-------|-------|-------------|
| **Artifact** | Single artifact | Produces valid PolicyGrant and SBA per spec |
| **Chain** | Full authorization chain | Links artifacts correctly (policyHash, sessionId, constraints) |
| **Verification** | Settlement verification | Passes all verification checks for valid bundles |
| **Profile** | Deployment profile | Matches a reference profile (parking, charging, fleet-offline, hosted-rail) |

## Verification Vectors

The reference implementation includes golden vectors in `test/vectors/` for conformance testing:

- `valid-settlement.json` — Full valid chain, must pass
- `expired-grant.json` — Expired PolicyGrant, must fail
- `budget-exceeded.json` — Amount exceeds budget, must fail
- `settlement-mismatch.json` — Settlement does not match SBA constraints, must fail

Run the conformance tests:

```bash
npm test
npx mpcp verify test/vectors/valid-settlement.json --explain
```

## Self-Assessment

Implementers should verify:

1. **Artifact structure** — All required fields present, types correct
2. **Canonical JSON** — Deterministic serialization for hashing
3. **Domain-separated hashing** — Correct prefix per artifact type
4. **Signature verification** — Valid key resolution and signature check
5. **Constraint propagation** — SBA ⊆ PolicyGrant

## See Also

- [MPCP Reference Flow](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/architecture/reference-flow.md) — Canonical flow for EV charging
- [Verifier](verifier.md) — Verification pipeline
- [Protocol: mpcp](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/mpcp.md) — Full specification
