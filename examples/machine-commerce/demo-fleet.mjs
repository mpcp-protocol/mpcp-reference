#!/usr/bin/env node
/**
 * PR8B — Automated Fleet Payment Demo
 *
 * Demonstrates the complete machine-to-machine payment loop:
 * Parking Service → Vehicle Agent → Settlement Rail → Verifier → Gate
 *
 * Components:
 * - Vehicle Agent: MPCP SDK, wallet, policy + budget enforcement
 * - Parking Service: payment request, MPCP verification
 * - Settlement Rail Adapter: mock execution
 * - Verifier: validates PolicyGrant → SBA → SPA → SettlementIntent chain
 *
 * Run: npm run build && npm run example:fleet
 */
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = __dirname;

// Vehicle Agent: ephemeral signing keys (simulates onboard wallet)
const sbaKeys = crypto.generateKeyPairSync("ed25519");
const spaKeys = crypto.generateKeyPairSync("ed25519");
process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";

const {
  createPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
  createSignedPaymentAuthorization,
  createSettlementIntent,
} = await import("../../dist/sdk/index.js");
const { runVerify } = await import("../../dist/cli/verify.js");

const EXPIRY = "2030-12-31T23:59:59Z";
const SETTLEMENT_NOW = "2026-01-15T12:00:00Z";
const policyHash = "a1b2c3d4e5f6";

function log(msg) {
  console.log(msg);
}

log("");
log("MPCP Automated Fleet Payment Demo");
log("=========================================");
log("");
log("Machine-to-machine payment loop:");
log("  Robotaxi enters parking → meter sends request → vehicle signs SPA");
log("  → rail executes → meter verifies chain → gate opens");
log("");

// ─── Parking Service: payment request ───────────────────────────────────────
log("[Parking Service] Sending payment request");
const paymentRequest = {
  amountMinor: "540", // $5.40 USD
  amountRail: "5400000", // 5.40 RLUSD (6 decimals)
  destination: "rParkingMeter",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  rail: "xrpl",
};
log(`  Request: $${(Number(paymentRequest.amountMinor) / 100).toFixed(2)} → ${paymentRequest.destination}`);
log("");

// ─── Vehicle Agent: evaluate policy + budget, generate MPCP artifacts ───────
log("[Vehicle Agent] Evaluating fleet policy and session budget");
const policyGrant = createPolicyGrant({
  policyHash,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: EXPIRY,
});
const budgetAuth = createBudgetAuthorization({
  sessionId: "22222222-2222-4222-8222-222222222222",
  actorId: "veh-robotaxi-001",
  grantId: policyGrant.grantId,
  policyHash,
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rParkingMeter", "rChargingStation"],
  expiresAt: EXPIRY,
});
log(`  Policy: rails=[xrpl], max session $30.00`);
log(`  Budget: within limit ($${(Number(paymentRequest.amountMinor) / 100).toFixed(2)} < $30.00)`);
log("");

log("[Vehicle Agent] Generating SettlementIntent and SPA");
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

const intent = createSettlementIntent({
  rail: paymentRequest.rail,
  amount: paymentRequest.amountRail,
  destination: paymentRequest.destination,
  asset: paymentRequest.asset,
  createdAt: SETTLEMENT_NOW,
});
const paymentPolicyDecision = {
  decisionId: "dec-fleet-1",
  policyHash,
  action: "ALLOW",
  reasons: ["Within budget", "Destination allowed"],
  expiresAtISO: EXPIRY,
  rail: paymentRequest.rail,
  asset: paymentRequest.asset,
  priceFiat: { amountMinor: paymentRequest.amountMinor, currency: "USD" },
  chosen: { rail: paymentRequest.rail, quoteId: "q-fleet-1" },
  settlementQuotes: [
    {
      quoteId: "q-fleet-1",
      rail: paymentRequest.rail,
      amount: { amount: paymentRequest.amountRail, decimals: 6 },
      destination: paymentRequest.destination,
      expiresAt: EXPIRY,
      asset: paymentRequest.asset,
    },
  ],
};
const signedPaymentAuth = createSignedPaymentAuthorization(
  budgetAuth.sessionId,
  paymentPolicyDecision,
  { settlementIntent: intent, budgetId: signedBudgetAuth.authorization.budgetId },
);
if (!signedPaymentAuth) throw new Error("Failed to create SPA");
log(`  ✓ SPA signed: amount=${intent.amount}, destination=${intent.destination}`);
log("");

// ─── Settlement Rail Adapter: execute payment ──────────────────────────────
log("[Settlement Rail Adapter] Executing payment on rail");
const settlement = {
  amount: intent.amount,
  rail: intent.rail,
  asset: intent.asset,
  destination: intent.destination,
  nowISO: SETTLEMENT_NOW,
};
log(`  ✓ Executed: ${settlement.amount} → ${settlement.destination}`);
log("");

// ─── Verifier (Parking Service): validate MPCP chain ────────────────────────
log("[Verifier] Parking Service validates MPCP artifact chain");
const bundle = {
  settlement,
  settlementIntent: intent,
  spa: signedPaymentAuth,
  sba: signedBudgetAuth,
  policyGrant,
  paymentPolicyDecision,
  sbaPublicKeyPem: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
  spaPublicKeyPem: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
};
const bundlePath = join(EXAMPLE_DIR, "fleet-demo-bundle.json");
writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

const { ok, output } = runVerify(bundlePath, { explain: true });
log(output);
if (ok) {
  log("[Parking Service] ✓ Verification PASSED — gate opens");
} else {
  log("[Parking Service] ✗ Verification FAILED");
  process.exit(1);
}
log("");

log("Summary: M2M payment loop complete —");
log("  • Vehicle Agent: policy + budget enforcement, SPA signing");
log("  • Parking Service: request + local verification");
log("  • Settlement Rail: mock execution");
log("  • No centralized payment API required");
log("");
