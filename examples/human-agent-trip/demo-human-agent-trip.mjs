#!/usr/bin/env node
/**
 * Human-to-Agent Travel Budget Demo
 *
 * Alice (DID: did:key:z6Mk...) signs a PolicyGrant delegating an $800 travel budget
 * to her AI trip planner for a 3-day Paris trip.
 *
 * Delegation chain:
 *   Alice (human, DID key) → PolicyGrant → AI Agent → SBA (TRIP) → Trust Gateway → XRPL Settlement
 *
 * Stops:
 *   Stop 1 — Hotel (Mercure Paris)        $250  cumulative: $250  ✓
 *   Stop 2 — Eurostar tickets             $120  cumulative: $370  ✓
 *   Stop 3 — Restaurant booking           SKIPPED (not in allowedPurposes → agent refuses)
 *   Stop 4 — Car rental                   $180  cumulative: $550  ✓
 *   Stop 5 — Excess spend attempt         $300  REJECTED ($850 > $800 budget)
 *
 * Post-trip audit: 3/3 bundles verified
 *
 * Revocation demo:
 *   Alice revokes mid-trip via revocationEndpoint
 *   checkRevocation() → { revoked: true }
 *   Service provider refuses further payments
 *
 * Key concepts demonstrated:
 *   • Human DID as policy authority — PolicyGrant signed by Alice's key
 *   • allowedPurposes — agent enforces merchant category filter (hotel, flight, transport)
 *   • revocationEndpoint — Alice can cancel the travel budget mid-trip
 *   • TRIP scope — budget spans multiple days and sessions
 *   • checkRevocation utility — in-process mock endpoint for demo
 *
 * Run: npm run build && npm run example:human-agent-trip
 */

import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = __dirname;

// ─── Signing keys (ephemeral for demo; production uses Alice's DID key material) ─
const aliceKeys = crypto.generateKeyPairSync("ed25519");   // Alice's human DID key
const sbaKeys = crypto.generateKeyPairSync("ed25519");     // AI Agent session authority key

process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM = aliceKeys.privateKey
  .export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM = aliceKeys.publicKey
  .export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID = "alice-did-key-1";

process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey
  .export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_SBA_SIGNING_KEY_ID = "agent-sba-key-1";

const {
  createPolicyGrant,
  createSignedPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
  checkRevocation,
} = await import("../../dist/sdk/index.js");
const { runVerify } = await import("../../dist/cli/verify.js");

// ─── Mock revocation endpoint (in-process, no HTTP server needed) ─────────────
// In production, this would be Alice's wallet service at https://wallet.alice.example.com/revoke
const REVOCATION_ENDPOINT = "https://wallet.alice.example.com/revoke";
let revoked = false;
let revokedAt = null;

// Intercept fetch for the revocation endpoint
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (typeof url === "string" && url.startsWith(REVOCATION_ENDPOINT)) {
    return {
      ok: true,
      json: async () => ({
        revoked,
        ...(revokedAt ? { revokedAt } : {}),
      }),
    };
  }
  return originalFetch(url, opts);
};

