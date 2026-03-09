# SignedBudgetAuthorization (SBA)

The **SignedBudgetAuthorization (SBA)** establishes the maximum spending envelope available to a machine for a session or scope.

It is issued after a PolicyGrant and constrains subsequent SignedPaymentAuthorizations (SPAs).

---

## Structure

### SessionBudgetAuthorization (inner payload)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | number | yes | Protocol version (e.g. 1) |
| budgetId | string | yes | Unique identifier for this budget |
| sessionId | string | yes | Session this budget applies to |
| vehicleId | string | yes | Vehicle identifier |
| scopeId | string | no | Optional scope identifier |
| policyHash | string | yes | Hash of the policy that authorized this budget |
| currency | string | yes | Reference currency (e.g. "USD") |
| minorUnit | number | yes | Decimal scale (e.g. 2) |
| budgetScope | string | yes | SESSION \| DAY \| VEHICLE \| FLEET |
| maxAmountMinor | string | yes | Maximum spend in minor units |
| allowedRails | Rail[] | yes | Permitted payment rails (xrpl, evm, stripe, hosted) |
| allowedAssets | Asset[] | yes | Permitted assets |
| destinationAllowlist | string[] | yes | Allowed destination addresses |
| expiresAt | string | yes | ISO 8601 expiration timestamp |

### SignedSessionBudgetAuthorization (envelope)

| Field | Type | Description |
|-------|------|-------------|
| authorization | SessionBudgetAuthorization | The budget payload |
| signature | string | Base64-encoded RSA signature over SHA256(canonicalJson(authorization)) |
| keyId | string | Signing key identifier for verification |

---

## Example

```json
{
  "authorization": {
    "version": 1,
    "budgetId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionId": "sess_456",
    "vehicleId": "veh_001",
    "policyHash": "a1b2c3...",
    "currency": "USD",
    "minorUnit": 2,
    "budgetScope": "SESSION",
    "maxAmountMinor": "3000",
    "allowedRails": ["xrpl"],
    "allowedAssets": [{ "kind": "IOU", "currency": "USDC", "issuer": "rIssuer..." }],
    "destinationAllowlist": ["rDest..."],
    "expiresAt": "2026-03-08T14:00:00Z"
  },
  "signature": "base64...",
  "keyId": "mpcp-sba-signing-key-1"
}
```

---

## Verification

A verifier MUST:

1. Validate the signature over `canonicalJson(authorization)` using the public key for `keyId`
2. Check `expiresAt` has not passed
3. When verifying against a PaymentPolicyDecision: ensure sessionId, policyHash, budgetScope, allowedRails, allowedAssets, and amount constraints match

---

## Relationship to Pipeline

```
PolicyGrant
    ↓
SignedBudgetAuthorization (SBA)
    ↓
SignedPaymentAuthorization (SPA)
    ↓
Settlement
```
