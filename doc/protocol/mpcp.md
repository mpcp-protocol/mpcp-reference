# Machine Payment Control Protocol (MPCP)

## Overview

The **Machine Payment Control Protocol (MPCP)** defines a cryptographically enforced pipeline for autonomous or software-controlled payments.

The protocol enables machines (vehicles, robots, services, AI agents, or IoT devices) to perform financial transactions while remaining constrained by deterministic policies.

Unlike traditional payment systems that rely on trusted intermediaries, MPCP enforces spending constraints through a sequence of signed authorization artifacts that are verified before settlement.

The protocol introduces a structured authorization flow:

Policy → Grant → Budget Authorization → Payment Authorization → Settlement Verification → Optional Public Attestation

This architecture ensures that machine-initiated payments remain bounded, auditable, and verifiable.

---

# Motivation

Autonomous systems increasingly participate in economic activity.

Examples include:

- autonomous vehicles paying for parking, tolls, or charging
- delivery robots purchasing access to infrastructure
- IoT devices paying for services or resources
- AI agents executing automated purchases
- fleet-operated vehicles performing operational payments

Traditional payment systems are not designed for these environments because they assume a human actor approving each transaction.

Machine payments require a different model where:

- policies are defined ahead of time
- spending is constrained cryptographically
- authorization artifacts can be verified independently
- settlement can be audited after execution

MPCP provides this control layer.

---

# Core Design Principles

The protocol is built around the following principles:

### Policy First

All payments must derive from explicit policy rules.

Policies may define:

- allowed operators
- allowed payment rails
- allowed assets
- geographic restrictions
- spending limits
- approval requirements

### Bounded Autonomy

Machines may execute payments autonomously but only within policy-defined limits.

### Cryptographic Authorization

Each stage of the pipeline produces a signed artifact that constrains the next stage.

### Deterministic Verification

Settlement transactions must be verifiable against the authorization artifacts.

### Optional Public Attestation

Intent commitments can optionally be anchored to a public ledger for additional audit guarantees.

---

# Protocol Versioning & Compatibility

## Version Field

All MPCP artifacts SHOULD include a version field.

Example:

```json
{
  "version": 1,
  "decisionId": "dec_123",
  ...
}
```

The version identifies the protocol semantics used when producing the artifact.

---

## Versioning Model

MPCP uses semantic versioning: **MAJOR.MINOR**

Example: `1.0`, `1.1`, `2.0`

### Minor Versions

Minor versions may:

- add optional fields
- extend artifact structures
- introduce new rails or assets

Minor upgrades MUST remain backward compatible.

Verifiers MUST ignore unknown optional fields.

### Major Versions

Major versions may:

- change artifact semantics
- modify verification rules
- alter canonicalization requirements

Verifiers MUST reject artifacts whose major version they do not support.

---

## Forward Compatibility

Implementations MUST:

- ignore unknown optional fields
- preserve unknown fields when forwarding artifacts

This ensures MPCP artifacts remain interoperable between different implementations.

---

## Artifact Version Propagation

Artifacts SHOULD propagate the version they were produced under.

Example chain:

```text
PolicyGrant.version
    ↓
SBA.version
    ↓
SPA.version
```

A verifier MAY reject chains containing mixed incompatible versions.

---

## Reference Version

The MPCP specification in this repository defines:

**Protocol Version: 1.0**

---

# Protocol Pipeline

The protocol operates as a multi-stage authorization pipeline.

```text
Policy Engine
      ↓
Policy Grant
      ↓
Budget Authorization (SBA)
      ↓
Signed Payment Authorization (SPA)
      ↓
Settlement Execution
      ↓
Settlement Verification
      ↓
Optional Intent Attestation
```

Each stage cryptographically binds the parameters for the following stage.

---

# Protocol Artifacts

The MPCP pipeline produces a series of structured artifacts. Each artifact constrains the next stage of the protocol and can be independently verified.

## PolicyGrant

The **PolicyGrant** represents the admission of a machine into a controlled payment context.

Example structure:

```json
{
  "grantId": "grant_abc123",
  "vehicleId": "veh_001",
  "operatorId": "operator_42",
  "lotId": "lot_7",
  "allowedRails": ["xrpl"],
  "allowedAssets": ["RLUSD"],
  "policyHash": "sha256(...)",
  "expiresAt": "2026-03-08T14:00:00Z"
}
```

