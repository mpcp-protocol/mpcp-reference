# Intent Anchoring (PR10)

Optional support for publishing intent hashes to distributed ledgers. Provides public auditability, dispute protection, and replay protection.

**Mock anchor** is included for development. **Hedera HCS** adapter is implemented (PR14). XRPL and EVM are future work.

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
import { computeSettlementIntentHash, mockAnchorIntentHash, hederaHcsAnchorIntentHash } from "mpcp-service";

const intent = { version: "1.0", rail: "xrpl", amount: "1000", destination: "rDest..." };
const intentHash = computeSettlementIntentHash(intent);

// Mock anchor (development)
const mockResult = await mockAnchorIntentHash(intentHash, { rail: "mock" });
// { rail: "mock", txHash: "mock-...", anchoredAt: "..." }

// Hedera HCS (requires @hashgraph/sdk, HEDERA_OPERATOR_*, HEDERA_TOPIC_ID)
const hederaResult = await hederaHcsAnchorIntentHash(intentHash, { rail: "hedera-hcs" });
// { rail: "hedera-hcs", topicId, sequenceNumber, intentHash, anchoredAt }
```

## Anchor Result

```typescript
interface AnchorResult {
  rail: AnchorRail;
  txHash?: string;           // XRPL, EVM transaction hash
  reference?: string;        // Rail-neutral reference (e.g. topicId:sequenceNumber)
  consensusTimestamp?: string; // Hedera HCS (ISO 8601)
  topicId?: string;          // Hedera HCS
  sequenceNumber?: string;   // Hedera HCS
  intentHash?: string;        // For verification
  anchoredAt?: string;       // ISO 8601
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

## Hedera HCS Adapter (PR14)

The Hedera HCS adapter publishes intent hashes to a Hedera Consensus Service topic.

**Requirements:**
- `npm install @hashgraph/sdk` (optional peer dependency; install when using Hedera HCS)
- `HEDERA_OPERATOR_ACCOUNT_ID` — Operator account ID
- `HEDERA_OPERATOR_PRIVATE_KEY` — Operator private key (DER or hex)
- `HEDERA_TOPIC_ID` — HCS topic ID
- `HEDERA_NETWORK` (optional) — `testnet` or `mainnet`, default `testnet`

**Verification:** Use `verifyDisputedSettlementAsync` for full verification against the Hedera mirror node. The sync `verifyDisputedSettlement` accepts hedera-hcs anchors when `intentHash` is present in the anchor result.
