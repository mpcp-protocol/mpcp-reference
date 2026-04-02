# MPCP Reference Profiles

Named deployment profiles for MPCP. Adopters choose a profile instead of inventing their own rules — reducing ambiguity and making integration easier.

## Profiles

| Profile | Use Case | Rails | Offline | Policy Anchor |
|---------|----------|-------|---------|---------------|
| Fleet Offline | Pre-auth budgets, no network at payment | xrpl, evm | yes | optional |
| Parking | Meter/gate, short sessions | xrpl | yes | optional |
| Charging | EV charging, variable session length | xrpl, evm | yes | optional |
| Hosted Rail | Backend-hosted, online approval | stripe, hosted | no | n/a |
| XRPL Stablecoin | RLUSD / issued-asset machine payments | xrpl | yes | optional |

---

## Fleet Offline Profile

**Use case:** Fleet vehicles with pre-authorized spending envelopes. Payment authorization can complete without network at payment time; settlement executes via Trust Gateway when connectivity returns.

**Characteristics:**
- PolicyGrant + SBA loaded before going offline
- SBA verified locally by merchant
- Trust Gateway submits XRPL payment with `mpcp/grant-id` memo when connectivity returns
- Settlement reconciled using on-chain XRPL record

**Policy shape:** `maxSessionSpend`, `allowedRails`, `allowedAssets`, `destinations`, `expiresAt`

**Example:** `profiles/fleet-offline.json`

---

## Parking Profile

**Use case:** Parking meters, garage gates, short sessions.

**Characteristics:**
- Same as Fleet Offline
- Typical session: single parking event
- Destinations: parking operators, garages

**Example:** `profiles/parking.json`

---

## Charging Profile

**Use case:** EV charging stations, variable session length.

**Characteristics:**
- Same as Fleet Offline
- Session may span multiple kWh
- Destinations: charging operators

**Example:** `profiles/charging.json`

---

## Hosted Rail Profile

**Use case:** Backend-hosted payments (Stripe, hosted providers). Online approval required.

**Characteristics:**
- No offline path
- Central approval at payment time
- Rails: stripe, hosted

**Example:** `profiles/hosted-rail.json`

---

## XRPL Stablecoin Profile

**Use case:** XRPL issued assets (IOUs / stablecoins such as RLUSD). Machine payments with explicit issuer and destination constraints.

**Characteristics:**
- Rail: `xrpl` only
- Asset: `kind: IOU`, `currency`, `issuer` — issuer must be validated by wallet/verifier
- Wallet and verifier expectations for stablecoin settlement documented
- All payments flow through Trust Gateway; `mpcp/grant-id` memo attached to every XRPL transaction

**Example:** `profiles/xrpl-stablecoin.json`

**Full profile doc:** [XRPL Stablecoin Profile](xrpl-stablecoin-profile.md)

**Example bundle:** `examples/xrpl-stablecoin/xrpl-stablecoin-bundle.json`

---

## Usage

Profiles define expected policy shape. Use `mpcp policy-summary` with `--profile` to validate a policy against a reference profile.

```bash
mpcp policy-summary profiles/parking.json --profile parking
mpcp policy-summary profiles/xrpl-stablecoin.json --profile xrpl-stablecoin
mpcp policy-summary examples/machine-commerce/fleet-policy.json --profile parking
```

Validation checks: `allowedRails` in the policy must be a subset of the profile's allowed rails; if the policy declares `_profile`, it must match the profile name.
