#!/usr/bin/env node
/**
 * PR8 — EV Charging Session Example
 *
 * Generates a full MPCP settlement flow for an EV charging session:
 * policy grant → budget auth → SBA → SPA → settlement.
 *
 * Run: npm run build && node examples/ev-charging/generate.mjs
 * Or:  npm run example:ev-charging
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
const policyHash = "a1b2c3d4e5f7";

// Charging station as destination
const DESTINATION = "rChargingStation";

const policyGrant = createPolicyGrant({
  policyHash,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: EXPIRY,
});

const budgetAuth = createBudgetAuthorization({
  sessionId: "22222222-2222-4222-8222-222222222222",
  actorId: "ev-7890",
  grantId: policyGrant.grantId,
  policyHash,
  currency: "USD",
  maxAmountMinor: "5000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: [DESTINATION],
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

const intent = createSettlementIntent({
  rail: "xrpl",
  amount: "25000000",
  destination: DESTINATION,
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  createdAt: SETTLEMENT_NOW,
});

const paymentPolicyDecision = {
  decisionId: "dec-ev-1",
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
      amount: { amount: "25000000", decimals: 6 },
      destination: DESTINATION,
      expiresAt: EXPIRY,
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    },
  ],
};

const signedPaymentAuth = createSignedPaymentAuthorization(
  budgetAuth.sessionId,
  paymentPolicyDecision,
  { settlementIntent: intent, budgetId: signedBudgetAuth.authorization.budgetId },
);

if (!signedPaymentAuth) throw new Error("Failed to create SPA");

const settlement = {
  amount: "25000000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: DESTINATION,
  nowISO: SETTLEMENT_NOW,
};

writeFileSync(join(EXAMPLE_DIR, "policy-grant.json"), JSON.stringify(policyGrant, null, 2));
writeFileSync(join(EXAMPLE_DIR, "budget-auth.json"), JSON.stringify(budgetAuth, null, 2));
writeFileSync(join(EXAMPLE_DIR, "signed-budget-auth.json"), JSON.stringify(signedBudgetAuth, null, 2));
writeFileSync(join(EXAMPLE_DIR, "spa.json"), JSON.stringify(signedPaymentAuth, null, 2));
writeFileSync(join(EXAMPLE_DIR, "settlement-intent.json"), JSON.stringify(intent, null, 2));
writeFileSync(join(EXAMPLE_DIR, "settlement.json"), JSON.stringify(settlement, null, 2));
writeFileSync(join(EXAMPLE_DIR, "payment-policy-decision.json"), JSON.stringify(paymentPolicyDecision, null, 2));

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
writeFileSync(join(EXAMPLE_DIR, "settlement-bundle.json"), JSON.stringify(bundle, null, 2));

console.log("Generated MPCP EV charging artifacts:\n");
console.log("  policy-grant.json");
console.log("  budget-auth.json");
console.log("  signed-budget-auth.json");
console.log("  spa.json");
console.log("  settlement-intent.json");
console.log("  settlement.json");
console.log("  payment-policy-decision.json");
console.log("  settlement-bundle.json\n");

const bundlePath = join(EXAMPLE_DIR, "settlement-bundle.json");
console.log("Verifying settlement-bundle.json...\n");
const { ok, output } = runVerify(bundlePath, { explain: true });
console.log(output);
process.exit(ok ? 0 : 1);
