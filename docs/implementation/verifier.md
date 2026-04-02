# Verifier

MPCP settlement verification ensures that an executed transaction matches the authorization chain.

## Verification Pipeline

The verifier runs checks in order:

1. **Schema** — All artifacts parse and validate against expected structure
2. **Linkage** — PolicyGrant → SBA chain is consistent (sessionId, policyHash, constraints)
3. **Policy** — Budget limits, rail/asset/destination constraints, expiration
4. **Anchor** (optional) — If `anchorRef` is present on the PolicyGrant, the on-chain policy document can be verified

If any check fails, verification fails with a specific reason.

## What Is Verified

| Check | Description |
|-------|-------------|
| PolicyGrant | ExpiresAt not passed; constraints valid |
| SBA | Signature valid; expiresAt not passed; sessionId, policyHash match |
| SBA → decision | Budget not exceeded; rail, asset, destination in allowlists |
| Settlement | Amount, rail, destination, asset match SBA constraints |
| anchorRef | If present on PolicyGrant, format validated (`hcs:{topicId}:{seq}` or `xrpl:nft:{tokenId}`) |

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

The `context` includes policyGrant, signedBudgetAuthorization, settlement, paymentPolicyDecision, and decisionId.

## Key Resolution

MPCP signatures include an `issuerKeyId` field that identifies which public key to use for verification. When the SBA or PolicyGrant envelope also includes `issuer`, verifiers can resolve keys offline from Trust Bundles.

Verifiers resolve the signing key using the following 3-step algorithm (in order of precedence):

### 1. Trust Bundle (Preferred — Offline)

For fleet and embedded deployments, key resolution uses pre-distributed Trust Bundles. The verifier looks up the `issuer` in the bundle's `issuers` list and retrieves the JWK by `issuerKeyId`. This path works fully offline.

The `issuer` field in the SBA/PolicyGrant envelope is **required** when the verifier uses Trust Bundle key resolution.

Pass `trustBundles` to the verifier options to enable this path:

```typescript
const result = verifySettlement({
  ...context,
  trustBundles: [verifiedBundle],
});
```

### 2. Pre-Configured Key

If no Trust Bundle matches, the verifier falls back to a pre-configured public key. Set `MPCP_SBA_SIGNING_PUBLIC_KEY_PEM` (for SBAs) or `MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM` (for PolicyGrants) as environment variables.

### 3. HTTPS Well-Known

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
    }
  ]
}
```

The `issuerKeyId` in the signed envelope identifies which entry to use.

> **Note:** HTTPS well-known is not yet implemented in the reference SDK. The current implementation covers steps 1 and 2.

### DID Document (Optional)

For issuers using decentralized identifiers, keys may be resolved via a DID document. The `issuerKeyId` corresponds to a `verificationMethod` in the DID document. DID resolution is an optional enhancement.

### Inline Keys (Self-Contained Bundles)

Settlement bundles for development and conformance testing may include `sbaPublicKeyPem` directly. This avoids external resolution and makes bundles self-contained for `mpcp verify`.

---

## Dispute Verification

When a settlement is disputed, `verifyDisputedSettlement` runs full chain verification plus optional policy anchor verification. If the PolicyGrant has an `anchorRef` (e.g., to Hedera HCS or XRPL NFT), the anchor can be checked to confirm the policy document was published before the settlement.

See [Dispute Resolution](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/guides/dispute-resolution.md) for the guide.

## See Also

- [MPCP Reference Flow](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/architecture/reference-flow.md) — End-to-end verification in EV charging
- [Protocol: Artifacts](https://github.com/mpcp-protocol/mpcp-spec/blob/main/docs/protocol/artifacts.md)
- [Reference: CLI](../reference/cli.md) — `mpcp verify` command
