#!/usr/bin/env node
/**
 * PR8A — Machine Wallet Guardrails Demo
 *
 * Demonstrates MPCP's core capability: autonomous systems spending money safely
 * within cryptographically enforced limits. No centralized payment API required.
 *
 * Scenario: Robotaxi arrives at parking → meter issues payment request
 * → vehicle evaluates policy → vehicle signs SPA within budget
 * → meter verifies MPCP chain → gate opens
 *
 * Run: npm run build && npm run example:guardrails
 */
import crypto from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
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
const policyHash = "a1b2c3d4e5f6";

function log(msg) {
  console.log(msg);
}

log("");
log("MPCP Machine Wallet Guardrails Demo");
log("====================================");
log("");
log("Scenario: Robotaxi at parking facility. Payment request → local policy check");
log("→ sign SPA within budget → meter verifies chain → gate opens.");
log("");

log("1. Fleet Policy → Policy Grant");
log("   Guardrail: allowed rails, allowed assets, expiration");
const policyGrant = createPolicyGrant({
  policyHash,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: EXPIRY,
});
log(`   ✓ Grant created: ${policyGrant.grantId}, rails=[xrpl], expires ${EXPIRY.slice(0, 10)}`);
log("");

log("2. Budget Authorization (session spending envelope)");
log("   Guardrail: maxAmountMinor, destinationAllowlist, allowedRails, allowedAssets");
const budgetAuth = createBudgetAuthorization({
  sessionId: "11111111-1111-4111-8111-111111111111",
  vehicleId: "1234567",
  policyHash,
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rDestination"],
  expiresAt: EXPIRY,
});
log(`   ✓ Budget: max $30.00, destinations=[rDestination]`);
log("");

log("3. Signed Budget Authorization (SBA)");
log("   Guardrail: cryptographically signed; tamper-resistant");
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
log("   ✓ SBA signed with vehicle key");
log("");

log("4. Settlement Intent + Signed Payment Authorization (SPA)");
log("   Guardrail: SPA binds to specific amount, destination, intentHash");
const intent = createSettlementIntent({
  rail: "xrpl",
  amount: "19440000",
  destination: "rDestination",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  createdAt: SETTLEMENT_NOW,
});
const paymentPolicyDecision = {
  decisionId: "dec-1",
  policyHash,
  action: "ALLOW",
  reasons: ["OK"],
  expiresAtISO: EXPIRY,
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  priceFiat: { amountMinor: "2500", currency: "USD" },
  chosen: { rail: "xrpl", quoteId: "q1" },
  settlementQuotes: [
    {
      quoteId: "q1",
      rail: "xrpl",
      amount: { amount: "19440000", decimals: 6 },
      destination: "rDestination",
      expiresAt: EXPIRY,
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
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

log("5. Settlement (executed)");
const settlement = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: SETTLEMENT_NOW,
};
log("   ✓ Payment executed on rail");
log("");

log("6. Local Verification (no centralized API)");
log("   Guardrail: parking meter verifies full chain locally");
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
const bundlePath = join(EXAMPLE_DIR, "guardrails-demo-bundle.json");
writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

const { ok, output } = runVerify(bundlePath, { explain: true });
log(output);
if (ok) {
  log("✓ Gate opens — payment verified. Machine wallet guardrails enforced.");
} else {
  log("✗ Verification failed.");
  process.exit(1);
}
log("");

log("7. Tamper Detection");
log("   Guardrail: modified settlement amount → verification fails");
const tamperedBundle = {
  ...bundle,
  settlement: { ...settlement, amount: "99999999" },
};
const tamperedPath = join(EXAMPLE_DIR, "guardrails-demo-tampered.json");
writeFileSync(tamperedPath, JSON.stringify(tamperedBundle, null, 2));
const { ok: tamperedOk, output: tamperedOutput } = runVerify(tamperedPath, {
  explain: true,
});
if (!tamperedOk) {
  log(tamperedOutput);
  log("   ✓ Tampered amount correctly rejected (payment_auth_mismatch)");
} else {
  log("   ✗ Expected tampered verification to fail");
  process.exit(1);
}
try {
  unlinkSync(tamperedPath);
} catch { /* ignore */ }
log("");

log("Summary: Machine-enforced spending sandbox —");
log("  • Policy limits (rails, assets, destinations, max spend)");
log("  • Cryptographic signatures (SBA, SPA)");
log("  • Local verification (no central approval API)");
log("  • Tamper detection (modified amount rejected)");
log("");
