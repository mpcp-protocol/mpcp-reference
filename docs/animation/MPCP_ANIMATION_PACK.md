---

# 1. Narration Script (≈60–90 seconds)

## Scene 1 — The Problem
Visual:
Robots, vehicles, EV chargers, and AI agents attempting to pay for services.

Narration:
"Machines are starting to transact in the real world — paying for parking, charging, tolls, and services."

"Today these payments rely on proprietary APIs and centralized systems. There is no standard way to authorize machine payments, verify them, or resolve disputes."

---

## Scene 2 — Existing Agent Protocols
Visual:
Nodes labeled MCP, A2A, ACP connected with arrows.

Narration:
"New protocols help agents talk to tools and to each other…"

"But they do not solve how machines safely authorize and verify payments."

---

## Scene 3 — Introducing MPCP
Visual stack:

Fleet Policy
↓
PolicyGrant
↓
SignedBudgetAuthorization (SBA)
↓
Trust Gateway
↓
XRPL Settlement

Narration:
"MPCP introduces a simple chain of authorization for machine payments."

"Policies define payment rules. Budgets define per-payment limits. The Trust Gateway verifies the chain and executes on XRPL, attaching a grant ID to every transaction for a permanent audit trail."

---

## Scene 4 — Visual Demo (Autonomous Parking)
Visual sequence:
1. Autonomous vehicle enters parking garage
2. PolicyGrant appears
3. SignedBudgetAuthorization (SBA) appears
4. Trust Gateway verifies chain
5. XRPL settlement confirmation with mpcp/grant-id memo

Narration:
"A vehicle receives a policy defining where and how it can pay."

"A budget authorization allows spending within defined limits for this payment."

"The Trust Gateway verifies the authorization chain and submits the XRPL transaction."

"The final settlement records the completed transaction on-chain."

---

## Scene 5 — Policy Anchoring
Visual:
Policy document hash flowing into a public ledger (Hedera HCS).

Narration:
"An optional anchorRef on the PolicyGrant links it to a public ledger record — providing tamper-evident policy history for audit and dispute resolution."

---

## Scene 6 — Dispute Verification
Visual:
Verification chain replay.

Narration:
"Any dispute can be independently verified using the MPCP authorization chain and the on-chain XRPL audit trail."

---

## Closing Frame
Comparison:

MCP → tools
A2A → agents
ACP → messaging
MPCP → payments

Narration:
"MPCP is the missing layer for verifiable machine payments."

---

# 2. Storyboard

Scene 1
Machines attempting digital payments
Text overlay: "Machine payments are growing"

Scene 2
Agent protocol network diagram
Text overlay: "Protocols exist for agent communication"

Scene 3
MPCP layered authorization chain
Blocks stacking vertically

Scene 4
Autonomous parking example
Vehicle enters → policy → budget → Trust Gateway → XRPL settlement

Scene 5
Policy document anchored to ledger (Hedera HCS)

Scene 6
Verification replay animation

Closing
Protocol comparison diagram

---

# 3. AI Video Generation Prompts

## Prompt 1 — Machine Economy
"minimalist tech animation, autonomous vehicles robots EV chargers AI agents interacting with digital payment systems, clean vector style, dark background, glowing network connections"

## Prompt 2 — Agent Protocol Landscape
"clean animated diagram showing protocols MCP A2A ACP communicating between agents and tools, arrows moving between nodes, modern developer diagram style"

## Prompt 3 — MPCP Authorization Chain
"layered protocol diagram animation PolicyGrant SignedBudgetAuthorization Trust Gateway XRPL Settlement blocks stacking vertically with glowing arrows"

## Prompt 4 — Autonomous Parking Payment
"autonomous car entering smart parking garage, digital authorization layers appearing around vehicle, futuristic payment confirmation animation"

## Prompt 5 — Policy Anchoring
"cryptographic policy document transforming into glowing data stream entering blockchain ledger block, modern protocol visualization"

## Prompt 6 — Dispute Verification
"digital verification chain lighting up sequentially representing audit verification process"

---

# 4. Visual Asset Guide

Icons
- autonomous vehicle
- EV charger
- robot / AI agent
- parking garage
- blockchain ledger

Protocol blocks
- Fleet Policy
- PolicyGrant
- SignedBudgetAuthorization (SBA)
- Trust Gateway
- XRPL Settlement

Animation style
- minimal vector graphics
- dark or neutral background
- glowing connection lines
- subtle motion transitions

Recommended tools
- Runway
- Pika
- Luma
- Nano Banana
- Figma + After Effects
