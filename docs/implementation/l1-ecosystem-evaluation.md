# Layer-1 Ecosystem Evaluation

Which settlement layer should MPCP target next? This document evaluates candidates against the protocol's requirements and recommends a prioritization path.

## Background

MPCP v1.0 defines **XRPL as the sole conforming rail** (see [rails.md](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/rails.md)). The protocol's authorization model — budget pre-reservation, per-payment audit trail, offline verification — maps directly to XRPL primitives (EscrowCreate, transaction memos, `did:xrpl`, XLS-70 Credentials).

Adding a second rail is a protocol-level decision. It requires:

1. **Budget pre-reservation** — the ledger (not the application) must enforce the spending ceiling
2. **Per-payment memo / tagging** — every settlement transaction must carry `grantId` for on-chain audit
3. **Deterministic finality** — confirmation within a timeframe compatible with machine payment UX
4. **Low per-transaction cost** — economically viable for sub-$10 payments

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Stablecoin maturity | High | Regulated, liquid stablecoins available on mainnet |
| Budget reservation primitive | High | Native escrow or equivalent without custom smart contracts |
| Settlement finality | High | Deterministic and fast (seconds, not minutes) |
| Transaction fees | High | Sub-cent for micro-payments |
| Identity / DID support | Medium | On-ledger DID or credential mechanism for key resolution |
| Offline verifier friendliness | Medium | Trust Bundle model works without chain-specific client |
| Developer tooling | Medium | SDK quality, documentation, testnet availability |
| Existing MPCP integration | Low | Current code in `mpcp-reference` for this chain |

## Candidates

### XRPL (current — baseline)

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Stablecoin maturity | Strong | RLUSD (regulated, Ripple-issued); IOU infrastructure mature |
| Budget reservation | Native | `EscrowCreate` / `EscrowFinish` / `EscrowCancel` — first-class ledger primitives |
| Finality | 3–5 s | Deterministic; no forks or re-orgs |
| Fees | ~$0.0001 | Fraction of a cent per transaction |
| Identity | `did:xrpl` | On-ledger DID method; XLS-70 Credentials for grant liveness |
| Offline friendliness | Strong | Trust Bundle + signature verification; no chain client needed |
| Tooling | Good | `xrpl.js`, testnet faucet, well-documented |
| MPCP integration | Deep | Anchor adapters, DID resolver, XLS-70 credential revocation, stablecoin profile, golden vectors |

**Assessment:** Production-ready for MPCP v1.0. No gaps.

---

### Stellar

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Stablecoin maturity | Strong | USDC native on Stellar (Circle); EURC; regulated issuers |
| Budget reservation | Partial | Claimable Balances can pre-reserve funds with time-bound conditions, but lack the conditional-release (preimage) semantics of XRPL escrow. Requires application-level ceiling enforcement. |
| Finality | 5–7 s | Deterministic (SCP consensus); no forks |
| Fees | ~$0.00001 | Extremely low; comparable to XRPL |
| Identity | Weak | No native DID method; SEP-30 (account recovery) is not DID. Would need `did:web` or `did:key` fallback. |
| Offline friendliness | Good | Ed25519 signatures; Trust Bundle model works. No chain-specific barrier. |
| Tooling | Good | `stellar-sdk` (JS), Horizon API, SDF testnet, Soroban for smart contracts |
| MPCP integration | None | No anchor adapter, no DID resolver, no profile |

**Assessment:** Stellar is the strongest second-rail candidate. Stablecoins (USDC) are mature and regulated. Finality and fees are comparable to XRPL. The main gap is budget reservation — Claimable Balances approximate escrow but don't enforce a ceiling natively, so the Trust Gateway would need to manage ceiling logic at the application layer. A Soroban smart contract could provide full escrow semantics, but that adds contract-deployment complexity.

**Recommended path:** Define a `stellar` profile that uses Claimable Balances for reservation and USDC for settlement. Accept that ceiling enforcement is gateway-side (same trust model as `hosted` rail but with on-chain audit). Target as second MPCP rail in a future v1.x revision.

---

### Hedera

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Stablecoin maturity | Moderate | USDC via Hedera Token Service (HTS); HBAR is the native asset. Stablecoin liquidity lower than XRPL or Stellar. |
| Budget reservation | Weak | No native escrow primitive. HTS token transfers are immediate. A custom Hedera Smart Contract Service (HSCS / EVM) contract would be needed, but defeats the "no custom contract" goal. |
| Finality | 3–5 s | Deterministic (hashgraph consensus); no forks |
| Fees | ~$0.001 | Low but ~10x XRPL/Stellar |
| Identity | Moderate | Hedera DID method exists (`did:hedera`); less adopted than `did:xrpl`. |
| Offline friendliness | Good | Ed25519 signatures; HCS provides a tamper-proof log. Trust Bundle model works. |
| Tooling | Moderate | `@hashgraph/sdk` (JS); testnet; HCS well-documented |
| MPCP integration | Moderate | HCS anchor adapter (`hederaHcsAnchorIntentHash`, `verifyHederaHcsAnchor`, `hederaHcsAnchorPolicyDocument`) already in `mpcp-reference`. No settlement profile. |

