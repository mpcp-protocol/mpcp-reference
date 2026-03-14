#!/usr/bin/env node
/**
 * Generate golden test vectors for protocol conformance testing.
 * Run: npm run build && node scripts/gen-vectors.mjs
 */
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTORS_DIR = join(__dirname, "..", "test", "vectors");

const { createSignedBudgetAuthorization: createSignedSessionBudgetAuthorization } = await import("../dist/sdk/index.js");
const { createSignedPaymentAuthorization } = await import("../dist/protocol/spa.js");
const { createSettlementIntent } = await import("../dist/sdk/createSettlementIntent.js");

const sbaKeys = crypto.generateKeyPairSync("ed25519");
const spaKeys = crypto.generateKeyPairSync("ed25519");
process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";

const EXPIRY = "2030-12-31T23:59:59Z";
const SETTLEMENT_NOW = "2026-01-15T12:00:00Z";
const POLICY_HASH = "a1b2c3d4e5f6";
const GRANT_ID = "a851605b-1c3e-470e-ae60-72e782d647da";

const baseDecision = {
  decisionId: "dec-1",
  policyHash: POLICY_HASH,
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

const policyGrant = {
  grantId: GRANT_ID,
  policyHash: POLICY_HASH,
  expiresAt: EXPIRY,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

const baseSettlement = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: SETTLEMENT_NOW,
};

const intent = createSettlementIntent({
  rail: "xrpl",
  amount: "19440000",
  destination: "rDestination",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  createdAt: "2026-03-10T15:51:58.389Z",
});

const sba = createSignedSessionBudgetAuthorization({
  sessionId: "11111111-1111-4111-8111-111111111111",
  actorId: "1234567",
  grantId: GRANT_ID,
  policyHash: POLICY_HASH,
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rDestination"],
  expiresAt: EXPIRY,
});
if (!sba) throw new Error("Failed to create SBA");

const spa = createSignedPaymentAuthorization(
  "11111111-1111-4111-8111-111111111111",
  baseDecision,
  { settlementIntent: intent, budgetId: sba.authorization.budgetId },
);
if (!spa) throw new Error("Failed to create SPA");

const sbaPublicKeyPem = process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
const spaPublicKeyPem = process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM;

// ── valid-settlement ────────────────────────────────────────────────────────
const validBundle = {
  settlement: baseSettlement,
  settlementIntent: intent,
  spa,
  sba,
  policyGrant,
  paymentPolicyDecision: baseDecision,
  sbaPublicKeyPem,
  spaPublicKeyPem,
};
writeFileSync(join(VECTORS_DIR, "valid-settlement.json"), JSON.stringify(validBundle, null, 2));
console.log("  valid-settlement.json");

// ── expired-grant ───────────────────────────────────────────────────────────
const expiredGrantBundle = {
  ...validBundle,
  policyGrant: { ...policyGrant, expiresAt: "2020-01-01T00:00:00Z" },
};
writeFileSync(join(VECTORS_DIR, "expired-grant.json"), JSON.stringify(expiredGrantBundle, null, 2));
console.log("  expired-grant.json");

// ── budget-exceeded ─────────────────────────────────────────────────────────
const budgetExceededBundle = {
  ...validBundle,
  paymentPolicyDecision: {
    ...baseDecision,
    priceFiat: { amountMinor: "5000", currency: "USD" }, // exceeds maxAmountMinor: "3000"
  },
};
writeFileSync(join(VECTORS_DIR, "budget-exceeded.json"), JSON.stringify(budgetExceededBundle, null, 2));
console.log("  budget-exceeded.json");

// ── intent-hash-mismatch ────────────────────────────────────────────────────
const intentHashMismatchBundle = {
  ...validBundle,
  settlementIntent: { ...intent, amount: "99999999" }, // tampered amount, intentHash in SPA won't match
};
writeFileSync(join(VECTORS_DIR, "intent-hash-mismatch.json"), JSON.stringify(intentHashMismatchBundle, null, 2));
console.log("  intent-hash-mismatch.json");

// ── settlement-mismatch ─────────────────────────────────────────────────────
const settlementMismatchBundle = {
  ...validBundle,
  settlement: { ...baseSettlement, amount: "99999999" }, // tampered settlement amount
};
writeFileSync(join(VECTORS_DIR, "settlement-mismatch.json"), JSON.stringify(settlementMismatchBundle, null, 2));
console.log("  settlement-mismatch.json");

console.log("\nGenerated golden test vectors.");
