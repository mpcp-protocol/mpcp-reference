# Machine Wallet Guardrails

MPCP acts as a **machine wallet guardrail layer**. A machine wallet should not send funds unless payment requests satisfy PolicyGrant constraints, SignedBudgetAuthorization session limits, and SignedPaymentAuthorization approval rules.

This guide describes the guardrail model, how to integrate it into a machine wallet, and threat-model considerations.

## The Guardrail Model

MPCP provides three layers of enforcement before a machine can pay:

| Layer | Artifact | Purpose |
|-------|----------|---------|
| 1 | PolicyGrant | Fleet-level constraints: allowed rails, assets, expiration |
| 2 | SignedBudgetAuthorization (SBA) | Session spending envelope: max amount, destination allowlist |
| 3 | SignedPaymentAuthorization (SPA) | Payment binding: specific amount, destination, intent hash |

**Rule:** The wallet must not sign an SPA unless the requested payment passes all three checks.

### Layer 1: PolicyGrant

- **Rails** — Is the settlement rail (xrpl, evm, etc.) permitted?
- **Assets** — Is the asset (e.g. RLUSD IOU) in the allowed set?
- **Expiration** — Has the grant expired?

### Layer 2: SignedBudgetAuthorization (SBA)

- **Max amount** — Does the requested amount fit within `maxAmountMinor`?
- **Destination** — Is the payee in `destinationAllowlist`?
- **Cumulative spend** — For session budgets, has the session already spent up to the limit?
- **Expiration** — Has the budget expired?

### Layer 3: SignedPaymentAuthorization (SPA)

- **Amount binding** — SPA commits to a specific amount and destination
- **Intent hash** — SPA binds to a canonical SettlementIntent
- **Tamper resistance** — SettlementIntent and final settlement must match the signed authorization

## Vehicle Wallet Roles

In an autonomous deployment, the vehicle wallet plays **two distinct roles** in the MPCP authorization pipeline.

### Session Authority

The wallet creates and signs the **SignedBudgetAuthorization (SBA)** before the session begins. This establishes the session-level spending envelope:

- Sets `maxAmountMinor` — the total spend ceiling for the session
- Sets `destinationAllowlist` — the permitted payees
- Binds to the PolicyGrant via `grantId`

The SBA is signed with the wallet's SBA key (`MPCP_SBA_SIGNING_PRIVATE_KEY_PEM`). Verifiers check this signature to confirm the budget was set by a trusted session authority.

### Payment Decision Service

For each payment request within the session, the wallet evaluates the request against the loaded policy chain and, if approved, creates and signs a **SignedPaymentAuthorization (SPA)**:

- Assigns a unique `decisionId`
- Commits to the specific amount, destination, and asset
- Computes and binds an `intentHash` to a canonical SettlementIntent
- Signs with the wallet's SPA key (`MPCP_SPA_SIGNING_PRIVATE_KEY_PEM`)

This decision is made **locally** — no central approval API is contacted. The SPA is a cryptographic proof that the wallet approved this specific payment within the authorized budget.

### Why Two Roles?

Separating session authority from payment decisions allows fleet operators to:

- Pre-authorize a spending envelope (SBA) before the vehicle enters service
- Let the vehicle make individual payment decisions (SPA) locally within that envelope
- Give verifiers a complete, self-contained authorization chain to validate

---

## Wallet Integration

A machine wallet integrates MPCP by performing checks *before* signing an SPA.

### Decision Flow

```
Payment request received
    ↓
PolicyGrant validation (rail, asset, expiry)
    ↓ PASS
SignedBudgetAuthorization validation (amount ≤ remaining, destination in allowlist, expiry)
    ↓ PASS
Create SettlementIntent + SignedPaymentAuthorization
    ↓
SignedPaymentAuthorization creation (or reject)
    ↓
Return SignedPaymentAuthorization (and optional SettlementIntent) to payee
```

### Integration Checklist

Before signing an SPA, the wallet **must**:

1. Validate the payment request against the loaded PolicyGrant
2. Validate against the loaded SBA (amount, destination, session balance)
3. Create a canonical SettlementIntent for the requested payment
4. Use `createSignedPaymentAuthorization` with the policy decision and intent
5. Never sign if any check fails

See the [wallet integration example](../examples/machine-wallet-guardrails.md) for a runnable implementation. That example focuses on wallet-side guardrail logic and uses a preloaded SBA-shaped authorization object rather than demonstrating full SBA issuance and signature verification.

## Bounded Authorization

MPCP emphasizes **bounded authorization**: the machine is given a spending envelope, not open-ended access.

- **Pre-authorized** — Policy and budget are set before the session
- **Cryptographically enforced** — SBA and SPA are signed; tampering is detectable
- **Local verification** — The verifier (e.g. parking meter) can validate the chain without calling a central API

This makes MPCP attractive to fleet and robotics teams who need machines to spend money safely at scale.

---

## Threat Model: Overspend and Misuse Prevention

### Threat: Overspend

**Scenario:** An attacker or bug causes the machine to pay more than authorized.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| SBA max amount | SPA binds to a specific amount; settlement above SBA limit is invalid |
| Session balance tracking | Wallet tracks cumulative spend; refuses SPA if would exceed budget |
| Verifier checks | Verifier validates amount ≤ SBA maxAmountMinor |
| Deterministic verification | `mpcp verify` fails if settlement does not match SPA |

**Wallet responsibility:** Track session spend. Do not sign SPA if `requested amount + sessionSpent > maxAmountMinor`.

### Threat: Wrong Destination

**Scenario:** Funds are sent to an unauthorized recipient.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| Destination allowlist | SBA `destinationAllowlist` constrains payees |
| SPA binding | SPA commits to specific destination; cannot be redirected |
| Verifier checks | Verifier validates destination in allowlist |

**Wallet responsibility:** Reject payment requests whose destination is not in `destinationAllowlist`.

### Threat: Unauthorized Rail or Asset

**Scenario:** Machine pays on a disallowed rail or with a disallowed asset.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| PolicyGrant | allowedRails, allowedAssets |
| SBA | SBA must match policy |
| Verifier | Validates rail and asset consistency across chain |

**Wallet responsibility:** Reject requests for rails or assets not in PolicyGrant/SBA.

### Threat: Replay and Tampering

**Scenario:** Reuse of old SPA, or modification of settlement after signing.

**Mitigations:**

| Mitigation | How MPCP Helps |
|------------|----------------|
| Intent hash | SPA binds to canonical SettlementIntent; changed amount/destination invalidates hash |
| Signatures | SBA and SPA are signed; tampering breaks verification |
| Expiration | All artifacts have expiresAt; expired chain fails verify |

**Wallet responsibility:** Never reuse an SPA. Create a fresh SPA per payment.

### Threat: Key Compromise

**Scenario:** SPA or SBA signing key is stolen.

**Mitigations:**

- SBA keys are typically held by fleet/issuer; compromise affects one fleet
- SPA keys are per-machine; rotate if compromised
- Budget limits (maxAmountMinor) bound maximum loss per session
- Short session expirations reduce exposure window

**Recommendation:** Use short-lived budgets for high-risk environments. Rotate SPA keys if compromise is suspected.

---

## Summary

- **Three-layer guardrail:** PolicyGrant → SBA → SPA
- **Wallet rule:** Do not sign SPA unless all checks pass
- **Threats addressed:** Overspend, wrong destination, wrong rail/asset, replay/tampering, key compromise
- **Bounded authorization:** Pre-authorized limits, cryptographic enforcement, local verification
