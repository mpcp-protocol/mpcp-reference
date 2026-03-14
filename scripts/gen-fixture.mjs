#!/usr/bin/env node
/**
 * Generate a valid settlement fixture for CLI testing.
 * Run: node scripts/gen-fixture.mjs
 */
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load built modules (run npm run build first)
const { createSignedBudgetAuthorization: createSignedSessionBudgetAuthorization } = await import("../dist/sdk/index.js");
const { createSignedPaymentAuthorization } = await import("../dist/protocol/spa.js");

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

// Fixed timestamps so committed fixture remains verifiable (no time-sensitive expiry)
const EXPIRY = "2030-12-31T23:59:59Z";
const SETTLEMENT_NOW = "2026-01-15T12:00:00Z";
const baseGrant = {
  grantId: "grant-1",
  policyHash: "a1b2c3",
  expiresAt: EXPIRY,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};
const baseDecision = {
  decisionId: "dec-1",
  policyHash: "a1b2c3",
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
const baseSettlement = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: SETTLEMENT_NOW,
};
const intent = {
  rail: "xrpl",
  amount: "19440000",
  destination: "rDestination",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
};

const sba = createSignedSessionBudgetAuthorization({
  sessionId: "11111111-1111-4111-8111-111111111111",
  actorId: "1234567",
  grantId: baseGrant.grantId,
  policyHash: "a1b2c3",
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rDestination"],
  expiresAt: EXPIRY,
});
const spa = createSignedPaymentAuthorization(
  "11111111-1111-4111-8111-111111111111",
  baseDecision,
  { settlementIntent: intent, budgetId: sba.authorization.budgetId },
);

const ctx = {
  policyGrant: baseGrant,
  signedBudgetAuthorization: sba,
  signedPaymentAuthorization: spa,
  settlement: baseSettlement,
  paymentPolicyDecision: baseDecision,
  decisionId: "dec-1",
  settlementIntent: intent,
};

const outPath = join(__dirname, "..", "test", "fixtures", "settlement.json");
writeFileSync(outPath, JSON.stringify(ctx, null, 2));
console.log(`Wrote ${outPath}`);
