#!/usr/bin/env node
/**
 * PR23 — Machine Wallet Guardrails: Wallet Integration Example
 *
 * Demonstrates how a machine wallet integrates MPCP guardrails before signing.
 * The wallet checks PolicyGrant and SBA constraints, then signs SPA only if all pass.
 *
 * Run: npm run build && node examples/machine-wallet-guardrails/wallet-integration.mjs
 */
import crypto from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const spaKeys = crypto.generateKeyPairSync("ed25519");
process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";

const {
  createSignedPaymentAuthorization,
  createSettlementIntent,
} = await import("../../dist/sdk/index.js");

const EXPIRY = "2030-12-31T23:59:59Z";
const policyHash = "a1b2c3d4e5f6";

/**
 * Simulates the wallet's guardrail check before signing.
 * Returns { ok: boolean, reason?: string }.
 */
function checkGuardrails(policyGrant, sba, paymentRequest) {
  const { rail, asset, amount, destination } = paymentRequest;

  // Layer 1: PolicyGrant
  const allowedRails = new Set(policyGrant.allowedRails ?? []);
  if (!allowedRails.has(rail)) {
    return { ok: false, reason: "rail not in policy" };
  }
  const allowedAssets = policyGrant.allowedAssets ?? [];
  const assetMatch = allowedAssets.some(
    (a) =>
      a.kind === asset?.kind &&
      a.currency === asset?.currency &&
      a.issuer === asset?.issuer
  );
  if (!assetMatch) {
    return { ok: false, reason: "asset not in policy" };
  }
  if (new Date(policyGrant.expiresAt) < new Date()) {
    return { ok: false, reason: "policy expired" };
  }

  // Layer 2: SBA
  const maxMinor = BigInt(sba.authorization.maxAmountMinor ?? "0");
  const reqMinor = BigInt(amount);
  if (reqMinor > maxMinor) {
    return { ok: false, reason: "amount exceeds budget" };
  }
  const allowlist = sba.authorization.destinationAllowlist ?? [];
  if (!allowlist.includes(destination)) {
    return { ok: false, reason: "destination not in allowlist" };
  }
  if (new Date(sba.authorization.expiresAt) < new Date()) {
    return { ok: false, reason: "budget expired" };
  }

  return { ok: true };
}

/**
 * Wallet integration: check guardrails, then sign SPA if allowed.
 */
async function handlePaymentRequest(policyGrant, sba, paymentRequest, sessionSpentMinor = "0") {
  // Optional: session balance check (cumulative spend)
  const maxMinor = BigInt(sba.authorization.maxAmountMinor ?? "0");
  const spent = BigInt(sessionSpentMinor);
  const req = BigInt(paymentRequest.amount);
  if (spent + req > maxMinor) {
    return { ok: false, reason: "would exceed session budget", signed: null };
  }

  const check = checkGuardrails(policyGrant, sba, paymentRequest);
  if (!check.ok) {
    return { ok: false, reason: check.reason, signed: null };
  }

  const intent = createSettlementIntent({
    rail: paymentRequest.rail,
    amount: paymentRequest.amount,
    destination: paymentRequest.destination,
    asset: paymentRequest.asset,
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  });

  const paymentPolicyDecision = {
    decisionId: "dec-1",
    policyHash,
    action: "ALLOW",
    reasons: ["OK"],
    expiresAtISO: EXPIRY,
    rail: paymentRequest.rail,
    asset: paymentRequest.asset,
    priceFiat: { amountMinor: paymentRequest.amount, currency: "USD" },
    chosen: { rail: paymentRequest.rail, quoteId: "q1" },
    settlementQuotes: [
      {
        quoteId: "q1",
        rail: paymentRequest.rail,
        amount: { amount: paymentRequest.amount, decimals: 6 },
        destination: paymentRequest.destination,
        expiresAt: EXPIRY,
        asset: paymentRequest.asset,
      },
    ],
  };

  const spa = createSignedPaymentAuthorization(
    sba.authorization.sessionId,
    paymentPolicyDecision,
    { settlementIntent: intent }
  );

  return { ok: true, signed: { spa, intent } };
}

// Demo
async function main() {
  const policyGrant = {
    grantId: "a851605b-1c3e-470e-ae60-72e782d647da",
    policyHash,
    expiresAt: EXPIRY,
    allowedRails: ["xrpl"],
    allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  };

  const sba = {
    authorization: {
      sessionId: "11111111-1111-4111-8111-111111111111",
      policyHash,
      maxAmountMinor: "3000",
      destinationAllowlist: ["rParking", "rCharging"],
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      expiresAt: EXPIRY,
    },
  };

  console.log("MPCP Wallet Integration Example");
  console.log("==============================\n");
  console.log("Loaded: PolicyGrant + SBA (budget $30, destinations: rParking, rCharging)\n");

  // Request 1: Allowed
  const req1 = {
    rail: "xrpl",
    asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    amount: "1500",
    destination: "rParking",
  };
  const res1 = await handlePaymentRequest(policyGrant, sba, req1);
  console.log("Request 1: $15 to rParking");
  console.log(res1.ok ? `  ✓ Signed SPA` : `  ✗ Rejected: ${res1.reason}`);
  console.log("");

  // Request 2: Wrong destination
  const req2 = {
    rail: "xrpl",
    asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    amount: "500",
    destination: "rAttacker",
  };
  const res2 = await handlePaymentRequest(policyGrant, sba, req2, "1500");
  console.log("Request 2: $5 to rAttacker");
  console.log(res2.ok ? `  ✓ Signed SPA` : `  ✗ Rejected: ${res2.reason}`);
  console.log("");

  // Request 3: Would exceed budget
  const req3 = {
    rail: "xrpl",
    asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    amount: "2000",
    destination: "rCharging",
  };
  const res3 = await handlePaymentRequest(policyGrant, sba, req3, "1500");
  console.log("Request 3: $20 to rCharging (session already spent $15)");
  console.log(res3.ok ? `  ✓ Signed SPA` : `  ✗ Rejected: ${res3.reason}`);
  console.log("");

  console.log("Summary: Guardrails prevent wrong destination and overspend.");
}

main().catch(console.error);
