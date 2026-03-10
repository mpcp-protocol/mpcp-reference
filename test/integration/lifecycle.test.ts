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

describe("MPCP full lifecycle integration", () => {
  it("fleet policy → policy grant → budget auth → SBA → SPA → settlement intent → settlement → verification passes", () => {
    setupKeys();
    const EXPIRY = "2030-12-31T23:59:59Z";
    const SETTLEMENT_NOW = "2026-01-15T12:00:00Z";
    const policyHash = "a1b2c3d4e5f6";

    // 1. Policy grant (derived from fleet policy constraints)
    const policyGrant = createPolicyGrant({
      policyHash,
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      expiresAt: EXPIRY,
    });
    expect(policyGrant).toBeDefined();
    expect(policyGrant.policyHash).toBe(policyHash);

    // 2. Budget authorization
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
    expect(budgetAuth).toBeDefined();

    // 3. Signed budget authorization (SBA)
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
    expect(signedBudgetAuth).not.toBeNull();

    // 4. Settlement intent
    const intent = createSettlementIntent({
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    });
    expect(intent).toBeDefined();
    expect(intent.rail).toBe("xrpl");

    // 5. Payment policy decision
    const paymentPolicyDecision: PaymentPolicyDecision = {
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

    // 6. Signed payment authorization (SPA)
    const signedPaymentAuth = createSignedPaymentAuthorization(
      budgetAuth.sessionId,
      paymentPolicyDecision,
      { settlementIntent: intent },
    );
    expect(signedPaymentAuth).not.toBeNull();
    expect(signedPaymentAuth!.authorization.intentHash).toBeDefined();

    // 7. Settlement (executed)
    const settlement: SettlementResult = {
      amount: "19440000",
      rail: "xrpl",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
      destination: "rDestination",
      nowISO: SETTLEMENT_NOW,
    };

    // 8. Verification
    const result = verifySettlement({
      policyGrant: policyGrant!,
      signedBudgetAuthorization: signedBudgetAuth!,
      signedPaymentAuthorization: signedPaymentAuth!,
      settlement,
      paymentPolicyDecision,
      decisionId: paymentPolicyDecision.decisionId,
      settlementIntent: intent,
    });

    expect(result).toEqual({ valid: true });
  });

  it("tampered settlement amount → verification fails", () => {
    setupKeys();
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
      vehicleId: "1234567",
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
      vehicleId: budgetAuth.vehicleId,
      policyHash: budgetAuth.policyHash,
      currency: budgetAuth.currency,
      maxAmountMinor: budgetAuth.maxAmountMinor,
      allowedRails: budgetAuth.allowedRails,
      allowedAssets: budgetAuth.allowedAssets,
      destinationAllowlist: budgetAuth.destinationAllowlist,
      expiresAt: budgetAuth.expiresAt,
    });
    expect(signedBudgetAuth).not.toBeNull();

    const intent = createSettlementIntent({
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    });

    const paymentPolicyDecision: PaymentPolicyDecision = {
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
    expect(signedPaymentAuth).not.toBeNull();

    const settlement: SettlementResult = {
      amount: "19440000",
      rail: "xrpl",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
      destination: "rDestination",
      nowISO: SETTLEMENT_NOW,
    };

    const tamperedSettlement = {
      ...settlement,
      amount: "99999999",
    };

    const result = verifySettlement({
      policyGrant: policyGrant!,
      signedBudgetAuthorization: signedBudgetAuth!,
      signedPaymentAuthorization: signedPaymentAuth!,
      settlement: tamperedSettlement,
      paymentPolicyDecision,
      decisionId: paymentPolicyDecision.decisionId,
      settlementIntent: intent,
    });

    expect(result.valid).toBe(false);
  });

  it("CLI verify on bundle passes (self-contained with embedded public keys)", () => {
    setupKeys();
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
      vehicleId: "1234567",
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
      vehicleId: budgetAuth.vehicleId,
      policyHash: budgetAuth.policyHash,
      currency: budgetAuth.currency,
      maxAmountMinor: budgetAuth.maxAmountMinor,
      allowedRails: budgetAuth.allowedRails,
      allowedAssets: budgetAuth.allowedAssets,
      destinationAllowlist: budgetAuth.destinationAllowlist,
      expiresAt: budgetAuth.expiresAt,
    });
    expect(signedBudgetAuth).not.toBeNull();

    const intent = createSettlementIntent({
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    });

    const paymentPolicyDecision: PaymentPolicyDecision = {
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
    expect(signedPaymentAuth).not.toBeNull();

    const settlement: SettlementResult = {
      amount: "19440000",
      rail: "xrpl",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
      destination: "rDestination",
      nowISO: SETTLEMENT_NOW,
    };

    const bundle = {
      settlement,
      settlementIntent: intent,
      spa: signedPaymentAuth!,
      sba: signedBudgetAuth!,
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
