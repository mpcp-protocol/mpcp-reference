#!/usr/bin/env node
/**
 * PR24 — Automated Fleet Trip Demo
 *
 * A robotaxi (EV-001) completes a commercial trip with three service payments:
 *   Stop 1: Toll booth          — $6.00
 *   Stop 2: EV charging station — $18.00
 *   Stop 3: Parking garage      — $12.00   (cumulative: $36.00 of $40.00 budget)
 *   Stop 4: Charging again      — $8.00    REJECTED — budget exceeded ($44 > $40)
 *
 * Post-trip fleet audit:
 *   All 3 settlement bundles verified independently — all pass.
 *   Tamper detection: charging bundle amount modified — audit detects hash mismatch.
 *
 * Key concepts demonstrated:
 *   • Multi-payment session: same PolicyGrant and SBA used across 3 payments
 *   • Cumulative budget enforcement: vehicle wallet tracks spend across stops
 *   • Clean rejection: 4th payment refused before SPA is signed
 *   • destinationAllowlist: only pre-approved service types accepted
 *   • Stateless audit: each bundle verifies independently after the trip
 *   • Tamper detection: any modification to a settled payment is detected
 *
 * Run: npm run build && npm run example:fleet-trip
 */

import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = __dirname;

// ─── Signing keys (ephemeral for demo; production uses HSM-backed long-lived keys) ──
const policyGrantKeys = crypto.generateKeyPairSync("ed25519");
const sbaKeys = crypto.generateKeyPairSync("ed25519");
const spaKeys = crypto.generateKeyPairSync("ed25519");

process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM = policyGrantKeys.privateKey
  .export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM = policyGrantKeys.publicKey
  .export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID = "fleet-policy-grant-key-1";

process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey
  .export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_SBA_SIGNING_KEY_ID = "fleet-sba-signing-key-1";

process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey
  .export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_SPA_SIGNING_KEY_ID = "fleet-spa-signing-key-1";

const {
  createPolicyGrant,
  createSignedPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
  createSignedPaymentAuthorization,
  createSettlementIntent,
  verifySignedBudgetAuthorization,
} = await import("../../dist/sdk/index.js");
const { runVerify } = await import("../../dist/cli/verify.js");