The PolicyGrant defines the operational scope in which further authorizations may be issued.

See [PolicyGrant](./PolicyGrant.md) for the full specification.

---

## SignedBudgetAuthorization (SBA)

The **SignedBudgetAuthorization (SBA)** establishes the maximum spending envelope available to the machine.

Example structure:

```json
{
  "budgetId": "budget_123",
  "grantId": "grant_abc123",
  "sessionId": "sess_456",
  "scopeId": "sess_456",
  "budgetScope": "SESSION",
  "currency": "USD",
  "minorUnit": 2,
  "maxAmountMinor": "3000",
  "allowedRails": ["xrpl"],
  "allowedAssets": ["RLUSD"],
  "expiresAt": "2026-03-08T14:00:00Z",
  "signature": "..."
}
```

The SBA ensures that spending remains within defined limits.

See [SignedBudgetAuthorization](./SignedBudgetAuthorization.md) for the full specification.

---

## SignedPaymentAuthorization (SPA)

The **SignedPaymentAuthorization (SPA)** authorizes a specific settlement transaction.

Example structure:

```json
{
  "decisionId": "dec_123",
  "budgetId": "budget_123",
  "sessionId": "sess_456",
  "rail": "xrpl",
  "asset": {
    "kind": "IOU",
    "currency": "RLUSD",
    "issuer": "rIssuer..."
  },
  "amount": "19440000",
  "destination": "rDest...",
  "intentHash": "sha256(...)",
  "expiresAt": "2026-03-08T14:00:00Z",
  "signature": "..."
}
```

The SPA binds the authorized payment parameters and optionally includes an `intentHash` to bind the authorization to a canonical settlement intent.

See [SignedPaymentAuthorization](./SignedPaymentAuthorization.md) for the full specification. For `intentHash`, see [SettlementIntentHash](./SettlementIntentHash.md).

---

## SettlementIntent

A **SettlementIntent** describes the canonical form of the transaction that the machine wallet must execute.

Example structure:

```json
{
  "rail": "xrpl",
  "destination": "rDest...",
  "amount": "19440000",
  "currency": "RLUSD",
  "issuer": "rIssuer...",
  "memo": {
    "type": "mpcp",
    "decisionId": "dec_123"
  }
}
```

This structure is used to compute the `intentHash`.

See [SettlementIntent](./SettlementIntent.md) for the full specification. For the hash computation, see [SettlementIntentHash](./SettlementIntentHash.md).

---

## IntentCommitment

An **IntentCommitment** represents the hashed commitment of the settlement intent.

Example:

```text
commitment = SHA256(canonical_json(settlementIntent))
```

Commitments may optionally be published to the **Intent Attestation Layer (IAL)** to create a publicly verifiable record that the intent existed prior to settlement.

---

## Artifact Relationships

The protocol artifacts form a dependency chain. Each artifact references the previous stage and constrains the next.

```text
PolicyGrant
   ↓
SignedBudgetAuthorization (references grantId)
   ↓
SignedPaymentAuthorization (references budgetId)
   ↓
SettlementIntent (referenced by intentHash)
   ↓
IntentCommitment (hash of SettlementIntent)
```

### Relationship Rules

**PolicyGrant → SBA**

- `SBA.grantId` MUST reference a valid `PolicyGrant.grantId`
- the SBA must respect the rail, asset, and policy constraints of the grant

**SBA → SPA**

- `SPA.budgetId` MUST reference the issuing SBA
- `SPA.amount` MUST be ≤ `SBA.maxAmountMinor`
- `SPA.rail` MUST be included in `SBA.allowedRails`

**SPA → SettlementIntent**

- the settlement intent must match the payment parameters authorized in the SPA
- if present, `SPA.intentHash` MUST equal:

```text
SHA256(canonical_json(SettlementIntent))
```

**SettlementIntent → IntentCommitment**

- the commitment is derived deterministically from the canonical intent
- commitments may be published to the Intent Attestation Layer (IAL)

These relationships ensure that each stage of MPCP cryptographically and logically constrains the following stage, preventing unauthorized mutations or spending outside policy limits.

---

