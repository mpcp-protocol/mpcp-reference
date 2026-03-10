# Intent Anchoring (PR10)

Optional support for publishing intent hashes to distributed ledgers. Provides public auditability, dispute protection, and replay protection.

**This PR provides only the mock anchor implementation.** Real ledger adapters (Hedera HCS, XRPL, EVM) are future work.

## Purpose

- **Public auditability** — Intent hashes can be verified against a public record
- **Dispute protection** — Timestamped proof of intent before settlement
- **Replay protection** — Ledger sequence provides ordering and uniqueness

## Supported Rails

| Rail | Description |
|------|-------------|
| Hedera HCS | Hashgraph Consensus Service topic |
| XRPL | XRP Ledger memo or dedicated table |
| EVM | Ethereum / EVM-compatible chain |
| mock | Development and testing (no ledger) |

## Usage

```typescript
import { computeSettlementIntentHash, mockAnchorIntentHash } from "mpcp-service";

const intent = { version: "1.0", rail: "xrpl", amount: "1000", destination: "rDest..." };
const intentHash = computeSettlementIntentHash(intent);

// Mock anchor (development) — only supports rail "mock"
const result = await mockAnchorIntentHash(intentHash, { rail: "mock" });
// { rail: "mock", txHash: "mock-...", anchoredAt: "..." }
```

## Anchor Result

```typescript
interface AnchorResult {
  rail: AnchorRail;
  txHash?: string;      // XRPL, EVM; Hedera consensus timestamp
  topicId?: string;    // Hedera HCS
  sequenceNumber?: string;
  anchoredAt?: string; // ISO 8601
}
```

## Integration

Anchoring is **optional**. MPCP verification does not require an anchor. Anchors are used for:

- Dispute resolution (PR11)
- Audit trails
- Compliance and attestation

## Mock Anchor

The `mockAnchorIntentHash` function simulates anchoring without contacting a ledger. Use for:

- Development
- Testing
- Demos

**Validation:** Requires 64-char hex intentHash. Throws on invalid input. Only accepts `rail: "mock"` — passing other rails throws to avoid confusion with real ledger behavior.

Real ledger integrations (Hedera HCS, XRPL, EVM) would be implemented as separate adapters.
