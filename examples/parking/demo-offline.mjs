#!/usr/bin/env node
/**
 * PR8D — Offline Payment Authorization Demo
 *
 * Demonstrates MPCP enabling payments when network connectivity is unavailable.
 * Vehicle holds pre-authorized policy chain (PolicyGrant + SBA), evaluates locally,
 * signs SPA locally, parking verifies locally — no central backend.
 *
 * Run: npm run build && npm run example:offline
 */
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = __dirname;

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
const policyHash = "a".repeat(64);

function log(msg) {
  console.log(msg);
}

log("");
log("MPCP Offline Payment Authorization Demo (PR8D)");
log("=================================================");
log("");
log("Scenario: Vehicle enters underground garage — NO NETWORK");
log("");

log("1. Pre-trip: Vehicle loads policy chain (while online)");
log("   FleetPolicy → PolicyGrant → BudgetAuthorization → SBA");
const policyGrant = createPolicyGrant({
  policyHash,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: EXPIRY,
});
const budgetAuth = createBudgetAuthorization({
  sessionId: "33333333-3333-4333-8333-333333333333",
  vehicleId: "veh-offline-001",
  policyHash,
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rParkingGarage"],
  expiresAt: EXPIRY,
});
const signedBudgetAuth = createSignedBudgetAuthorization({
  sessionId: budgetAuth.sessionId,
  vehicleId: budgetAuth.vehicleId,
  policyHash: budgetAuth.policyHash,
  currency: budgetAuth.currency,
  maxAmountMinor: budgetAuth.maxAmountMinor,
  allowedRails: budgetAuth.allowedRails,
  allowedAssets: budgetAuth.allowedAssets,
  destinationAllowlist: budgetAuth.destinationAllowlist,
  expiresAt: budgetAuth.expiresAt,
});
if (!signedBudgetAuth) throw new Error("Failed to create SBA");
log(`   ✓ PolicyGrant + SBA loaded. Max session $30.00, destinations=[rParkingGarage]`);
log("");

log("2. Vehicle enters underground garage — connectivity lost");
log("   (No central API available)");
log("");

log("3. Parking meter issues payment request ($5.40)");
const paymentRequest = {
  amountMinor: "540",
  amountRail: "5400000",
  destination: "rParkingGarage",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  rail: "xrpl",
};
log(`   Request: $${(Number(paymentRequest.amountMinor) / 100).toFixed(2)} → ${paymentRequest.destination}`);
log("");

log("4. Vehicle evaluates locally (no network)");
log("   ✓ Within budget ($5.40 < $30.00)");
log("   ✓ Destination in allowlist");
log("   ✓ Asset and rail permitted");
log("");

log("5. Vehicle signs SPA locally");
const intent = createSettlementIntent({
  rail: paymentRequest.rail,
  amount: paymentRequest.amountRail,
  destination: paymentRequest.destination,
  asset: paymentRequest.asset,
  createdAt: SETTLEMENT_NOW,
});
const paymentPolicyDecision = {
  decisionId: "dec-offline-1",
  policyHash,
  action: "ALLOW",
  reasons: ["OK"],
  expiresAtISO: EXPIRY,
  rail: paymentRequest.rail,
  asset: paymentRequest.asset,
  priceFiat: { amountMinor: paymentRequest.amountMinor, currency: "USD" },
  chosen: { rail: paymentRequest.rail, quoteId: "q-offline-1" },
  settlementQuotes: [
    {
      quoteId: "q-offline-1",
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
  { settlementIntent: intent },
);
if (!signedPaymentAuth) throw new Error("Failed to create SPA");
log(`   ✓ SPA signed: amount=${intent.amount}, destination=${intent.destination}`);
log("");

log("6. Parking system verifies MPCP chain locally");
const settlement = {
  amount: intent.amount,
  rail: intent.rail,
  asset: intent.asset,
  destination: intent.destination,
  nowISO: SETTLEMENT_NOW,
};
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
const bundlePath = join(EXAMPLE_DIR, "offline-demo-bundle.json");
writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

const { ok, output } = runVerify(bundlePath, { explain: true });
log(output);
if (ok) {
  log("✓ Gate opens — payment verified. No central backend contacted.");
} else {
  log("✗ Verification failed.");
  process.exit(1);
}
log("");

log("7. Later: reconciliation when connectivity returns");
log("   Parking system can submit settlement to rail, reconcile with fleet.");
log("");

log("Summary: Offline payment —");
log("  • Pre-authorized policy chain (PolicyGrant + SBA)");
log("  • Local authorization decisions");
log("  • Local SPA signing");
log("  • Local verification (no central API)");
log("  • Resilient payment during network outage");
log("");
