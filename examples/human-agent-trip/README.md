# Human-to-Agent Travel Budget Demo

Demonstrates MPCP's human-to-agent delegation pattern: Alice signs a PolicyGrant with her DID key,
delegating an $800 travel budget to her AI trip planner for a 3-day Paris trip.

## Delegation chain

```
Alice (DID key) → PolicyGrant → AI Agent → SBA (TRIP scope) → Trust Gateway → XRPL Settlement
```

This mirrors the fleet pattern exactly:

```
Fleet Operator (DID) → PolicyGrant → Vehicle Wallet → SBA → Trust Gateway → XRPL Settlement
Human (DID)          → PolicyGrant → AI Agent        → SBA → Trust Gateway → XRPL Settlement
```

## What this demo shows

| Feature | Demo behavior |
|---------|--------------|
| `allowedPurposes` | Agent enforces category filter — dining request skipped |
| `revocationEndpoint` | Alice cancels mid-trip; `checkRevocation()` returns `{ revoked: true }` |
| TRIP scope | Single SBA covers all 3 days, agent tracks cumulative spend |
| Budget exceeded | $300 hotel attempt rejected ($550 + $300 > $800) |
| Stateless verifier | Merchant verifies chain without calling Alice's wallet |
| DID-signed PolicyGrant | Human principal, not fleet operator |

## Stops

| # | Service | Amount | Outcome |
|---|---------|--------|---------|
| 1 | Hotel (Mercure Paris) | $250 | Authorized |
| 2 | Eurostar tickets | $120 | Authorized |
| 3 | Restaurant booking | — | Skipped (`travel:dining` not in `allowedPurposes`) |
| 4 | Car rental (Europcar) | $180 | Authorized |
| 5 | Extra hotel night | $300 | Rejected (budget exceeded: $550 + $300 > $800) |

## Key fields

### PolicyGrant (signed by Alice)

```json
{
  "allowedPurposes": ["travel:hotel", "travel:flight", "travel:transport"],
  "revocationEndpoint": "https://wallet.alice.example.com/revoke",
  "issuer": "did:key:z6Mk..."
}
```

### SBA (created by AI agent)

```json
{
  "budgetScope": "TRIP",
  "maxAmountMinor": "80000",
  "actorId": "ai-trip-planner-v2"
}
```

### Revocation check

```javascript
const { revoked, revokedAt } = await checkRevocation(endpoint, grantId);
// → { revoked: true, revokedAt: "2026-04-11T14:22:00Z" }
```

## Run

```bash
npm run build && npm run example:human-agent-trip
```

## See also

- [`docs/profiles/human-agent-profile.md`](../../mpcp-spec/docs/profiles/human-agent-profile.md)
- [`src/protocol/revocation.ts`](../../src/protocol/revocation.ts)
- Fleet trip demo: [`examples/fleet-trip/`](../fleet-trip/)
