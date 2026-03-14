import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { PaymentPolicyDecision } from "../../src/policy-core/types.js";
import {
  createSignedSessionBudgetAuthorization,
  verifySignedSessionBudgetAuthorizationForDecision,
} from "../../src/protocol/sba.js";

const ORIGINAL_ENV = {
  privateKey: process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SBA_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = ORIGINAL_ENV.privateKey;
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = ORIGINAL_ENV.publicKey;
  process.env.MPCP_SBA_SIGNING_KEY_ID = ORIGINAL_ENV.keyId;
});

function setupKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
}

describe("SBA createSignedSessionBudgetAuthorization + verifySignedSessionBudgetAuthorizationForDecision", () => {
  it("happy path: create and verify SBA envelope", () => {
    setupKeys();
    const envelope = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-ph-1",
      policyHash: "ph-1",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      destinationAllowlist: ["rDestination"],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(envelope).not.toBeNull();

    const decision: PaymentPolicyDecision = {
      decisionId: "dec-1",
      policyHash: "ph-1",
      action: "ALLOW",
      reasons: ["OK"],
      expiresAtISO: new Date(Date.now() + 60_000).toISOString(),
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
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
        },
      ],
    };

    const verification = verifySignedSessionBudgetAuthorizationForDecision(envelope!, { sessionId: envelope!.authorization.sessionId, decision });
    expect(verification).toEqual({ ok: true });
  });

  it("fails on wrong rail (decision.rail not in allowedRails)", () => {
    setupKeys();
    const envelope = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-ph-1",
      policyHash: "ph-1",
      currency: "USD",
      maxAmountMinor: "5000",
      allowedRails: ["xrpl"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(envelope).not.toBeNull();

    const decision: PaymentPolicyDecision = {
      decisionId: "dec-1",
      policyHash: "ph-1",
      action: "ALLOW",
      reasons: ["OK"],
      expiresAtISO: new Date(Date.now() + 60_000).toISOString(),
      rail: "evm",
      chosen: { rail: "evm", quoteId: "q1" },
      settlementQuotes: [
        {
          quoteId: "q1",
          rail: "evm",
          amount: { amount: "1000", decimals: 18 },
          destination: "0xDest",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    };

    const verification = verifySignedSessionBudgetAuthorizationForDecision(envelope!, { sessionId: envelope!.authorization.sessionId, decision });
    expect(verification).toEqual({ ok: false, reason: "mismatch" });
  });

  it("fails on exceeded budget", () => {
    setupKeys();
    const envelope = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-ph-1",
      policyHash: "ph-1",
      currency: "USD",
      maxAmountMinor: "1000",
      allowedRails: ["stripe"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(envelope).not.toBeNull();

    const decision: PaymentPolicyDecision = {
      decisionId: "dec-1",
      policyHash: "ph-1",
      action: "ALLOW",
      reasons: ["OK"],
      expiresAtISO: new Date(Date.now() + 60_000).toISOString(),
      rail: "stripe",
      priceFiat: { amountMinor: "1200", currency: "USD" },
      chosen: { rail: "stripe", quoteId: "q1" },
      settlementQuotes: [
        {
          quoteId: "q1",
          rail: "stripe",
          amount: { amount: "1200", decimals: 2 },
          destination: "",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    };

    const verification = verifySignedSessionBudgetAuthorizationForDecision(envelope!, { sessionId: envelope!.authorization.sessionId, decision });
    expect(verification).toEqual({ ok: false, reason: "budget_exceeded" });
  });

  it("fails on cumulative budget overflow even when single payment fits", () => {
    setupKeys();
    const envelope = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-ph-1",
      policyHash: "a1b2c3d4e5f6",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["stripe"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(envelope).not.toBeNull();

    const decision: PaymentPolicyDecision = {
      decisionId: "dec-1",
      policyHash: "a1b2c3d4e5f6",
      action: "ALLOW",
      reasons: ["OK"],
      expiresAtISO: new Date(Date.now() + 60_000).toISOString(),
      rail: "stripe",
      priceFiat: { amountMinor: "1500", currency: "USD" }, // fits alone but not with prior spending
      chosen: { rail: "stripe", quoteId: "q1" },
      settlementQuotes: [
        {
          quoteId: "q1",
          rail: "stripe",
          amount: { amount: "1500", decimals: 2 },
          destination: "",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    };

    // Without cumulative context — passes (1500 <= 3000)
    const noCtx = verifySignedSessionBudgetAuthorizationForDecision(envelope!, { sessionId: envelope!.authorization.sessionId, decision });
    expect(noCtx).toEqual({ ok: true });

    // With prior spending that pushes total over budget — fails
    const withCtx = verifySignedSessionBudgetAuthorizationForDecision(envelope!, { sessionId: envelope!.authorization.sessionId, decision, cumulativeSpentMinor: "2000" });
    expect(withCtx).toEqual({ ok: false, reason: "budget_exceeded" });
  });

  it("fails on unsupported scope (DAY not SESSION)", () => {
    setupKeys();
    const envelope = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-ph-1",
      policyHash: "ph-1",
      currency: "USD",
      budgetScope: "DAY",
      maxAmountMinor: "5000",
      allowedRails: ["stripe"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(envelope).not.toBeNull();
    expect(envelope!.authorization.budgetScope).toBe("DAY");

    const decision: PaymentPolicyDecision = {
      decisionId: "dec-1",
      policyHash: "ph-1",
      action: "ALLOW",
      reasons: ["OK"],
      expiresAtISO: new Date(Date.now() + 60_000).toISOString(),
      rail: "stripe",
      priceFiat: { amountMinor: "1000", currency: "USD" },
    };

    const verification = verifySignedSessionBudgetAuthorizationForDecision(envelope!, { sessionId: envelope!.authorization.sessionId, decision });
    expect(verification).toEqual({ ok: false, reason: "mismatch" });
  });
});
