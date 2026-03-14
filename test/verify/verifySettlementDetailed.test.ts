import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { PaymentPolicyDecision, SettlementResult } from "../../src/policy-core/types.js";
import { createSignedSessionBudgetAuthorization } from "../../src/protocol/sba.js";
import { createSignedPaymentAuthorization } from "../../src/protocol/spa.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import {
  verifySettlementDetailed,
  verifySettlementDetailedSafe,
} from "../../src/verifier/index.js";

function setupBothKeys() {
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
}

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
const verificationNowIso = new Date(Date.now() - 1000).toISOString();

const baseGrant: PolicyGrantLike = {
  grantId: "grant-1",
  policyHash: "a1b2c3d4e5f6",
  expiresAt: futureExpiry,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

const baseDecision: PaymentPolicyDecision = {
  decisionId: "dec-1",
  policyHash: "a1b2c3d4e5f6",
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

const baseSettlement: SettlementResult = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: verificationNowIso,
};

afterEach(() => {
  delete process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_KEY_ID;
  delete process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_SPA_SIGNING_KEY_ID;
});

describe("verifySettlementDetailed", () => {
  it("returns detailed report on success", () => {
    setupBothKeys();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-1",
      policyHash: "a1b2c3d4e5f6",
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
      { settlementIntent: intent, budgetId: sba!.authorization.budgetId },
    );
    const report = verifySettlementDetailed({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
      settlementIntent: intent,
    });
    expect(report.valid).toBe(true);
    expect(report.checks.some((c) => c.name === "SettlementIntent.intentHash" && c.valid)).toBe(true);
    expect(report.checks.every((c) => c.valid)).toBe(true);
  });

  it("returns expected/actual for intent hash mismatch", () => {
    setupBothKeys();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
    const tamperedIntent = { ...intent, amount: "99999999" };
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-1",
      policyHash: "a1b2c3d4e5f6",
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
      { settlementIntent: intent, budgetId: sba!.authorization.budgetId },
    );
    const report = verifySettlementDetailed({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
      settlementIntent: tamperedIntent,
    });
    expect(report.valid).toBe(false);
    const hashCheck = report.checks.find((c) => c.name === "SettlementIntent.intentHash");
    expect(hashCheck).toBeDefined();
    expect(hashCheck!.valid).toBe(false);
    expect(hashCheck!.expected).toBeDefined();
    expect(hashCheck!.actual).toBeDefined();
    expect(hashCheck!.expected).not.toBe(hashCheck!.actual);
  });

  it("verifySettlementDetailedSafe catches exceptions", () => {
    const throwingGrant = { ...baseGrant };
    Object.defineProperty(throwingGrant, "policyHash", {
      get: () => {
        throw new Error("access error");
      },
      configurable: true,
    });
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-1",
      policyHash: "a1b2c3d4e5f6",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: futureExpiry,
    });
    const spa = createSignedPaymentAuthorization(
      "11111111-1111-4111-8111-111111111111",
      baseDecision,
      { budgetId: "test-budget-id" },
    );
    const report = verifySettlementDetailedSafe({
      policyGrant: throwingGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
    });
    expect(report.valid).toBe(false);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].reason).toMatch(/access error/);
  });
});
