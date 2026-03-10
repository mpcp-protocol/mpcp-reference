## PR 5 — MPCP Verifier CLI

Create a command line verifier tool.

Directory:

src/cli/

Example usage:

npx mpcp verify settlement.json

Output example:

✔ intent hash valid

✔ SPA signature valid

✔ budget within limits

✔ policy grant valid

MPCP verification PASSED

Purpose:

- debugging
- dispute resolution
- protocol compliance checks

### PR 5A — CLI Explain Mode

Enhance the MPCP verifier CLI with an **explain mode** that provides step‑by‑step diagnostics for verification results.

Example usage:

npx mpcp verify settlement.json --explain

Example output:

MPCP Verification Report

✔ PolicyGrant.schema
✔ SignedBudgetAuthorization.schema
✔ SignedPaymentAuthorization.schema
✔ SettlementIntent.schema
✔ SignedBudgetAuthorization.valid
✘ SettlementIntent.intentHash mismatch
  Expected: 5d9b3c...
  Actual:   a1c82f...

Verification FAILED

Purpose:

- provide detailed debugging information
- help fleet operators diagnose payment failures
- support dispute investigation and audit workflows

Implementation:

Add a detailed verification report structure:

```
type VerificationCheck = {
  name: string           // Artifact.check (e.g. SettlementIntent.intentHash)
  phase: "schema" | "linkage" | "hash" | "policy"  // ordering: schema → linkage → hash → policy
  valid: boolean
  reason?: string
  expected?: unknown
  actual?: unknown
}

type DetailedVerificationReport = {
  valid: boolean
  checks: VerificationCheck[]  // sorted by phase
}
```

Add a new verifier function:

verifySettlementDetailed()

The CLI should render:

- human‑readable output when `--explain` is used
- machine‑readable JSON when `--json` is used

Acceptance Criteria:

- CLI supports `--explain` flag
- CLI supports `--json` flag
- verification output clearly identifies the failing artifact