# Settlement Verification

Before accepting settlement, the system verifies:

- SPA signature validity
- policy hash consistency
- asset match
- destination match
- amount constraints
- authorization expiration
- settlement intent match

---

## Verification Algorithm

An MPCP verifier MUST perform the following steps before accepting settlement.

### Step 1 — Verify SPA Signature

Verify the cryptographic signature on the **SignedPaymentAuthorization (SPA)**.

```text
verify_signature(spa.signature, spa.payload, policyAuthorityPublicKey)
```

If signature verification fails → **reject settlement**.

---

### Step 2 — Verify Grant and Budget Lineage

Ensure that the authorization chain is valid.

```text
spa.budgetId → SignedBudgetAuthorization
sba.grantId  → PolicyGrant
```

Verification rules:

- `SPA.budgetId` MUST reference an existing SBA
- `SBA.grantId` MUST reference an existing PolicyGrant
- artifacts MUST NOT be expired

If lineage is invalid → **reject settlement**.

---

### Step 3 — Verify Policy Constraints

Confirm the settlement parameters match the authorized constraints.

Checks include:

- rail match
- asset match
- destination match
- amount ≤ authorized limit
- policyHash consistency

If any constraint fails → **reject settlement**.

---

### Step 4 — Verify Intent Binding (Optional)

If the SPA contains an `intentHash`, the verifier must reconstruct the canonical settlement intent and compare hashes.

```text
computedHash = SHA256(canonical_json(settlementIntent))
```

Verification rule:

```text
computedHash == SPA.intentHash
```

If mismatch → **reject settlement**.

---

### Step 5 — Verify Expiration

Check expiration fields:

- `PolicyGrant.expiresAt`
- `SBA.expiresAt`
- `SPA.expiresAt`

If any artifact is expired → **reject settlement**.

---

### Step 6 — Verify Settlement Transaction

Extract parameters from the executed settlement transaction and confirm they match the SPA.

Checks include:

- destination
- amount
- asset
- rail

If settlement parameters differ from SPA → **reject settlement**.

---

### Step 7 — Accept Settlement

If all verification steps succeed:

```text
accept settlement
record session close
emit settlement event
```

Optional:

- produce `IntentCommitment`
- publish commitment to the **Intent Attestation Layer (IAL)**.

---

# Canonical JSON Definition

To ensure deterministic hashing across systems, MPCP defines a **canonical JSON encoding** used when computing hashes such as `intentHash`.

All implementations MUST apply the same canonicalization rules before hashing.

Canonicalization rules:

1. Object keys MUST be sorted lexicographically.
2. No insignificant whitespace is allowed.
3. Numbers MUST be encoded as strings when representing monetary values.
4. Unicode strings MUST be UTF-8 encoded.
5. Fields with `null` or `undefined` values MUST be omitted.

Example:

Input object:

```json
{
  "destination": "rDest...",
  "amount": "19440000",
  "rail": "xrpl"
}
```

Canonical form:

```text
{"amount":"19440000","destination":"rDest...","rail":"xrpl"}
```

Hash computation:

```text
intentHash = SHA256(canonical_json(settlementIntent))
```

---

# Signature Schemes

MPCP supports multiple cryptographic signature schemes depending on the environment in which the policy authority operates.

Implementations SHOULD support at least one of the following:

### Ed25519

Recommended for most policy authorities.

Advantages:

- fast verification
- small signatures
- widely supported

### secp256k1

Common in blockchain systems including:

- Bitcoin
- Ethereum
- many EVM chains

Useful when authorization artifacts must be verified by smart contracts.

### XRPL Native Signatures

For XRPL-integrated environments, SPA artifacts may be signed using XRPL-compatible keypairs.

Implementations MAY also support XRPL multisign accounts for fleet-level authorization control.

Signature verification MUST validate:

- payload integrity
- signer identity
- signature scheme compatibility

---

# Replay Protection

MPCP must prevent the reuse of authorization artifacts across multiple settlements.

The following replay protections MUST be implemented.

### Decision ID Uniqueness

Each **SPA** contains a `decisionId`.

Rules:

- `decisionId` MUST be globally unique
- verifiers MUST reject reuse of a previously consumed `decisionId`

### Intent Hash Binding

