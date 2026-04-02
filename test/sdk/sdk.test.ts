import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPolicyGrant,
  createBudgetAuthorization,
  createSignedBudgetAuthorization,
  verifyPolicyGrant,
  verifySettlement,
} from "../../src/sdk/index.js";

describe("createPolicyGrant", () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  it("creates valid grant with required fields", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt,
    });
    expect(grant.policyHash).toBe("a1b2c3d4e5f6");
    expect(grant.allowedRails).toEqual(["xrpl"]);
    expect(grant.expiresAt).toBe(expiresAt);
    expect(grant.grantId).toBeDefined();
    expect(typeof grant.grantId).toBe("string");
    expect(verifyPolicyGrant(grant)).toEqual({ valid: true });
  });

  it("uses provided grantId when given", () => {
    const grant = createPolicyGrant({
      policyHash: "deadbeefcafe",
      allowedRails: ["evm"],
      expiresAt,
      grantId: "my-grant-123",
    });
    expect(grant.grantId).toBe("my-grant-123");
  });

  it("includes allowedAssets when provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt,
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
    });
    expect(grant.allowedAssets).toEqual([{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }]);
  });
});

describe("createBudgetAuthorization", () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  it("creates unsigned budget authorization", () => {
    const auth = createBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "v1",
      grantId: "grant-1",
      policyHash: "a1b2c3d4e5f6",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      destinationAllowlist: ["rDest"],
      expiresAt,
    });
    expect(auth.version).toBe("1.0");
    expect(auth.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(auth.actorId).toBe("v1");
    expect(auth.policyHash).toBe("a1b2c3d4e5f6");
    expect(auth.maxAmountMinor).toBe("3000");
    expect(auth.budgetScope).toBe("SESSION");
    expect(auth.minorUnit).toBe(2);
    expect(auth.budgetId).toBeDefined();
  });

  it("uses provided budgetId when given", () => {
    const auth = createBudgetAuthorization({
      sessionId: "s1",
      actorId: "v1",
      grantId: "grant-1",
      policyHash: "ph",
      currency: "USD",
      maxAmountMinor: "1000",
      allowedRails: ["stripe"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      budgetId: "budget-abc",
    });
    expect(auth.budgetId).toBe("budget-abc");
  });
});

describe("SDK artifact integration", () => {
  const SBA_ENV = {
    privateKey: process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM,
    publicKey: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
    keyId: process.env.MPCP_SBA_SIGNING_KEY_ID,
  };

  afterEach(() => {
    process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = SBA_ENV.privateKey;
    process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = SBA_ENV.publicKey;
    process.env.MPCP_SBA_SIGNING_KEY_ID = SBA_ENV.keyId;
  });

  function setupKeys() {
    const sbaKeys = crypto.generateKeyPairSync("ed25519");
    process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
    process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
  }

  it("createPolicyGrant + createSignedBudgetAuthorization integrate with verifySettlement", () => {
    setupKeys();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const policyGrant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      expiresAt,
    });

    const signedBudgetAuth = createSignedBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: policyGrant.grantId,
      policyHash: "a1b2c3d4e5f6",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      destinationAllowlist: ["rDestination"],
      expiresAt,
    });
    expect(signedBudgetAuth).not.toBeNull();

    const paymentPolicyDecision = {
      decisionId: "dec-1",
      policyHash: "a1b2c3d4e5f6",
      action: "ALLOW" as const,
      reasons: ["OK"],
      expiresAtISO: expiresAt,
      rail: "xrpl" as const,
      asset: { kind: "IOU" as const, currency: "RLUSD", issuer: "rIssuer" },
      priceFiat: { amountMinor: "2500", currency: "USD" },
      chosen: { rail: "xrpl" as const, quoteId: "q1" },
      settlementQuotes: [
        {
          quoteId: "q1",
          rail: "xrpl" as const,
          amount: { amount: "19440000", decimals: 6 },
          destination: "rDestination",
          expiresAt,
          asset: { kind: "IOU" as const, currency: "RLUSD", issuer: "rIssuer" },
        },
      ],
    };

    const result = verifySettlement({
      policyGrant,
      signedBudgetAuthorization: signedBudgetAuth!,
      paymentPolicyDecision,
    });
    expect(result).toEqual({ valid: true });
  });
});
