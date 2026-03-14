#!/usr/bin/env node
/**
 * Demo: generate a valid settlement fixture and run the CLI verify command.
 * Uses ephemeral keys - run in single process so verification sees the same keys.
 *
 * Run: node scripts/demo-verify.mjs
 */
import crypto from "node:crypto";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Set up keys BEFORE importing protocol (they read from env at module load/call time)
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

const { createSignedBudgetAuthorization: createSignedSessionBudgetAuthorization } = await import("../dist/sdk/index.js");
const { createSignedPaymentAuthorization } = await import("../dist/protocol/spa.js");
const { runVerify } = await import("../dist/cli/verify.js");

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
const baseGrant = {
  grantId: "grant-1",
  policyHash: "a1b2c3",
  expiresAt: futureExpiry,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};
const baseDecision = {
  decisionId: "dec-1",
  policyHash: "a1b2c3",
  action: "ALLOW",
  reasons: ["OK"],
  expiresAtISO: futureExpiry,
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
      expiresAt: futureExpiry,
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    },
  ],
};
const baseSettlement = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: new Date(Date.now() - 1000).toISOString(),
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
  policyHash: "a1b2c3",
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rDestination"],
  expiresAt: futureExpiry,
});
const spa = createSignedPaymentAuthorization(
  "11111111-1111-4111-8111-111111111111",
  baseDecision,
  { settlementIntent: intent },
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

const tmpPath = join(tmpdir(), `mpcp-demo-${Date.now()}.json`);
writeFileSync(tmpPath, JSON.stringify(ctx));
try {
  const explain = process.argv.includes("--explain");
  console.log(explain ? "Verifying settlement (--explain mode)...\n" : "Verifying settlement (with intent hash)...\n");
  const { ok, output } = runVerify(tmpPath, { explain });
  console.log(output);
  process.exit(ok ? 0 : 1);
} finally {
  if (existsSync(tmpPath)) unlinkSync(tmpPath);
}
