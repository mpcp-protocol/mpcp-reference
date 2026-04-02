# XRPL Stablecoin Profile

MPCP reference profile for **XRPL issued assets** (IOUs / stablecoins). Makes MPCP concrete for real XRPL-based machine payments.

## Overview

This profile defines how MPCP artifacts are used with XRPL issued currencies such as RLUSD or other stablecoins. It specifies payment constraints, wallet expectations, and verifier requirements for stablecoin settlement on XRPL via the Trust Gateway.

## Asset Constraints

| Field | Constraint |
|-------|------------|
| `kind` | `IOU` (XRPL issued asset) |
| `currency` | 3-character code (e.g. `RLUSD`, `USD`) |
| `issuer` | XRPL account address (e.g. `rIssuer`) |

**Decimals:** XRPL IOUs typically use 6 decimal places. Amounts in MPCP are expressed in the asset's smallest unit (e.g. `19440000` = 19.44 RLUSD).

**Issuer validation:** Wallets and verifiers MUST validate that the issuer in MPCP artifacts matches the trusted issuer for the currency. Do not accept arbitrary issuers.

## Policy Shape

Policies using this profile must include:

- `allowedRails`: `["xrpl"]`
- `allowedAssets`: Array of `{ kind: "IOU", currency: string, issuer: string }`
- `destinationAllowlist` (in SBA): XRPL account addresses allowed as payment destinations
- `maxAmountMinor`, `expiresAt` per standard MPCP
- `anchorRef` (optional): on-chain policy document anchor (`hcs:{topicId}:{seq}` or `xrpl:nft:{tokenId}`)

## Wallet Expectations

A machine wallet implementing this profile MUST:

1. **Validate issuer** — Only issue SBAs for assets whose issuer is in the trusted set
2. **Respect destination allowlist** — SBA destination must be in the `destinationAllowlist`
3. **Amount precision** — Use 6 decimals for RLUSD-style assets; amounts are in smallest units
4. **Present SBA to Trust Gateway** — The Trust Gateway executes the XRPL payment; wallet does not submit directly

## Verifier Expectations

A verifier (e.g. parking meter, charging station) MUST:

1. **Verify the chain** — PolicyGrant → SBA → Settlement
2. **Check asset consistency** — Same `currency` and `issuer` across all artifacts
3. **Validate destination** — Settlement destination matches SBA and is in SBA allowlist
4. **Validate amount** — Settlement amount ≤ SBA maxAmountMinor
5. **Check issuer** — Issuer is in the verifier's trusted issuer list for that currency

## Trust Gateway Integration

All XRPL payments for this profile MUST flow through the Trust Gateway:

- Trust Gateway verifies the PolicyGrant → SBA chain
- Trust Gateway submits the XRPL IOU payment
- Every XRPL transaction includes an `mpcp/grant-id` memo for on-chain audit trail

## Verification Guidance

Use `mpcp verify` on any artifact bundle:

```bash
mpcp verify examples/xrpl-stablecoin/xrpl-stablecoin-bundle.json
mpcp verify examples/xrpl-stablecoin/xrpl-stablecoin-bundle.json --explain
```

For policy validation:

```bash
mpcp policy-summary profiles/xrpl-stablecoin.json --profile xrpl-stablecoin
```

**Verification checklist:**

- [ ] All artifacts present (policyGrant, sba, settlement)
- [ ] Signature valid for SBA
- [ ] Asset (currency, issuer) consistent across chain
- [ ] Destination in SBA allowlist
- [ ] Amounts non-increasing: settlement ≤ SBA max
- [ ] XRPL transaction memo contains `mpcp/grant-id`

## Example Bundle

See `examples/xrpl-stablecoin/xrpl-stablecoin-bundle.json` for a complete, verifiable bundle conforming to this profile.

## Future: Multi-Issuer

This profile currently assumes a single trusted issuer per currency. Future versions may support multiple issuers (e.g. different RLUSD issuers) with explicit allowlists.
