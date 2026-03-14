/**
 * PR9 — Integration Tests
 *
 * Simulates a full MPCP lifecycle:
 *   fleet policy (constraints) → policy grant → budget authorization → SBA → SPA
 *   → settlement intent → settlement → verification
 *
 * Uses the SDK as the primary API. Verifies the full chain passes.
 */
import crypto from "node:crypto";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
  createSignedPaymentAuthorization,
  createSettlementIntent,
  verifySettlement,
} from "../../src/sdk/index.js";
import { runVerify } from "../../src/cli/verify.js";
import type { PaymentPolicyDecision, SettlementResult } from "../../src/policy-core/types.js";

const SBA_ENV = {
  privateKey: process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SBA_SIGNING_KEY_ID,
};
const SPA_ENV = {
  privateKey: process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SPA_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = SBA_ENV.privateKey;
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = SBA_ENV.publicKey;
  process.env.MPCP_SBA_SIGNING_KEY_ID = SBA_ENV.keyId;
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = SPA_ENV.privateKey;
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = SPA_ENV.publicKey;
  process.env.MPCP_SPA_SIGNING_KEY_ID = SPA_ENV.keyId;
});

function setupKeys() {
  const sbaKeys = crypto.generateKeyPairSync("ed25519");
  const spaKeys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";
}

const EXPIRY = "2030-12-31T23:59:59Z";
const SETTLEMENT_NOW = "2026-01-15T12:00:00Z";
const POLICY_HASH = "a1b2c3d4e5f6";
const ASSET = { kind: "IOU" as const, currency: "RLUSD", issuer: "rIssuer" };

function makeGrant() {
  return createPolicyGrant({
    policyHash: POLICY_HASH,
    allowedRails: ["xrpl"],
    allowedAssets: [ASSET],
    expiresAt: EXPIRY,
  });
}

function makeBudgetAuth(grantId: string) {
  return createBudgetAuthorization({
    sessionId: "11111111-1111-4111-8111-111111111111",
    actorId: "1234567",
    grantId,
    policyHash: POLICY_HASH,
    currency: "USD",
    maxAmountMinor: "3000",
    allowedRails: ["xrpl"],
    allowedAssets: [ASSET],
    destinationAllowlist: ["rDestination"],
    expiresAt: EXPIRY,
  });
}

function makeDecision(): PaymentPolicyDecision {
  return {
    decisionId: "dec-1",
    policyHash: POLICY_HASH,
    action: "ALLOW",
    reasons: ["OK"],
    expiresAtISO: EXPIRY,
    rail: "xrpl",
    asset: ASSET,
    priceFiat: { amountMinor: "2500", currency: "USD" },
    chosen: { rail: "xrpl", quoteId: "q1" },
    settlementQuotes: [
      {
        quoteId: "q1",
        rail: "xrpl",
        amount: { amount: "19440000", decimals: 6 },
        destination: "rDestination",
        expiresAt: EXPIRY,
        asset: ASSET,
      },
    ],
  };
}

function makeSettlement(overrides?: Partial<SettlementResult>): SettlementResult {
  return {
    amount: "19440000",
    rail: "xrpl",
    asset: ASSET,
    destination: "rDestination",
    nowISO: SETTLEMENT_NOW,
    ...overrides,
  };
}

function buildLifecycle() {
  const policyGrant = makeGrant();
  const budgetAuth = makeBudgetAuth(policyGrant.grantId);
  const signedBudgetAuth = createSignedBudgetAuthorization({
    sessionId: budgetAuth.sessionId,
    actorId: budgetAuth.actorId,
    grantId: budgetAuth.grantId,
    policyHash: budgetAuth.policyHash,
    currency: budgetAuth.currency,
    maxAmountMinor: budgetAuth.maxAmountMinor,
    allowedRails: budgetAuth.allowedRails,
    allowedAssets: budgetAuth.allowedAssets,
    destinationAllowlist: budgetAuth.destinationAllowlist,
    expiresAt: budgetAuth.expiresAt,
  });
  const intent = createSettlementIntent({
    rail: "xrpl",
    amount: "19440000",
    destination: "rDestination",
    asset: ASSET,
  });
  const paymentPolicyDecision = makeDecision();
  const signedPaymentAuth = createSignedPaymentAuthorization(
    budgetAuth.sessionId,
    paymentPolicyDecision,
    { settlementIntent: intent, budgetId: signedBudgetAuth!.authorization.budgetId },
  );
  return {
    policyGrant,
    budgetAuth,
    signedBudgetAuth: signedBudgetAuth!,
    intent,
    paymentPolicyDecision,
    signedPaymentAuth: signedPaymentAuth!,
  };
}

describe("MPCP full lifecycle integration", () => {
  it("fleet policy → policy grant → budget auth → SBA → SPA → settlement intent → settlement → verification passes", () => {
    setupKeys();
    const { policyGrant, signedBudgetAuth, intent, paymentPolicyDecision, signedPaymentAuth } = buildLifecycle();

    expect(policyGrant).toBeDefined();
    expect(signedPaymentAuth.authorization.intentHash).toBeDefined();

    const result = verifySettlement({
      policyGrant,
      signedBudgetAuthorization: signedBudgetAuth,
      signedPaymentAuthorization: signedPaymentAuth,
      settlement: makeSettlement(),
      paymentPolicyDecision,
      decisionId: paymentPolicyDecision.decisionId,
      settlementIntent: intent,
    });

    expect(result).toEqual({ valid: true });
  });

  it("tampered settlement amount → verification fails", () => {
    setupKeys();
    const { policyGrant, signedBudgetAuth, intent, paymentPolicyDecision, signedPaymentAuth } = buildLifecycle();

    const result = verifySettlement({
      policyGrant,
      signedBudgetAuthorization: signedBudgetAuth,
      signedPaymentAuthorization: signedPaymentAuth,
      settlement: makeSettlement({ amount: "99999999" }),
      paymentPolicyDecision,
      decisionId: paymentPolicyDecision.decisionId,
      settlementIntent: intent,
    });

    expect(result).toMatchObject({ valid: false, reason: "payment_auth_mismatch" });
  });

  it("CLI verify on bundle passes (self-contained with embedded public keys)", () => {
    setupKeys();
    const { policyGrant, intent, paymentPolicyDecision, signedPaymentAuth, signedBudgetAuth } = buildLifecycle();

    const bundle = {
      settlement: makeSettlement(),
      settlementIntent: intent,
      spa: signedPaymentAuth,
      sba: signedBudgetAuth,
      policyGrant,
      paymentPolicyDecision,
      sbaPublicKeyPem: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
      spaPublicKeyPem: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
    };

    const tmpPath = join(tmpdir(), `mpcp-lifecycle-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify(bundle));

    try {
      const { ok } = runVerify(tmpPath, { explain: true });
      expect(ok).toBe(true);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });
});
