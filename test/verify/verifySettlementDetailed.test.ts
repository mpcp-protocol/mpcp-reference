import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { PaymentPolicyDecision } from "../../src/policy-core/types.js";
import { createSignedSessionBudgetAuthorization } from "../../src/protocol/sba.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import {
  verifySettlementDetailed,
  verifySettlementDetailedSafe,
} from "../../src/verifier/index.js";

function setupSbaKeys() {
  const sbaKeys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
}

const futureExpiry = new Date(Date.now() + 60_000).toISOString();

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

afterEach(() => {
  delete process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_KEY_ID;
});

describe("verifySettlementDetailed", () => {
  it("returns detailed report on success", () => {
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
    const report = verifySettlementDetailed({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    });
    expect(report.valid).toBe(true);
    expect(report.checks.every((c) => c.valid)).toBe(true);
    expect(report.checks.some((c) => c.name === "PolicyGrant.schema")).toBe(true);
    expect(report.checks.some((c) => c.name === "SignedBudgetAuthorization.schema")).toBe(true);
  });

  it("verifySettlementDetailedSafe catches exceptions", () => {
    const throwingGrant = { ...baseGrant };
    Object.defineProperty(throwingGrant, "policyHash", {
      get: () => {
        throw new Error("access error");
      },
      configurable: true,
    });
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
    const report = verifySettlementDetailedSafe({
      policyGrant: throwingGrant,
      signedBudgetAuthorization: sba!,
      paymentPolicyDecision: baseDecision,
    });
    expect(report.valid).toBe(false);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].reason).toMatch(/access error/);
  });
});
