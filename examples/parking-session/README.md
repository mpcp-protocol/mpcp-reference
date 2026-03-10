# Parking Session Example

A full MPCP settlement flow for a parking payment scenario.

## Flow

**Reference artifact** (static, not generated):

- **fleet-policy.json** — Fleet policy constraints. A minimal policy for illustration; the generate script does not use or produce this file.

**Generated artifacts** (created by `generate.mjs`):

1. **policy-grant.json** — Grant derived from policy constraints
2. **budget-auth.json** — Unsigned budget authorization
3. **signed-budget-auth.json** — Signed budget auth (SBA)
4. **spa.json** — Signed payment authorization
5. **settlement-intent.json** — Settlement intent
6. **settlement.json** — Settlement result
7. **settlement-bundle.json** — Combined bundle for verification

## Generate and Verify

```bash
npm run build
npm run example:parking
```

Or:

```bash
node examples/parking-session/generate.mjs
```

The script:

- Creates ephemeral signing keys
- Generates all artifacts using the SDK
- Writes each artifact to a JSON file
- Runs `mpcp verify settlement-bundle.json --explain`
- Exits 0 if verification passes

## Verify Only

If you have already run generate and want to re-verify:

```bash
npx mpcp verify examples/parking-session/settlement-bundle.json --explain
```

The bundle is self-contained: it includes `sbaPublicKeyPem` and `spaPublicKeyPem`, so anyone can run `mpcp verify` on it without setting env vars or regenerating.

Committed artifacts use fixed timestamps (`expiresAt: 2030-12-31`, `nowISO: 2026-01-15`) so they remain verifiable indefinitely.

---

## Machine Wallet Guardrails Demo (PR8A)

A narrative demo that illustrates **autonomous spend guardrails**: machine wallets spending within cryptographically enforced limits, with local verification and tamper detection.

**Scenario:** Robotaxi at parking facility → meter requests payment → vehicle checks policy → signs SPA within budget → meter verifies chain → gate opens.

**Guardrails demonstrated:**

- Policy limits (allowed rails, assets, destinations, max spend)
- Cryptographic signatures (SBA, SPA)
- Local verification (no central approval API)
- Tamper detection (modified amount rejected)

**Run:**

```bash
npm run build
npm run example:guardrails
```

Or:

```bash
node examples/parking-session/demo-guardrails.mjs
```

The script runs the full MPCP flow, prints a step-by-step narrative, writes `guardrails-demo-bundle.json`, runs verification, and demonstrates tamper detection by modifying the settlement amount and showing verification fails.

---

## Offline Payment Demo (PR8D)

Demonstrates **offline machine payments**: vehicle holds pre-authorized policy chain, completes payment when network is unavailable.

**Scenario:** Vehicle loads PolicyGrant + SBA before trip → enters underground garage (no network) → parking meter requests payment → vehicle evaluates locally → signs SPA locally → parking verifies chain locally → gate opens. No central backend contacted.

**Key behaviors:**

- Pre-authorized spending envelope (PolicyGrant + SBA)
- Local authorization decisions
- Local SPA signing and verification
- Reconciliation when connectivity returns

**Run:**

```bash
npm run build
npm run example:offline
```

Or:

```bash
node examples/parking-session/demo-offline.mjs
```

See [doc/architecture/OFFLINE_PAYMENTS.md](../../doc/architecture/OFFLINE_PAYMENTS.md) for full documentation.
