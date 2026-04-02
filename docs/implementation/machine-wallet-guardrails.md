# Machine Wallet Guardrails

MPCP acts as a **machine wallet guardrail layer**. A machine wallet should not authorize payments unless payment requests satisfy PolicyGrant constraints and SignedBudgetAuthorization session limits. The Trust Gateway then executes the XRPL payment once the SBA chain is verified.

This guide describes the guardrail model, how to integrate it into a machine wallet, and threat-model considerations.

## The Guardrail Model

MPCP provides two layers of enforcement before a machine can authorize payment, followed by mandatory Trust Gateway execution:

| Layer | Artifact | Purpose |
|-------|----------|---------|
| 1 | PolicyGrant | Fleet-level constraints: allowed rails, assets, expiration |
| 2 | SignedBudgetAuthorization (SBA) | Per-payment spending envelope: max amount, destination allowlist |
| 3 | Trust Gateway | Verifies SBA chain and submits XRPL payment with `mpcp/grant-id` memo |

**Rule:** The wallet must not issue an SBA unless the requested payment passes both policy checks. The Trust Gateway must not submit payment unless it can verify the full PolicyGrant → SBA chain.

### Layer 1: PolicyGrant

- **Rails** — Is the settlement rail (xrpl) permitted?
- **Assets** — Is the asset (e.g. RLUSD IOU) in the allowed set?
- **Expiration** — Has the grant expired?
- **anchorRef** — Optional on-chain anchor of the policy document

### Layer 2: SignedBudgetAuthorization (SBA)

- **Max amount** — Does the requested amount fit within `maxAmountMinor`?
- **Destination** — Is the payee in `destinationAllowlist`?
- **Cumulative spend** — For session budgets, has the session already spent up to the limit?
- **Expiration** — Has the budget expired?

### Layer 3: Trust Gateway

- **Chain verification** — Verifies PolicyGrant → SBA chain before executing
- **XRPL execution** — Submits the XRPL payment with `mpcp/grant-id` memo for audit trail
- **Mandatory actor** — All XRPL payments in MPCP v1.0 flow through the Trust Gateway

## Vehicle Wallet Roles

In an autonomous deployment, the vehicle wallet plays the **session authority** role:

### Session Authority

The wallet creates and signs the **SignedBudgetAuthorization (SBA)** for each payment. This establishes the per-payment spending envelope:

- Sets `maxAmountMinor` — the amount for this specific payment
- Sets `destinationAllowlist` — the permitted payees
- Binds to the PolicyGrant via `grantId`

The SBA is signed with the wallet's SBA key (`MPCP_SBA_SIGNING_PRIVATE_KEY_PEM`). Verifiers and the Trust Gateway check this signature to confirm the budget was set by a trusted session authority.

### Why the Trust Gateway?

The Trust Gateway is the mandatory execution layer for MPCP v1.0 (XRPL-primary). Separating wallet authorization from payment execution allows:

- Wallet signs the SBA (what is authorized)
- Trust Gateway executes on XRPL (how it settles), attaching `mpcp/grant-id` memo
- Verifiers can validate the full chain independently without contacting payment infrastructure

---

## Wallet Integration

A machine wallet integrates MPCP by performing checks *before* issuing an SBA.

### Decision Flow

```
Payment request received
    ↓
PolicyGrant validation (rail, asset, expiry)
    ↓ PASS
SignedBudgetAuthorization validation (amount ≤ remaining, destination in allowlist, expiry)
    ↓ PASS
Issue SBA for this payment
    ↓
Return SBA to Trust Gateway
    ↓
Trust Gateway submits XRPL payment with mpcp/grant-id memo
```

### Integration Checklist

Before issuing an SBA, the wallet **must**:

1. Validate the payment request against the loaded PolicyGrant
2. Validate against session budget (amount, destination, session balance)
3. Use `createSignedBudgetAuthorization` with the policy decision
4. Never sign if any check fails

See the [wallet integration example](../examples/machine-wallet-guardrails.md) for a runnable implementation.

## Bounded Authorization

MPCP emphasizes **bounded authorization**: the machine is given a spending envelope, not open-ended access.

- **Pre-authorized** — Policy and budget are set before the session
- **Cryptographically enforced** — SBA is signed; tampering is detectable
- **Local verification** — The verifier (e.g. parking meter) can validate the chain without calling a central API
- **XRPL audit trail** — Every XRPL payment carries `mpcp/grant-id` memo for on-chain auditability

This makes MPCP attractive to fleet and robotics teams who need machines to spend money safely at scale.

---

## Threat Model: Overspend and Misuse Prevention

### Threat: Overspend

**Scenario:** An attacker or bug causes the machine to pay more than authorized.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| SBA max amount | SBA commits to a specific max amount; settlement above SBA limit is invalid |
| Session balance tracking | Wallet tracks cumulative spend; refuses SBA if would exceed budget |
| Trust Gateway check | Gateway validates amount ≤ SBA maxAmountMinor before executing |
| Deterministic verification | `mpcp verify` fails if settlement does not match SBA |

**Wallet responsibility:** Track session spend. Do not issue SBA if `requested amount + sessionSpent > maxAmountMinor`.

### Threat: Wrong Destination

**Scenario:** Funds are sent to an unauthorized recipient.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| Destination allowlist | SBA `destinationAllowlist` constrains payees |
| Trust Gateway | Gateway rejects payment if destination not in SBA allowlist |
| Verifier checks | Verifier validates destination in allowlist |

**Wallet responsibility:** Reject payment requests whose destination is not in `destinationAllowlist`.

### Threat: Unauthorized Rail or Asset

**Scenario:** Machine pays on a disallowed rail or with a disallowed asset.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| PolicyGrant | allowedRails, allowedAssets |
| SBA | SBA must match policy |
| Trust Gateway | Validates rail and asset consistency across chain |

**Wallet responsibility:** Reject requests for rails or assets not in PolicyGrant/SBA.

### Threat: Replay and Tampering

**Scenario:** Reuse of old SBA, or modification of settlement after signing.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| Signatures | SBA is signed; tampering breaks verification |
| Expiration | All artifacts have expiresAt; expired chain fails verify |
| XRPL memo | `mpcp/grant-id` memo on-chain prevents retroactive falsification |

**Wallet responsibility:** Never reuse an SBA for a different payment amount or destination.

### Threat: Key Compromise

**Scenario:** SBA signing key is stolen.

**Mitigations:**

- SBA keys are typically held by fleet/issuer; compromise affects one fleet
- Budget limits (maxAmountMinor) bound maximum loss per payment
- Short session expirations reduce exposure window

**Recommendation:** Use short-lived budgets for high-risk environments. Rotate SBA keys if compromise is suspected.

---

## Summary

- **Two-layer guardrail + Trust Gateway:** PolicyGrant → SBA → Trust Gateway → XRPL
- **Wallet rule:** Do not issue SBA unless all checks pass
- **Threats addressed:** Overspend, wrong destination, wrong rail/asset, replay/tampering, key compromise
- **Bounded authorization:** Pre-authorized limits, cryptographic enforcement, local verification, XRPL on-chain audit trail