**Assessment:** Hedera has existing MPCP integration for **policy anchoring** (HCS) but lacks a natural budget-reservation primitive for **settlement**. Adding Hedera as a settlement rail would require an EVM-style escrow contract on HSCS, which introduces the same contract-dependency problem as EVM mainnet. Hedera's strength for MPCP is as an **anchoring layer** (HCS for policy documents and intent hashes), not as a primary settlement rail.

**Recommended path:** Continue using Hedera HCS for anchoring. Do not prioritize as a settlement rail unless HTS adds native escrow or a standard escrow-service emerges.

---

### EVM (Ethereum, Polygon, Base, Arbitrum)

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Stablecoin maturity | Very strong | USDC, USDT, DAI on all major chains; deepest stablecoin liquidity |
| Budget reservation | Requires contract | No native escrow. Requires a deployed `MpcpEscrow` smart contract. Contract bugs become MPCP bugs. |
| Finality | Varies | Ethereum: ~12 min (probabilistic to finality); L2s (Polygon, Base, Arbitrum): seconds to minutes; varies by chain and bridge assumptions. |
| Fees | Varies | Ethereum: $0.50–$5+ per transaction (unusable for micro-payments). L2s: $0.01–$0.10 (viable but 100x XRPL). |
| Identity | Moderate | `did:ethr` exists; ENS for human-readable names; no native credential system comparable to XLS-70. |
| Offline friendliness | Moderate | ECDSA (secp256k1); Trust Bundle model works but key format differs from Ed25519 (MPCP default). |
| Tooling | Very strong | ethers.js, viem, Hardhat, Foundry; largest developer ecosystem |
| MPCP integration | Minimal | `evm` listed as reserved rail identifier; mock anchor mentions EVM. No adapter, no profile. |

**Assessment:** EVM has the deepest stablecoin ecosystem, but its cost and finality characteristics make it a poor fit for MPCP's micro-payment use cases on L1. L2 chains (Base, Arbitrum) bring costs and finality closer to viability, but introduce bridge trust assumptions. The escrow-via-smart-contract model adds audit surface and deployment complexity that XRPL's native primitives avoid.

**Recommended path:** Define an `evm` profile for L2 chains (Base or Arbitrum) targeting higher-value payments where gas costs are acceptable relative to payment size. Lower priority than Stellar due to the contract-dependency and fee profile. Useful for ecosystems already committed to EVM stablecoins.

---

## Comparison Matrix

| | XRPL | Stellar | Hedera | EVM (L2) |
|---|---|---|---|---|
| Stablecoin | RLUSD | USDC | USDC (HTS) | USDC/USDT |
| Native escrow | Yes | Partial (Claimable Balances) | No | No (contract) |
| Finality | 3–5 s | 5–7 s | 3–5 s | 2–10 s (L2) |
| Fees | ~$0.0001 | ~$0.00001 | ~$0.001 | ~$0.01–0.10 |
| DID method | `did:xrpl` | None native | `did:hedera` | `did:ethr` |
| MPCP code today | Deep | None | Anchoring only | Minimal |
| Per-payment memo | Native | Native (memo field) | HCS (separate log) | Calldata (expensive) |

## Recommendation

**Priority order for next MPCP settlement rail:**

1. **Stellar** — closest to XRPL in fee/finality profile; regulated USDC; Claimable Balances approximate escrow; Ed25519 native (same as MPCP default). Gaps are manageable.
2. **EVM L2 (Base or Arbitrum)** — strong stablecoin liquidity; requires `MpcpEscrow` contract; viable for higher-value payments. Target after Stellar.
3. **Hedera** — continue as anchoring layer (HCS); do not prioritize for settlement unless native escrow emerges.

**Next concrete step:** Create a `stellar` deployment profile (`profiles/stellar-usdc.json`) and a Stellar anchor adapter (`src/anchor/stellarAnchor.ts`) for intent-hash anchoring via Stellar memo. This would be the foundation for a future `allowedRails: ["stellar"]` spec revision.

## See Also

- [Why XRPL](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/overview/why-xrpl.md) — rationale for v1.0 rail choice
- [Payment Rails (spec)](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/rails.md) — normative rail definition
- [XRPL Stablecoin Profile](xrpl-stablecoin-profile.md) — reference profile for XRPL IOUs
- [Reference Profiles](reference-profiles.md) — all named deployment profiles
