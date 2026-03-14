# Verifier

MPCP settlement verification ensures that an executed transaction matches the authorization chain.

## Verification Pipeline

The verifier runs checks in order:

1. **Schema** — All artifacts parse and validate against expected structure
2. **Linkage** — PolicyGrant → SBA → SPA chain is consistent (sessionId, policyHash, constraints)
3. **Hash** — If intentHash is present, it matches `computeSettlementIntentHash(settlementIntent)`
4. **Policy** — Budget limits, rail/asset/destination constraints, expiration

If any check fails, verification fails with a specific reason.

## What Is Verified

| Check | Description |
|-------|-------------|
| PolicyGrant | ExpiresAt not passed; constraints valid |
| SBA | Signature valid; expiresAt not passed; sessionId, policyHash match |
| SBA → decision | Budget not exceeded; rail, asset, destination in allowlists |
| SPA | Signature valid; expiresAt not passed |
| SPA → settlement | decisionId, rail, amount, destination, asset match executed settlement |
| intentHash | If present, equals hash of settlement intent |

## Usage

```typescript
import { verifySettlement } from "mpcp-service";

const result = verifySettlement(context);

if (result.valid) {
  // Settlement matches authorization chain
} else {
  // result.reason describes the failure
}
```

The `context` includes policyGrant, signedBudgetAuthorization, signedPaymentAuthorization, settlement, paymentPolicyDecision, decisionId, and optional settlementIntent.

## Key Resolution

MPCP signatures include an `issuerKeyId` field that identifies which public key to use for verification. Verifiers resolve the key using one of two mechanisms.

### HTTPS Well-Known (Baseline)

The issuer publishes their public keys at:

```
https://{issuerDomain}/.well-known/mpcp-keys.json
```

Format:

```json
{
  "keys": [
    {
      "keyId": "mpcp-sba-signing-key-1",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n",
      "use": "sba"
    },
    {
      "keyId": "mpcp-spa-signing-key-1",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n",
      "use": "spa"
    }
  ]
}
```

The `issuerKeyId` in the signed envelope identifies which entry to use.

### DID Document (Optional)

For issuers using decentralized identifiers, keys may be resolved via a DID document. The `issuerKeyId` corresponds to a `verificationMethod` in the DID document. DID resolution is an optional enhancement over the HTTPS well-known baseline.

### Inline Keys (Self-Contained Bundles)

Settlement bundles for development and conformance testing may include `sbaPublicKeyPem` and `spaPublicKeyPem` directly. This avoids external resolution and makes bundles self-contained for `mpcp verify`.

---

## Dispute Verification

When a settlement is disputed, `verifyDisputedSettlement` runs full chain verification plus optional ledger anchor verification. If the intent was anchored (e.g., to Hedera HCS), the anchor can be checked against the expected intentHash.

See [Dispute Resolution](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/dispute-resolution.md) for the guide.

## See Also

- [MPCP Reference Flow](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/architecture/reference-flow.md) — End-to-end verification in EV charging
- [Protocol: Artifacts](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/artifacts.md)
- [Protocol: Hashing](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/hashing.md)
- [Reference: CLI](../reference/cli.md) — `mpcp verify` command