// ─── Trip constants ───────────────────────────────────────────────────────────
const EXPIRY = "2030-12-31T23:59:59Z";
const VEHICLE_ID = "EV-001";
const SESSION_ID = "trip-20260314-EV001";
const ASSET = { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" };
const POLICY_HASH = "a1b2c3d4e5f6";
const SESSION_BUDGET_MINOR = "4000"; // $40.00

const STOPS = [
  {
    label: "Stop 1 — Toll Booth (I-280 N)",
    destination: "rTollBooth",
    decisionId: "dec-toll-001",
    quoteId: "q-toll-001",
    amountFiatMinor: "600",   // $6.00
    amountRail: "6000000",    // 6.00 RLUSD (6 decimals)
    settlementTime: "2026-03-14T09:12:00Z",
    bundleFile: "bundle-stop1-toll.json",
  },
  {
    label: "Stop 2 — EV Charging (ChargePoint SF-04)",
    destination: "rChargingStation",
    decisionId: "dec-charge-001",
    quoteId: "q-charge-001",
    amountFiatMinor: "1800",  // $18.00
    amountRail: "18000000",   // 18.00 RLUSD
    settlementTime: "2026-03-14T10:45:00Z",
    bundleFile: "bundle-stop2-charging.json",
  },
  {
    label: "Stop 3 — Parking Garage (Market St)",
    destination: "rParkingGarage",
    decisionId: "dec-park-001",
    quoteId: "q-park-001",
    amountFiatMinor: "1200",  // $12.00
    amountRail: "12000000",   // 12.00 RLUSD
    settlementTime: "2026-03-14T14:30:00Z",
    bundleFile: "bundle-stop3-parking.json",
  },
];

const REJECTED_STOP = {
  label: "Stop 4 — Charging Station (second session)",
  destination: "rChargingStation", // authorized destination — rejection is purely budget-based
  decisionId: "dec-charge-002",
  quoteId: "q-charge-002",
  amountFiatMinor: "800",   // $8.00 — would bring cumulative to $44.00, exceeding $40.00 budget
  amountRail: "8000000",
  settlementTime: "2026-03-14T17:00:00Z",
};

function separator() {
  console.log("─".repeat(60));
}

// ─── Header ──────────────────────────────────────────────────────────────────
console.log("");
console.log("MPCP Automated Fleet Trip Demo");
console.log("=".repeat(60));
console.log("");
console.log("Vehicle:   EV-001 (robotaxi)");
console.log("Fleet:     fleet-robotaxi-west");
console.log("Trip:      2026-03-14");
console.log(`Budget:    $${(Number(SESSION_BUDGET_MINOR) / 100).toFixed(2)} SESSION`);
console.log("Rail:      XRPL / RLUSD");
console.log("Stops:     Toll → EV Charging → Parking");
console.log("");

// ─── Fleet Backend: issue signed PolicyGrant ─────────────────────────────────
separator();
console.log("[Fleet Backend] Issuing signed PolicyGrant for EV-001");
const policyGrant = createPolicyGrant({
  policyHash: POLICY_HASH,
  allowedRails: ["xrpl"],
  allowedAssets: [ASSET],
  expiresAt: EXPIRY,
});
const signedPolicyGrant = createSignedPolicyGrant(policyGrant, {
  issuer: "did:web:fleet.robotaxi-west.example.com",
});
if (!signedPolicyGrant) throw new Error("Failed to create signed PolicyGrant");

// Flatten signing envelope onto the grant so the verifier finds issuerKeyId + signature at the top level
const signedPolicyGrantFlat = {
  ...policyGrant,
  issuer: signedPolicyGrant.issuer,
  issuerKeyId: signedPolicyGrant.issuerKeyId,
  signature: signedPolicyGrant.signature,
};

console.log(`  ✓ PolicyGrant issued: grantId=${policyGrant.grantId}`);
console.log(`  ✓ Signed by fleet operator (issuerKeyId=${signedPolicyGrant.issuerKeyId})`);
console.log("");

// ─── Vehicle Wallet: pre-load SBA before trip ────────────────────────────────
separator();
console.log("[Vehicle Wallet] Pre-loading SBA before trip starts");
const budgetAuth = createBudgetAuthorization({
  sessionId: SESSION_ID,
  actorId: VEHICLE_ID,
  grantId: policyGrant.grantId,
  policyHash: POLICY_HASH,
  currency: "USD",
  maxAmountMinor: SESSION_BUDGET_MINOR,
  allowedRails: ["xrpl"],
  allowedAssets: [ASSET],
  destinationAllowlist: ["rTollBooth", "rChargingStation", "rParkingGarage"],
  expiresAt: EXPIRY,
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
});
if (!signedBudgetAuth) throw new Error("Failed to create SBA");
console.log(`  ✓ SBA signed: budgetId=${signedBudgetAuth.authorization.budgetId}`);
console.log(`  ✓ Session budget: $${(Number(SESSION_BUDGET_MINOR) / 100).toFixed(2)} for destinations: toll, charging, parking`);
console.log("");

// ─── Vehicle Wallet: cumulative spend tracker ─────────────────────────────────
// The wallet is the session authority — it MUST track cumulative spend.
// Each stop deducts from this counter before a new SPA is signed.
let cumulativeSpentMinor = BigInt(0);

const settledBundles = [];

// ─── Process each stop ────────────────────────────────────────────────────────
for (const stop of STOPS) {
  separator();
  console.log(`[Service Provider] ${stop.label}`);
  console.log(`  Payment request: $${(Number(stop.amountFiatMinor) / 100).toFixed(2)} → ${stop.destination}`);
  console.log("");

  // Build payment policy decision
  const paymentPolicyDecision = {
    decisionId: stop.decisionId,
    policyHash: POLICY_HASH,
    action: "ALLOW",
    reasons: ["Within budget", "Destination authorized"],
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

  // Vehicle wallet: check cumulative budget before signing SPA
  console.log("[Vehicle Wallet] Checking cumulative budget...");
  const budgetCheck = verifySignedBudgetAuthorization(signedBudgetAuth, {
    sessionId: SESSION_ID,
    decision: paymentPolicyDecision,
    cumulativeSpentMinor: cumulativeSpentMinor.toString(),
  });
  if (!budgetCheck.ok) throw new Error(`Unexpected rejection at ${stop.label}: ${budgetCheck.reason}`);

  const spentAfter = cumulativeSpentMinor + BigInt(stop.amountFiatMinor);
  console.log(
    `  ✓ Budget OK: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} spent + $${(Number(stop.amountFiatMinor) / 100).toFixed(2)} = $${(Number(spentAfter) / 100).toFixed(2)} of $${(Number(SESSION_BUDGET_MINOR) / 100).toFixed(2)}`,
  );

  // Create settlement intent + SPA
  const intent = createSettlementIntent({
    rail: "xrpl",
    amount: stop.amountRail,
    destination: stop.destination,
    asset: ASSET,
    createdAt: stop.settlementTime,
  });
  const spa = createSignedPaymentAuthorization(SESSION_ID, paymentPolicyDecision, {
    settlementIntent: intent,
    budgetId: signedBudgetAuth.authorization.budgetId,
  });
  if (!spa) throw new Error(`Failed to create SPA for ${stop.label}`);
  console.log(`  ✓ SPA signed: amount=${stop.amountRail} RLUSD, intentHash bound`);

  // Mock settlement execution
  const settlement = {
    amount: stop.amountRail,
    rail: "xrpl",
    asset: ASSET,
    destination: stop.destination,
    nowISO: stop.settlementTime,
  };

  // Service verifies MPCP chain immediately
  const bundle = {
    settlement,
    settlementIntent: intent,
    spa,
    sba: signedBudgetAuth,
    policyGrant: signedPolicyGrantFlat,
    paymentPolicyDecision,
    sbaPublicKeyPem: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
    spaPublicKeyPem: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
  };
  const bundlePath = join(EXAMPLE_DIR, stop.bundleFile);
  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

  const { ok, output } = runVerify(bundlePath, { explain: true });
  console.log(output);
  if (!ok) {
    console.error(`  ✗ Verification FAILED at ${stop.label}`);
    process.exit(1);
  }
  console.log(`  ✓ Service verified — access granted\n`);

  // Deduct from wallet's cumulative spend counter
  cumulativeSpentMinor = spentAfter;
  settledBundles.push({ stop, bundle, bundlePath });
}

// ─── Stop 4: Budget exceeded ──────────────────────────────────────────────────
separator();
console.log(`[Service Provider] ${REJECTED_STOP.label}`);
console.log(`  Payment request: $${(Number(REJECTED_STOP.amountFiatMinor) / 100).toFixed(2)} → ${REJECTED_STOP.destination}`);
console.log("");

const rejectedDecision = {
  decisionId: REJECTED_STOP.decisionId,
  policyHash: POLICY_HASH,
  action: "ALLOW",
  reasons: [],
  expiresAtISO: EXPIRY,
  rail: "xrpl",
  asset: ASSET,
  priceFiat: { amountMinor: REJECTED_STOP.amountFiatMinor, currency: "USD" },
  chosen: { rail: "xrpl", quoteId: REJECTED_STOP.quoteId },
  settlementQuotes: [
    {
      quoteId: REJECTED_STOP.quoteId,
      rail: "xrpl",
      amount: { amount: REJECTED_STOP.amountRail, decimals: 6 },
      destination: REJECTED_STOP.destination,
      expiresAt: EXPIRY,
      asset: ASSET,
    },
  ],
};

console.log("[Vehicle Wallet] Checking cumulative budget...");
const rejectedBudgetCheck = verifySignedBudgetAuthorization(signedBudgetAuth, {
  sessionId: SESSION_ID,
  decision: rejectedDecision,
  cumulativeSpentMinor: cumulativeSpentMinor.toString(),
});

const wouldSpend = cumulativeSpentMinor + BigInt(REJECTED_STOP.amountFiatMinor);
console.log(
  `  ✗ Budget EXCEEDED: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} spent + $${(Number(REJECTED_STOP.amountFiatMinor) / 100).toFixed(2)} = $${(Number(wouldSpend) / 100).toFixed(2)} > $${(Number(SESSION_BUDGET_MINOR) / 100).toFixed(2)} budget`,
);
console.log(`  ✗ SPA not signed — payment request rejected`);

if (rejectedBudgetCheck.ok) {
  console.error("ERROR: Expected budget_exceeded rejection but got ok");
  process.exit(1);
}
console.log(`  ✓ Wallet correctly refused: reason=${rejectedBudgetCheck.reason}`);
console.log("");

// ─── Post-trip fleet audit ────────────────────────────────────────────────────
separator();
console.log("[Fleet Backend] Post-trip audit — verifying all 3 settlement bundles");
console.log("");

for (const { stop, bundlePath } of settledBundles) {
  const { ok } = runVerify(bundlePath, { explain: false });
  const status = ok ? "✓ PASSED" : "✗ FAILED";
  console.log(
    `  ${status}  ${stop.label.padEnd(42)}  $${(Number(stop.amountFiatMinor) / 100).toFixed(2)}`,
  );
}
console.log("");

// ─── Tamper detection ─────────────────────────────────────────────────────────
separator();
console.log("[Tamper Detection] Modifying the charging bundle (Stop 2) and re-auditing");
console.log("");

const chargingEntry = settledBundles[1];
const tamperedBundle = JSON.parse(JSON.stringify(chargingEntry.bundle));
tamperedBundle.settlement.amount = "19500000"; // changed from 18000000 ($18.00 → $19.50)
const tamperedPath = join(EXAMPLE_DIR, "bundle-stop2-charging-TAMPERED.json");
writeFileSync(tamperedPath, JSON.stringify(tamperedBundle, null, 2));

console.log("  Modified: settlement.amount 18000000 → 19500000 (+$1.50)");
console.log("");

const { ok: tamperedOk, output: tamperedOutput } = runVerify(tamperedPath, { explain: true });
console.log(tamperedOutput);
if (tamperedOk) {
  console.error("ERROR: Expected tamper detection to fail verification");
  process.exit(1);
}
console.log("  ✓ Tamper correctly detected — audit flags the modified bundle\n");

// ─── Trip summary ─────────────────────────────────────────────────────────────
separator();
console.log("Fleet Trip Summary — EV-001");
console.log("");
console.log(
  "  Stop".padEnd(46) +
  "Amount".padEnd(10) +
  "Cumulative",
);
console.log("  " + "─".repeat(65));
let running = BigInt(0);
for (const { stop } of settledBundles) {
  running += BigInt(stop.amountFiatMinor);
  console.log(
    `  ${stop.label.padEnd(44)}` +
    `$${(Number(stop.amountFiatMinor) / 100).toFixed(2).padStart(6)}` +
    `   $${(Number(running) / 100).toFixed(2)} / $${(Number(SESSION_BUDGET_MINOR) / 100).toFixed(2)}`,
  );
}
console.log(
  `\n  ${REJECTED_STOP.label.padEnd(44)}` +
  `$${(Number(REJECTED_STOP.amountFiatMinor) / 100).toFixed(2).padStart(6)}` +
  `   REJECTED (budget_exceeded)`,
);
console.log("");
console.log(`  Total spent: $${(Number(cumulativeSpentMinor) / 100).toFixed(2)} of $${(Number(SESSION_BUDGET_MINOR) / 100).toFixed(2)} budget`);
console.log(`  Remaining:   $${((Number(SESSION_BUDGET_MINOR) - Number(cumulativeSpentMinor)) / 100).toFixed(2)}`);
console.log("");
console.log("  Audit: 3/3 bundles verified  •  1 tampered bundle detected");
console.log("");
separator();
console.log("Trip complete — all payments authorized, cumulative budget enforced.");
console.log("");
