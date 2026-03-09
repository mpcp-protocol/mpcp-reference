

# Intent Attestation Layer (IAL)

## Vision

The **Intent Attestation Layer (IAL)** is a public infrastructure for cryptographically committing to machine‑generated payment intents and authorizations.

It enables autonomous systems—vehicles, robots, agents, services, and applications—to prove that a payment authorization or settlement intent existed at a specific time and was not altered before execution.

IAL does **not process payments**.  
Instead, it provides a **verifiable commitment layer** between:

Policy → Authorization → Settlement → Proof

This layer allows systems to anchor intent commitments publicly while preserving privacy and operational speed.

IAL is designed for the emerging **agentic economy**, where machines autonomously negotiate and execute financial transactions.

---

# Motivation

Traditional payment systems rely on trusted intermediaries to validate and record authorizations.

Examples include:

- banks
- card networks
- centralized payment processors

These institutions effectively serve as the **attestation layer**.

However, in decentralized and autonomous systems:

- the actor may be a vehicle
- the wallet may be controlled by software
- policies may be enforced locally
- settlements may occur across multiple ledgers

In these environments, a neutral and verifiable **intent commitment layer** becomes useful.

IAL allows systems to prove:

- an authorization existed
- it was issued before a given time
- it was not modified
- the settlement corresponds to the authorized intent

---

# System Model

IAL sits between authorization and settlement.

```
Policy Engine
      ↓
Authorization Object
      ↓
Intent Commitment
      ↓
Public Attestation (Merkle Anchor)
      ↓
Settlement Execution
      ↓
Verification / Proof
```

Systems can continue to operate off‑chain while anchoring commitments publicly.

---

# Intent Objects

An **Intent Object** describes the authorized settlement parameters.

Example:

```
{
  "intentId": "intent_123",
  "sessionId": "sess_456",
  "rail": "xrpl",
  "asset": {
    "kind": "IOU",
    "currency": "RLUSD",
    "issuer": "rIssuer..."
  },
  "amount": "19440000",
  "destination": "rDestination...",
  "expiresAt": "2026-03-08T14:00:00Z"
}
```

Intent objects may originate from:

- Signed Payment Authorizations (SPA)
- Signed Budget Authorizations (SBA)
- payment policies
- automated negotiation protocols

IAL commits to the **hash of the canonical intent** rather than storing the object itself.

---

# Commitment Layer

Systems submit hashed intents:

```
commitment = SHA256(canonical_json(intent))
```

These commitments are aggregated into Merkle trees.

```
intent hash
      ↓
Merkle tree
      ↓
Merkle root
      ↓
public ledger anchor
```

Batch anchoring provides:

- scalability
- low cost
- privacy preservation

---

# Anchoring

The Merkle root can be anchored to one or more public ledgers.

Possible anchors include:

- Bitcoin
- Ethereum
- XRPL
- Hedera
- other timestamping networks

Anchoring provides:

- public timestamping
- tamper evidence
- censorship resistance

---

# Target DLT: Hedera Consensus Service (HCS)

The initial implementation of the Intent Attestation Layer anchors commitments using **Hedera Consensus Service (HCS)**.

HCS provides a decentralized, ordered, and timestamped messaging system. It is well suited for intent commitments because IAL requires:

- globally ordered event submission
- deterministic consensus timestamps
- low‑latency finality
- predictable operational cost
- the ability to anchor high‑volume commitments without storing payload data on‑chain

Instead of publishing full intent objects to a ledger, IAL submits **hashed commitments** to an HCS topic.

Example submission:

```
{
  "type": "intent_commitment",
  "commitment": "SHA256(canonical_json(intent))"
}
```

IAL nodes batch these commitments into Merkle trees and periodically publish the **Merkle root** to HCS.

```
intent hash
      ↓
Merkle tree
      ↓
Merkle root
      ↓
HCS topic submission
```

The HCS transaction provides:

- consensus timestamp
- ordered sequence number
- immutable public record of the commitment

This allows any verifier to prove that an intent commitment existed before a specific time without revealing the intent contents.

IAL therefore uses HCS as its **primary public attestation layer**, while keeping the underlying intent payloads off‑chain.

Future implementations may optionally mirror anchors to additional networks (such as Bitcoin or XRPL) for cross‑chain redundancy and audit assurances.

---

# Proof Model

Users can later request an **inclusion proof**.

Proof includes:

- intent hash
- Merkle proof
- anchor transaction reference

Verification proves:

1. the intent existed before the anchor timestamp
2. the commitment was included in the Merkle tree
3. the root was anchored publicly

---

# Privacy Model

IAL is designed to avoid leaking sensitive payment data.

Only hashes are anchored publicly.

Optional privacy extensions include:

- salted commitments
- encrypted intent payloads
- selective disclosure
- zero‑knowledge compliance proofs

Example ZK statement:

"Settlement amount was within authorized budget"

without revealing the actual amount.

---

# Compliance Proofs (Future)

IAL can support proofs that a settlement complies with an authorization.

Examples:

- settlement amount ≤ authorized budget
- destination in allowed list
- authorization not expired
- policy rules satisfied

These proofs could be implemented using:

- zero knowledge circuits
- verifiable computation
- policy proof systems

---

# Integration with Payment Systems

IAL is designed to integrate with multiple settlement systems.

Examples:

- XRPL
- EVM chains
- Lightning
- Stripe
- bank transfers
- hosted payment processors

The settlement layer remains independent.

IAL only commits to the intent.

---

# Example Flow

Example: autonomous parking payment

1. Vehicle enters parking lot.
2. Policy engine generates authorization.
3. Parker creates Signed Payment Authorization (SPA).
4. SPA intent hash is submitted to IAL.
5. IAL batches commitment and anchors Merkle root.
6. Vehicle executes payment.
7. Settlement verification checks SPA and settlement.
8. If needed, inclusion proof shows SPA existed prior to payment.

---

# Benefits

IAL enables:

- public proof of payment intent
- tamper‑evident authorization
- dispute resolution
- cross‑system interoperability
- auditability for fleets and enterprises

It supports autonomous payments while maintaining privacy and operational efficiency.

---

# Parker as Reference Implementation

Parker demonstrates a practical system built around intent authorization.

Its architecture:

Policy → Grant → Budget Authorization → Payment Authorization → Settlement

IAL extends this architecture by adding a public commitment layer.

Parker can serve as the **first real‑world implementation** integrating IAL.

---

# Future Extensions

Potential extensions include:

- decentralized attestation networks
- zk‑proof policy enforcement
- multi‑chain anchor redundancy
- machine identity binding
- programmable payment intents
- verifiable agent negotiations
- public intent marketplaces

IAL could eventually serve as a foundational infrastructure for the **machine payment economy**.

---

# Summary

The Intent Attestation Layer provides a new primitive for financial systems.

It enables systems to publicly commit to payment intents while maintaining privacy, speed, and flexibility.

As autonomous agents increasingly participate in economic activity, a verifiable commitment layer for payment intents will become an important piece of infrastructure.