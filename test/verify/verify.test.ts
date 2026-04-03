import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type {
  PaymentPolicyDecision,
} from "../../src/policy-core/types.js";
import {
  createSignedSessionBudgetAuthorization,
} from "../../src/protocol/sba.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import {
  verifyPolicyGrant,
  verifyBudgetAuthorization,
  verifySettlement,
  verifySettlementSafe,
  verifySettlementWithReport,
  verifySettlementWithReportSafe,
} from "../../src/verifier/index.js";

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

function setupSbaKeys() {
  const sbaKeys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
}

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
const pastExpiry = new Date(Date.now() - 60_000).toISOString();

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

describe("verifyPolicyGrant", () => {
  it("passes when grant not expired", () => {
    expect(verifyPolicyGrant(baseGrant)).toEqual({ valid: true });
  });

  it("fails when grant expired", () => {
    const expired = { ...baseGrant, expiresAt: pastExpiry };
    expect(verifyPolicyGrant(expired, { clockDriftToleranceMs: 0 })).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
  });

  it("fails when grant missing expiry", () => {
    const noExpiry = { ...baseGrant, expiresAt: undefined, expiresAtISO: undefined };
    const result = verifyPolicyGrant(noExpiry);
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.reason).toContain("policy_grant_missing_expiry");
  });

  it("uses expiresAtISO when expiresAt missing", () => {
    const isoOnly = { ...baseGrant, expiresAt: undefined, expiresAtISO: futureExpiry };
    expect(verifyPolicyGrant(isoOnly)).toEqual({ valid: true });
  });

  it("rejects malformed grant with invalid_artifact", () => {
    const malformed = { policyHash: "not-hex!", allowedRails: ["xrpl"] };
    const result = verifyPolicyGrant(malformed);
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ valid: false, artifact: "policyGrant" });
    expect(result.valid === false && result.reason).toMatch(/invalid_artifact/);
  });
});

describe("verifyBudgetAuthorization", () => {
  it("passes when SBA valid and decision fits budget", () => {
    setupSbaKeys();
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
    expect(sba).not.toBeNull();
    const result = verifyBudgetAuthorization(sba!, baseGrant, baseDecision);
    expect(result).toEqual({ valid: true });
  });

  it("rejects malformed SBA with invalid_artifact", () => {
    const result = verifyBudgetAuthorization({ authorization: {} }, baseGrant, baseDecision);
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ valid: false, artifact: "signedBudgetAuthorization" });
    expect(result.valid === false && result.reason).toMatch(/invalid_artifact/);
  });

  it("fails when policy hash mismatch", () => {
    setupSbaKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      actorId: "1234567",
      grantId: "grant-1",
      policyHash: "deadbeefcafe",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: futureExpiry,
    });
    expect(sba).not.toBeNull();
    const result = verifyBudgetAuthorization(sba!, baseGrant, baseDecision);
    expect(result).toMatchObject({ valid: false, reason: "budget_policy_hash_mismatch", artifact: "signedBudgetAuthorization" });
  });
});

describe("verifySettlement", () => {
  it("passes full chain (PolicyGrant → SBA)", () => {
    setupSbaKeys();
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
    expect(sba).not.toBeNull();
    const result = verifySettlement({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    });
    expect(result).toEqual({ valid: true });
  });

  it("fails when grant expired", () => {
    setupSbaKeys();
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
    expect(sba).not.toBeNull();
    const result = verifySettlement({
      policyGrant: { ...baseGrant, expiresAt: pastExpiry },
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
      nowMs: Date.now(),
      clockDriftToleranceMs: 0,
    });
    expect(result).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
  });

  it("verifySettlementSafe returns same result as verifySettlement on success", () => {
    setupSbaKeys();
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
    const ctx = {
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    };
    expect(verifySettlementSafe(ctx)).toEqual(verifySettlement(ctx));
    expect(verifySettlementSafe(ctx)).toEqual({ valid: true });
  });

  it("verifySettlementSafe catches thrown exceptions and returns VerificationResult", () => {
    setupSbaKeys();
    const throwingGrant = { ...baseGrant };
    Object.defineProperty(throwingGrant, "policyHash", {
      get: () => {
        throw new Error("access error");
      },
      configurable: true,
    });
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
    const result = verifySettlementSafe({
      policyGrant: throwingGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    });
    expect(result.valid).toBe(false);
    expect(result.valid === false && result.reason).toMatch(/verification_error/);
  });

  it("verifySettlementWithReport returns steps for full chain", () => {
    setupSbaKeys();
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
    const ctx = {
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    };
    const report = verifySettlementWithReport(ctx);
    expect(report.result).toEqual({ valid: true });
    expect(report.steps.map((s) => s.name)).toEqual([
      "PolicyGrant.valid",
      "SignedBudgetAuthorization.valid",
    ]);
    expect(report.steps.every((s) => s.ok)).toBe(true);
  });

  it("verifySettlementWithReport reports first failing step", () => {
    setupSbaKeys();
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
    const report = verifySettlementWithReport({
      policyGrant: { ...baseGrant, expiresAt: pastExpiry },
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
      nowMs: Date.now(),
      clockDriftToleranceMs: 0,
    });
    expect(report.result.valid).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]).toMatchObject({ name: "PolicyGrant.valid", ok: false });
  });

  it("verifySettlementWithReportSafe catches exceptions", () => {
    setupSbaKeys();
    const throwingGrant = { ...baseGrant };
    Object.defineProperty(throwingGrant, "policyHash", {
      get: () => { throw new Error("access error"); },
      configurable: true,
    });
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
    const report = verifySettlementWithReportSafe({
      policyGrant: throwingGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    });
    expect(report.result.valid).toBe(false);
    expect(report.steps[0].reason).toMatch(/access error/);
  });
});
