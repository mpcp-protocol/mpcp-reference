# Conformance

MPCP implementations can be verified for conformance to the protocol specification. This page defines **conformance tiers**, the **verification vectors** used to test them, the **MPCP Conformance Badge** for external implementers, and a **self-assessment checklist**.

---

## Conformance Tiers

Tiers are cumulative — each level assumes all lower levels pass.

| Tier | Name | Scope | What it proves |
|------|------|-------|----------------|
| **L0** | Hash | Canonical JSON + domain-separated hashing | Your serialization is deterministic and hashes match the reference |
| **L1** | Structural | Artifact shape + constraint propagation | Your artifacts contain all required fields and SBA ⊆ PolicyGrant holds |
| **L2** | Full-chain verification | Signatures, linkage, budget, expiry, XRPL conformance | Your verifier accepts valid chains and rejects invalid ones identically to the reference implementation |
| **L3** | Profile | Deployment profile conformance | Your implementation matches a named reference profile (parking, charging, fleet-offline, xrpl-stablecoin, hosted-rail) |

### L0 — Canonical Hash Reproduction

Recompute `SHA-256(UTF-8(prefix) || canonical_json(payload))` for each entry in [`test-vectors/expected-hashes.json`](https://github.com/mpcp-protocol/mpcp-spec/blob/main/test-vectors/expected-hashes.json) and obtain the documented hex digest.

Tooling: [`verify_test_vectors.py`](https://github.com/mpcp-protocol/mpcp-spec/blob/main/test-vectors/verify_test_vectors.py) (exit code 0 on success).

### L1 — Structural Sanity

Parse all `*-v1-minimal.json` fixtures in `test-vectors/` and confirm required fields are present with correct types. This does not replace normative schema definitions — it catches structural regressions.

### L2 — Full-Chain Verification

Verify golden vectors end-to-end using your verifier:

| Vector | Expected result |
|--------|----------------|
| `valid-settlement.json` | Pass — full chain valid |
| `expired-grant.json` | Fail — `policy_grant_expired` |
| `budget-exceeded.json` | Fail — `budget_exceeded` |
| `settlement-mismatch.json` | Fail — settlement does not match SBA constraints |

Run against the reference:

```bash
npx mpcp verify test/vectors/valid-settlement.json --explain
npx mpcp verify test/vectors/expired-grant.json --explain
```

L2 also requires signature verification (Ed25519 or P-256) and Trust Bundle key resolution.

### L3 — Profile Conformance

Validate that your deployment matches a named profile from [Reference Profiles](reference-profiles.md):

```bash
mpcp policy-summary your-policy.json --profile parking
```

Profile conformance checks: `allowedRails` subset, asset constraints, and profile-specific fields.

---

## MPCP Conformance Badge

External implementations that pass conformance testing may claim an MPCP conformance badge.

### Badge Format

Use a [Shields.io](https://shields.io) badge in your README:

```markdown
![MPCP Conformance](https://img.shields.io/badge/MPCP-L2%20Conformant-blue)
```

Rendered: ![MPCP Conformance](https://img.shields.io/badge/MPCP-L2%20Conformant-blue)

Replace `L2` with the highest tier your implementation passes (`L0`, `L1`, `L2`, or `L3`).

### package.json Claim

Add a structured conformance claim to your `package.json`:

```json
{
  "mpcp": {
    "conformance": "L2",
    "specVersion": "1.0",
    "testedWith": "mpcp-service@0.1.0",
    "profiles": ["xrpl-stablecoin"]
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `conformance` | Yes | Highest tier passed: `L0`, `L1`, `L2`, or `L3` |
| `specVersion` | Yes | MPCP spec version tested against |
| `testedWith` | Recommended | Reference implementation package and version used for verification |
| `profiles` | L3 only | Array of profile names the implementation conforms to |

### Claim Rules

1. **Self-assessed** — conformance is self-declared; there is no central certification authority
2. **Reproducible** — the implementation must include instructions for running the conformance vectors
3. **Versioned** — claims are tied to a specific `specVersion`; a new spec revision requires re-testing
4. **Honest** — do not claim a tier unless all lower tiers also pass

---

## Implementer Checklist

Use this checklist when preparing a conformance claim:

### L0 (Hash)

- [ ] `canonicalJson(obj)` produces identical output to the reference for all test payloads
- [ ] Domain-separated hash: `SHA-256("MPCP:TrustBundle:1.0:" + canonical)` matches for Trust Bundle vectors
- [ ] Domain-separated hash: `SHA-256("MPCP:PolicyGrant:1.0:" + canonical)` matches for PolicyGrant vectors
- [ ] Domain-separated hash: `SHA-256("MPCP:BudgetAuthorization:1.0:" + canonical)` matches for SBA vectors
- [ ] `verify_test_vectors.py` exits with code 0

### L1 (Structural)

- [ ] All minimal JSON fixtures parse without error
- [ ] Required fields present on PolicyGrant: `grantId`, `issuer`, `subject`, `purposes`, `allowedRails`, `budgetMinor`, `currency`, `expiresAt`
- [ ] Required fields present on SBA: `sessionId`, `grantId`, `policyHash`, `maxAmountMinor`, `currency`, `expiresAt`
- [ ] Constraint propagation: SBA `maxAmountMinor` ≤ PolicyGrant `budgetMinor`; SBA `expiresAt` ≤ PolicyGrant `expiresAt`

### L2 (Full-chain)

- [ ] `valid-settlement.json` passes full verification
- [ ] `expired-grant.json` fails with reason `policy_grant_expired`
- [ ] `budget-exceeded.json` fails with reason `budget_exceeded`
- [ ] `settlement-mismatch.json` fails with settlement constraint mismatch
- [ ] Ed25519 signature verification succeeds for valid artifacts
- [ ] Ed25519 signature verification fails for tampered artifacts
- [ ] Trust Bundle key resolution works (`resolveFromTrustBundle`)
- [ ] Expired Trust Bundles are rejected

### L3 (Profile)

- [ ] `allowedRails` in policy is a subset of the profile's permitted rails
- [ ] Asset constraints match profile definition (e.g., XRPL stablecoin: `kind: IOU`, valid `issuer`)
- [ ] Profile-specific checks pass (e.g., `offlineMaxSinglePayment` for fleet-offline)
- [ ] `mpcp policy-summary` with `--profile` flag reports no violations

---

## Verification Vectors

The reference implementation includes golden vectors in `test/vectors/` for conformance testing:

- `valid-settlement.json` — Full valid chain, must pass
- `expired-grant.json` — Expired PolicyGrant, must fail
- `budget-exceeded.json` — Amount exceeds budget, must fail
- `settlement-mismatch.json` — Settlement does not match SBA constraints, must fail

Additional hash vectors are in [`mpcp-spec/test-vectors/`](https://github.com/mpcp-protocol/mpcp-spec/tree/main/test-vectors):

- `expected-hashes.json` — canonical hash reference for L0
- `*-v1-minimal.json` — structural fixtures for L1

---

## See Also

- [Test Vectors — Conformance Levels](https://github.com/mpcp-protocol/mpcp-spec/blob/main/test-vectors/CONFORMANCE.md) — L0 / L1 / L2 definitions in the spec repo
- [MPCP Reference Flow](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/architecture/reference-flow.md) — Canonical flow for EV charging
- [Verifier](verifier.md) — Verification pipeline
- [Reference Profiles](reference-profiles.md) — Named deployment profiles for L3
- [Protocol: mpcp](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/mpcp.md) — Full specification