// ─── Trip constants ────────────────────────────────────────────────────────────
const EXPIRY = "2030-12-31T23:59:59Z";
const AGENT_ID = "ai-trip-planner-v2";
const SESSION_ID = "paris-trip-2026-alice";
const ASSET = { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" };
const POLICY_HASH = "a1b2c3d4e5f6";
const TRIP_BUDGET_MINOR = "80000"; // $800.00 (cents)
const ALICE_DID = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

const ALLOWED_PURPOSES = ["travel:hotel", "travel:flight", "travel:transport"];

const STOPS = [
  {
    label: "Stop 1 — Hotel (Mercure Paris)",
    purpose: "travel:hotel",
    destination: "rHotelMercureParis",
    decisionId: "dec-hotel-001",
    quoteId: "q-hotel-001",
    amountFiatMinor: "25000",  // $250.00
    amountRail: "250000000",   // 250.00 RLUSD (6 decimals)
    settlementTime: "2026-04-10T15:00:00Z",
    bundleFile: "bundle-stop1-hotel.json",
  },
  {
    label: "Stop 2 — Eurostar tickets",
    purpose: "travel:flight",
    destination: "rEurostar",
    decisionId: "dec-train-001",
    quoteId: "q-train-001",
    amountFiatMinor: "12000",  // $120.00
    amountRail: "120000000",
    settlementTime: "2026-04-11T08:30:00Z",
    bundleFile: "bundle-stop2-eurostar.json",
  },
  {
    label: "Stop 4 — Car rental (Europcar)",
    purpose: "travel:transport",
    destination: "rEuropcarParis",
    decisionId: "dec-car-001",
    quoteId: "q-car-001",
    amountFiatMinor: "18000",  // $180.00
    amountRail: "180000000",
    settlementTime: "2026-04-12T09:00:00Z",
    bundleFile: "bundle-stop4-car-rental.json",
  },
];

const SKIPPED_STOP = {
  label: "Stop 3 — Restaurant booking (Le Jules Verne)",
  purpose: "travel:dining",  // Not in allowedPurposes
};

const REJECTED_STOP = {
  label: "Stop 5 — Extra hotel night",
  purpose: "travel:hotel",
  destination: "rHotelMercureParis",
  decisionId: "dec-hotel-002",
  quoteId: "q-hotel-002",
  amountFiatMinor: "30000",  // $300.00 — would bring total to $850 > $800
  amountRail: "300000000",
};

function separator() {
  console.log("─".repeat(64));
}

// ─── Header ───────────────────────────────────────────────────────────────────
console.log("");
console.log("MPCP Human-to-Agent Travel Budget Demo");
console.log("=".repeat(64));
console.log("");
console.log("Principal: Alice");
console.log(`DID:       ${ALICE_DID}`);
console.log("Agent:     AI Trip Planner v2");
console.log("Trip:      Paris, 3 days (Apr 10–12 2026)");
console.log(`Budget:    $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)} TRIP scope`);
console.log("Rail:      XRPL / RLUSD");
console.log("Purposes:  travel:hotel, travel:flight, travel:transport");
console.log("");

// ─── Alice: sign PolicyGrant delegating budget to AI agent ────────────────────
separator();
console.log("[Alice] Signing PolicyGrant → delegating travel budget to AI agent");
const policyGrant = createPolicyGrant({
  policyHash: POLICY_HASH,
  allowedRails: ["xrpl"],
  allowedAssets: [ASSET],
  expiresAt: EXPIRY,
  allowedPurposes: ALLOWED_PURPOSES,
  revocationEndpoint: REVOCATION_ENDPOINT,
});

const signedPolicyGrant = createSignedPolicyGrant(policyGrant, {
  issuer: ALICE_DID,
});
if (!signedPolicyGrant) throw new Error("Failed to create signed PolicyGrant");

const signedPolicyGrantFlat = {
  ...policyGrant,
  issuer: signedPolicyGrant.issuer,
  issuerKeyId: signedPolicyGrant.issuerKeyId,
  signature: signedPolicyGrant.signature,
};

console.log(`  ✓ PolicyGrant signed by Alice's DID key`);
console.log(`    grantId:              ${policyGrant.grantId}`);
console.log(`    issuer:               ${ALICE_DID}`);
console.log(`    allowedPurposes:      ${ALLOWED_PURPOSES.join(", ")}`);
console.log(`    revocationEndpoint:   ${REVOCATION_ENDPOINT}`);
console.log(`    budget scope:         TRIP / $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)}`);
console.log("");

// ─── AI Agent: pre-load SBA (TRIP scope) ──────────────────────────────────────
separator();
console.log("[AI Agent] Pre-loading SBA with TRIP scope");
const budgetAuth = createBudgetAuthorization({
  sessionId: SESSION_ID,
  actorId: AGENT_ID,
  grantId: policyGrant.grantId,
  policyHash: POLICY_HASH,
  currency: "USD",
  maxAmountMinor: TRIP_BUDGET_MINOR,
  allowedRails: ["xrpl"],
  allowedAssets: [ASSET],
  destinationAllowlist: ["rHotelMercureParis", "rEurostar", "rEuropcarParis"],
  expiresAt: EXPIRY,
  budgetScope: "TRIP",
});
const signedBudgetAuth = createSignedBudgetAuthorization({
  sessionId: budgetAuth.sessionId,
  actorId: budgetAuth.actorId,
  grantId: policyGrant.grantId,
  policyHash: budgetAuth.policyHash,
  currency: budgetAuth.currency,
  maxAmountMinor: budgetAuth.maxAmountMinor,
  allowedRails: budgetAuth.allowedRails,
  allowedAssets: budgetAuth.allowedAssets,
  destinationAllowlist: budgetAuth.destinationAllowlist,
  expiresAt: budgetAuth.expiresAt,
  budgetScope: "TRIP",
});
if (!signedBudgetAuth) throw new Error("Failed to create SBA");
console.log(`  ✓ SBA signed (TRIP scope): budgetId=${signedBudgetAuth.authorization.budgetId}`);
console.log(`  ✓ Budget: $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)} across full trip`);
console.log("");

// ─── AI Agent: cumulative spend tracker ───────────────────────────────────────
let cumulativeSpentMinor = BigInt(0);
const settledBundles = [];

// ─── Stop 3: Agent refuses — purpose not in allowedPurposes ──────────────────
separator();
console.log(`[Service Provider] ${SKIPPED_STOP.label}`);
console.log(`  Purpose:  ${SKIPPED_STOP.purpose}`);
console.log("");
console.log("[AI Agent] Checking purpose against PolicyGrant.allowedPurposes...");
const purposeAllowed = policyGrant.allowedPurposes?.includes(SKIPPED_STOP.purpose) ?? true;
if (!purposeAllowed) {
  console.log(`  ✗ Purpose '${SKIPPED_STOP.purpose}' not in allowedPurposes`);
  console.log(`    Allowed: ${ALLOWED_PURPOSES.join(", ")}`);
  console.log(`  → Agent refuses to submit SBA. No payment.`);
}
console.log("");

// ─── Process approved stops ───────────────────────────────────────────────────
for (const stop of STOPS) {
  separator();
  console.log(`[Service Provider] ${stop.label}`);
  console.log(`  Purpose:  ${stop.purpose}  |  Amount: $${(Number(stop.amountFiatMinor) / 100).toFixed(2)} → ${stop.destination}`);
  console.log("");

  // AI Agent: purpose check
  const allowed = policyGrant.allowedPurposes?.includes(stop.purpose) ?? true;
  if (!allowed) {
    console.log(`  ✗ Purpose '${stop.purpose}' not allowed — agent refuses`);
    continue;
  }
  console.log(`  ✓ Purpose '${stop.purpose}' permitted`);

  // AI Agent: manual budget check (TRIP scope spans multiple sessions)
  const spentAfter = cumulativeSpentMinor + BigInt(stop.amountFiatMinor);
  if (spentAfter > BigInt(TRIP_BUDGET_MINOR)) {
    console.log(`  ✗ Budget EXCEEDED: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} + $${(Number(stop.amountFiatMinor) / 100).toFixed(2)} > $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)}`);
    continue;
  }
  console.log(
    `  ✓ Budget OK: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} + $${(Number(stop.amountFiatMinor) / 100).toFixed(2)} = $${(Number(spentAfter) / 100).toFixed(2)} of $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)}`,
  );

  // Create payment
  const paymentPolicyDecision = {
    decisionId: stop.decisionId,
    policyHash: POLICY_HASH,
    action: "ALLOW",
    reasons: ["Within budget", "Purpose authorized", "Destination authorized"],
    expiresAtISO: EXPIRY,
    rail: "xrpl",
    asset: ASSET,
    priceFiat: { amountMinor: stop.amountFiatMinor, currency: "USD" },
    chosen: { rail: "xrpl", quoteId: stop.quoteId },
    settlementQuotes: [
      {
        quoteId: stop.quoteId,
        rail: "xrpl",
        amount: { amount: stop.amountRail, decimals: 6 },
        destination: stop.destination,
        expiresAt: EXPIRY,
        asset: ASSET,
      },
    ],
  };

  console.log(`  ✓ SBA submitted to Trust Gateway → XRPL payment: amount=${stop.amountRail} RLUSD`);

  const settlement = {
    amount: stop.amountRail,
    rail: "xrpl",
    asset: ASSET,
    destination: stop.destination,
    nowISO: stop.settlementTime,
  };

  const bundle = {
    settlement,
    sba: signedBudgetAuth,
    policyGrant: signedPolicyGrantFlat,
    paymentPolicyDecision,
    sbaPublicKeyPem: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
  };
  const bundlePath = join(EXAMPLE_DIR, stop.bundleFile);
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

  const { ok, output } = runVerify(bundlePath, { explain: true });
  console.log(output);
  if (!ok) {
    console.error(`  ✗ Verification FAILED at ${stop.label}`);
    process.exit(1);
  }
  console.log(`  ✓ Merchant verified chain — service granted\n`);

  cumulativeSpentMinor = spentAfter;
  settledBundles.push({ stop, bundle, bundlePath });
}

// ─── Stop 5: Budget exceeded ──────────────────────────────────────────────────
separator();
console.log(`[Service Provider] ${REJECTED_STOP.label}`);
console.log(`  Purpose:  ${REJECTED_STOP.purpose}  |  Amount: $${(Number(REJECTED_STOP.amountFiatMinor) / 100).toFixed(2)}`);
console.log("");
console.log("[AI Agent] Checking cumulative budget...");
const wouldSpend = cumulativeSpentMinor + BigInt(REJECTED_STOP.amountFiatMinor);
console.log(
  `  ✗ Budget EXCEEDED: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} spent + $${(Number(REJECTED_STOP.amountFiatMinor) / 100).toFixed(2)} = $${(Number(wouldSpend) / 100).toFixed(2)} > $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)} budget`,
);
console.log(`  ✗ SBA not submitted — payment refused`);
console.log("");

// ─── Post-trip audit ──────────────────────────────────────────────────────────
separator();
console.log("[Post-trip audit] Verifying all 3 settlement bundles independently");
console.log("");
for (const { stop, bundlePath } of settledBundles) {
  const { ok } = runVerify(bundlePath, { explain: false });
  const status = ok ? "✓ PASSED" : "✗ FAILED";
  console.log(
    `  ${status}  ${stop.label.padEnd(40)}  $${(Number(stop.amountFiatMinor) / 100).toFixed(2)}`,
  );
}
console.log("");

// ─── Revocation demo ──────────────────────────────────────────────────────────
separator();
console.log("[Revocation Demo] Alice cancels the travel budget mid-trip");
console.log("");

// Step 1: check before revocation
const checkBefore = await checkRevocation(REVOCATION_ENDPOINT, policyGrant.grantId);
console.log(`  checkRevocation() before revocation: revoked=${checkBefore.revoked}`);
console.log(`  ✓ Grant is still active — payments permitted`);
console.log("");

// Step 2: Alice revokes
const revokedTimestamp = new Date().toISOString();
revoked = true;
revokedAt = revokedTimestamp;
console.log(`  [Alice's wallet] Grant revoked at ${revokedTimestamp}`);
console.log("");

// Step 3: merchant checks revocation before next payment
const checkAfter = await checkRevocation(REVOCATION_ENDPOINT, policyGrant.grantId);
console.log(`  checkRevocation() after revocation:  revoked=${checkAfter.revoked}  revokedAt=${checkAfter.revokedAt}`);
console.log("");
if (checkAfter.revoked) {
  console.log(`  ✗ Grant revoked — service provider refuses further payments`);
  console.log(`    (MPCP verifier stays stateless; revocation is a separate online check)`);
}
console.log("");

// ─── Trip summary ─────────────────────────────────────────────────────────────
separator();
console.log("Trip Summary — Alice's Paris Trip");
console.log("");
console.log("  Stop".padEnd(46) + "Amount".padEnd(10) + "Cumulative");
console.log("  " + "─".repeat(66));
let running = BigInt(0);
for (const { stop } of settledBundles) {
  running += BigInt(stop.amountFiatMinor);
  console.log(
    `  ${stop.label.padEnd(44)}` +
    `$${(Number(stop.amountFiatMinor) / 100).toFixed(2).padStart(6)}` +
    `   $${(Number(running) / 100).toFixed(2)} / $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)}`,
  );
}
console.log(
  `\n  ${SKIPPED_STOP.label.padEnd(44)}` +
  `${"  —   ".padStart(6)}` +
  `   SKIPPED (purpose: travel:dining not allowed)`,
);
console.log(
  `\n  ${REJECTED_STOP.label.padEnd(44)}` +
  `$${(Number(REJECTED_STOP.amountFiatMinor) / 100).toFixed(2).padStart(6)}` +
  `   REJECTED (budget_exceeded)`,
);
console.log("");
console.log(`  Total spent: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} of $${(Number(TRIP_BUDGET_MINOR) / 100).toFixed(2)} budget`);
console.log(`  Remaining:   $${((Number(TRIP_BUDGET_MINOR) - Number(cumulativeSpentMinor)) / 100).toFixed(2)}`);
console.log("");
console.log("  Audit: 3/3 bundles verified  •  1 revocation detected  •  2 payments refused");
console.log("");
separator();
console.log("Trip complete — human-to-agent delegation demonstrated.");
console.log("");
