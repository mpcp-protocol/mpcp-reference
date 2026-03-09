# SignedPaymentAuthorization (SPA)

The **SignedPaymentAuthorization (SPA)** authorizes a specific settlement transaction.

It binds the authorized payment parameters (amount, rail, asset, destination) to a decision and optionally includes an `intentHash` to bind the authorization to a canonical settlement intent.

---

## Structure

### PaymentAuthorization (inner payload)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | number | yes | Protocol version (e.g. 1) |
| decisionId | string | yes | Payment policy decision identifier |
| sessionId | string | yes | Session identifier |
| policyHash | string | yes | Hash of the policy |
| quoteId | string | yes | Settlement quote identifier |
| rail | Rail | yes | Payment rail (xrpl, evm, stripe, hosted) |
| asset | Asset | yes | Asset to settle |
| amount | string | yes | Amount in atomic units |
| destination | string | yes | Destination address |
| intentHash | string | no | SHA256 hex of canonical settlement intent (optional) |
| expiresAt | string | yes | ISO 8601 expiration timestamp |

### SignedPaymentAuthorization (envelope)

| Field | Type | Description |
|-------|------|-------------|
| authorization | PaymentAuthorization | The payment payload |
| signature | string | Base64-encoded RSA signature over SHA256(canonicalJson(authorization)) |
| keyId | string | Signing key identifier for verification |

---

## Example

```json
{
  "authorization": {
    "version": 1,
    "decisionId": "dec_123",
    "sessionId": "sess_456",
    "policyHash": "a1b2c3...",
    "quoteId": "quote_789",
    "rail": "xrpl",
    "asset": { "kind": "IOU", "currency": "USDC", "issuer": "rIssuer..." },
    "amount": "19440000",
    "destination": "rDest...",
    "intentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "expiresAt": "2026-03-08T14:00:00Z"
  },
  "signature": "base64...",
  "keyId": "mpcp-spa-signing-key-1"
}
```

---

## Verification

A verifier MUST:

1. Validate the signature over `canonicalJson(authorization)` using the public key for `keyId`
2. Check `expiresAt` has not passed
3. When verifying against a SettlementResult: ensure decisionId, rail, amount, destination, and asset match
4. If `intentHash` is present: verify it equals `computeIntentHash(settlementIntent)` for the provided intent

---

## Relationship to Pipeline

```
SignedBudgetAuthorization (SBA)
    ↓
SignedPaymentAuthorization (SPA)
    ↓
Settlement Execution
    ↓
Settlement Verification
```

See [SPA intentHash](./SPA-intentHash.md) for details on the optional intent binding.