When present, the `intentHash` binds the SPA to a specific settlement intent.

This prevents mutation of:

- amount
- destination
- asset
- memo fields

### Transaction Binding

Implementations SHOULD record the settlement transaction identifier.

Examples:

- XRPL `txHash`
- Ethereum `transactionHash`
- Lightning payment hash

Once a transaction hash is associated with an SPA, the authorization MUST NOT be reused.

---

# Threat Model

The MPCP protocol is designed to mitigate the following threats.

### Unauthorized Machine Spending

A compromised machine wallet cannot exceed authorized budgets because:

- payments require a valid SPA
- SPA amounts are bounded by the SBA

### Transaction Mutation

An attacker modifying settlement parameters will invalidate:

- intent hashes
- asset checks
- destination checks

### Replay Attacks

Expired or previously used authorizations cannot be reused due to:

- expiration checks
- decisionId uniqueness
- transaction binding

### Policy Bypass

Machines cannot bypass policy constraints because every authorization chain must derive from:

```text
PolicyGrant → SBA → SPA
```

### Settlement Tampering

Verification ensures that executed settlement transactions match authorized parameters before the session is finalized.

---

These sections define the core interoperability rules required for MPCP implementations across different systems and settlement rails.

---

# Wire Formats

This section defines the canonical wire-format expectations for MPCP artifacts.

All artifacts SHOULD be represented as UTF-8 JSON documents using the canonical JSON rules defined above when used for hashing or signing.

## PolicyGrant Wire Format

```json
{
  "grantId": "grant_abc123",
  "vehicleId": "veh_001",
  "operatorId": "operator_42",
  "lotId": "lot_7",
  "allowedRails": ["xrpl"],
  "allowedAssets": ["RLUSD"],
  "policyHash": "sha256(...)",
  "expiresAt": "2026-03-08T14:00:00Z"
}
```

## SignedBudgetAuthorization Wire Format

```json
{
  "budgetId": "budget_123",
  "grantId": "grant_abc123",
  "sessionId": "sess_456",
  "scopeId": "sess_456",
  "budgetScope": "SESSION",
  "currency": "USD",
  "minorUnit": 2,
  "maxAmountMinor": "3000",
  "allowedRails": ["xrpl"],
  "allowedAssets": ["RLUSD"],
  "expiresAt": "2026-03-08T14:00:00Z",
  "signature": "..."
}
```

## SignedPaymentAuthorization Wire Format

```json
{
  "decisionId": "dec_123",
  "budgetId": "budget_123",
  "sessionId": "sess_456",
  "rail": "xrpl",
  "asset": {
    "kind": "IOU",
    "currency": "RLUSD",
    "issuer": "rIssuer..."
  },
  "amount": "19440000",
  "destination": "rDest...",
  "intentHash": "sha256(...)",
  "expiresAt": "2026-03-08T14:00:00Z",
  "signature": "..."
}
```

## SettlementIntent Wire Format

```json
{
  "rail": "xrpl",
  "destination": "rDest...",
  "amount": "19440000",
  "currency": "RLUSD",
  "issuer": "rIssuer...",
  "memo": {
    "type": "mpcp",
    "decisionId": "dec_123"
  }
}
```

## IntentCommitment Wire Format

```json
{
  "intentHash": "sha256(...)",
  "batchId": "batch_001",
  "merkleRoot": "sha256(...)",
  "anchorNetwork": "hedera-hcs",
  "anchorReference": "topic:0.0.12345/sequence:678",
  "consensusTimestamp": "2026-03-08T14:00:05Z"
}
```

---

# Error Codes

MPCP implementations SHOULD expose stable machine-readable error codes during verification and settlement rejection.

Recommended codes:

