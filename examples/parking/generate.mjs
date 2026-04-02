#!/usr/bin/env node
/**
 * Parking Session Example
 *
 * Generates a full MPCP authorization flow: PolicyGrant → SignedBudgetAuthorization (SBA) → settlement bundle.
 * Writes artifact files and runs verification.
 *
 * Run: npm run build && node examples/parking/generate.mjs
 * Or:  npm run example:parking
 */
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = __dirname;

// Set up ephemeral keys BEFORE importing protocol
const sbaKeys = crypto.generateKeyPairSync("ed25519");
process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";

const {
  createPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
} = await import("../../dist/sdk/index.js");
const { runVerify } = await import("../../dist/cli/verify.js");

// Fixed timestamps so committed artifacts remain verifiable (no time-sensitive expiry)
const EXPIRY = "2030-12-31T23:59:59Z";
const SETTLEMENT_NOW = "2026-01-15T12:00:00Z";
const policyHash = "a1b2c3d4e5f6";

const policyGrant = createPolicyGrant({
  policyHash,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: EXPIRY,
});

const budgetAuth = createBudgetAuthorization({
  sessionId: "11111111-1111-4111-8111-111111111111",
  actorId: "1234567",
  grantId: policyGrant.grantId,
  policyHash,
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rDestination"],
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

const settlement = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: SETTLEMENT_NOW,
};

// Write individual artifacts
writeFileSync(join(EXAMPLE_DIR, "policy-grant.json"), JSON.stringify(policyGrant, null, 2));
writeFileSync(join(EXAMPLE_DIR, "budget-auth.json"), JSON.stringify(budgetAuth, null, 2));
writeFileSync(join(EXAMPLE_DIR, "signed-budget-auth.json"), JSON.stringify(signedBudgetAuth, null, 2));
writeFileSync(join(EXAMPLE_DIR, "settlement.json"), JSON.stringify(settlement, null, 2));
writeFileSync(join(EXAMPLE_DIR, "payment-policy-decision.json"), JSON.stringify(paymentPolicyDecision, null, 2));

// Write bundle for verification (include public key for self-contained verify)
const bundle = {
  settlement,
  sba: signedBudgetAuth,
  policyGrant,
  paymentPolicyDecision,
  sbaPublicKeyPem: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
};
writeFileSync(join(EXAMPLE_DIR, "settlement-bundle.json"), JSON.stringify(bundle, null, 2));

console.log("Generated MPCP parking artifacts:\n");
console.log("  policy-grant.json");
console.log("  budget-auth.json");
console.log("  signed-budget-auth.json");
console.log("  settlement.json");
console.log("  payment-policy-decision.json");
console.log("  settlement-bundle.json\n");

// Verify
const bundlePath = join(EXAMPLE_DIR, "settlement-bundle.json");
console.log("Verifying settlement-bundle.json...\n");
const { ok, output } = runVerify(bundlePath, { explain: true });
console.log(output);
process.exit(ok ? 0 : 1);