| Code | Meaning |
|------|---------|
| SPA_SIGNATURE_INVALID | SPA signature verification failed |
| SBA_SIGNATURE_INVALID | SBA signature verification failed |
| POLICY_GRANT_NOT_FOUND | Referenced PolicyGrant does not exist |
| SBA_NOT_FOUND | Referenced SBA does not exist |
| SPA_NOT_FOUND | Referenced SPA does not exist |
| ARTIFACT_EXPIRED | One or more artifacts expired |
| POLICY_HASH_MISMATCH | Policy hash does not match authorized policy |
| RAIL_MISMATCH | Settlement rail differs from authorization |
| ASSET_MISMATCH | Settlement asset differs from authorization |
| DESTINATION_MISMATCH | Settlement destination differs from authorization |
| AMOUNT_EXCEEDED | Settlement amount exceeds authorized limit |
| INTENT_HASH_MISMATCH | Canonical settlement intent hash does not match SPA |
| DECISION_REPLAYED | decisionId has already been consumed |
| TX_REPLAYED | settlement transaction identifier has already been consumed |
| SCOPE_UNSUPPORTED | Authorization scope is not supported by the verifier |

Error codes SHOULD remain stable across implementations whenever possible to preserve interoperability.

---

# Reference Verification Pseudocode

The following pseudocode illustrates a minimal verifier implementation.

```text
function verifySettlement(grant, sba, spa, settlementTx):
    verifySignature(spa)
    verifyLineage(grant, sba, spa)
    verifyNotExpired(grant, sba, spa)
    verifyPolicyHash(grant, spa)
    verifyBudgetConstraints(sba, spa)
    verifySettlementFields(spa, settlementTx)

    if spa.intentHash is present:
        settlementIntent = canonicalizeSettlementIntent(settlementTx)
        computedHash = sha256(canonical_json(settlementIntent))
        assert computedHash == spa.intentHash

    assert decisionIdNotConsumed(spa.decisionId)
    assert txIdNotConsumed(settlementTx.id)

    markDecisionConsumed(spa.decisionId)
    bindTransaction(spa.decisionId, settlementTx.id)
    acceptSettlement()
```

This pseudocode is illustrative only. Production systems may split verification across multiple services.

---

# State Machine

MPCP authorization and settlement artifacts move through a small set of states.

## PolicyGrant

```text
ISSUED → EXPIRED
```

## SignedBudgetAuthorization

```text
ISSUED → EXPIRED
```

## SignedPaymentAuthorization

```text
ISSUED → CONSUMED
ISSUED → EXPIRED
ISSUED → REJECTED
```

## Settlement

```text
PENDING → VERIFIED
PENDING → REJECTED
```

## State Machine Rules

- A consumed SPA MUST NOT be reused.
- An expired grant, SBA, or SPA MUST NOT authorize settlement.
- A verified settlement MUST bind to exactly one `decisionId`.
- A rejected settlement MUST NOT advance the session to a closed state.

This state model keeps MPCP deterministic and makes replay protection enforceable.

---

# Optional Intent Attestation

To enhance auditability, MPCP can publish hashed commitments of payment intents to a public attestation layer.

Example flow:

```text
intent
  ↓
hash(intent)
  ↓
Merkle tree
  ↓
public ledger anchor
```

This provides:

- tamper-evident authorization history
- public timestamp proofs
- dispute resolution capabilities

The **Intent Attestation Layer (IAL)** can provide this functionality.

---

# Security Properties

The protocol prevents:

- unauthorized machine spending
- transaction mutation attacks
- replay of expired authorizations
- exceeding policy budgets
- unauthorized settlement destinations

Because each stage is cryptographically bound, a machine cannot bypass constraints without invalidating verification.

---

# Applications

MPCP can be applied across many autonomous payment scenarios:

- parking systems
- EV charging networks
- tolling infrastructure
- robotic logistics
- fleet management
- IoT service payments
- AI agent marketplaces

---

# Parker as Reference Implementation

The Parker system implements MPCP for autonomous parking payments.

Its architecture demonstrates how policy enforcement, authorization artifacts, and settlement verification can operate together.

Parker therefore serves as a reference implementation for the Machine Payment Control Protocol.

---

# Future Extensions

Possible extensions include:

- [Fleet Policy Authorization (FPA)](./FleetPolicyAuthorization.md) — fleet-level authorization hierarchies
- delegated policy authorities
- programmable payment intents
- zero-knowledge compliance proofs
- multi-chain settlement verification
- cross-operator interoperability

---

# Conclusion

The Machine Payment Control Protocol provides a framework for secure, policy-bounded autonomous payments.

By structuring payments as a chain of cryptographically constrained authorizations, MPCP allows machines to transact independently while maintaining strong guarantees around spending limits, policy compliance, and settlement integrity.
