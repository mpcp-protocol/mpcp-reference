/**
 * PR6 — Reference Implementation Conformance (updated PR31: SPA/SettlementIntent removed)
 *
 * Verification suite for this implementation. Each area must pass.
 * - policy grant validation
 * - budget authorization limits
 * - settlement verification (PolicyGrant → SBA chain)
 *
 * The Trust Gateway is mandatory — authorization chain ends at SBA.
 */

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

const defaultSbaConfig = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  actorId: "1234567",
  grantId: "grant-1",
  policyHash: "a1b2c3d4e5f6",
  currency: "USD",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"] as const,
  allowedAssets: [{ kind: "IOU" as const, currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: ["rDestination"],
  expiresAt: futureExpiry,
};

function makeSba(overrides?: Partial<typeof defaultSbaConfig>) {
  const sba = createSignedSessionBudgetAuthorization({ ...defaultSbaConfig, ...overrides });
  expect(sba).not.toBeNull();
  return sba!;
}

describe("Reference Implementation Conformance", () => {
  describe("policy grant validation", () => {
    it("passes when grant not expired", () => {
      expect(verifyPolicyGrant(baseGrant)).toEqual({ valid: true });
    });

    it("fails when grant expired", () => {
      const expired = { ...baseGrant, expiresAt: pastExpiry };
      expect(verifyPolicyGrant(expired)).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
    });
  });

  describe("budget authorization limits", () => {
    it("passes when SBA valid and decision fits budget", () => {
      setupSbaKeys();
      expect(verifyBudgetAuthorization(makeSba(), baseGrant, baseDecision)).toEqual({ valid: true });
    });

    it("fails when policy hash mismatch", () => {
      setupSbaKeys();
      const sba = makeSba({ policyHash: "deadbeefcafe", allowedAssets: [], destinationAllowlist: [] });
      expect(verifyBudgetAuthorization(sba, baseGrant, baseDecision)).toMatchObject({
        valid: false,
        reason: "budget_policy_hash_mismatch",
        artifact: "signedBudgetAuthorization",
      });
    });

    it("fails when budget exceeded", () => {
      setupSbaKeys();
      const grantWithStripe: PolicyGrantLike = { ...baseGrant, allowedRails: ["xrpl", "stripe"] };
      const sba = makeSba({ maxAmountMinor: "1000", allowedRails: ["stripe"], allowedAssets: [], destinationAllowlist: [] });
      const decision: PaymentPolicyDecision = {
        ...baseDecision,
        rail: "stripe",
        priceFiat: { amountMinor: "1200", currency: "USD" },
        chosen: { rail: "stripe", quoteId: "q1" },
        settlementQuotes: [{
          quoteId: "q1",
          rail: "stripe",
          amount: { amount: "1200", decimals: 2 },
          destination: "",
          expiresAt: futureExpiry,
        }],
      };
      expect(verifyBudgetAuthorization(sba, grantWithStripe, decision)).toMatchObject({
        valid: false,
        reason: "budget_exceeded",
        artifact: "signedBudgetAuthorization",
      });
    });
  });

  describe("settlement verification (PolicyGrant → SBA chain)", () => {
    it("passes full chain", () => {
      setupSbaKeys();
      const sba = makeSba();
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba,
        paymentPolicyDecision: baseDecision,
      });
      expect(result).toEqual({ valid: true });
    });

    it("fails when grant expired", () => {
      setupSbaKeys();
      const sba = makeSba({ allowedAssets: [], destinationAllowlist: [] });
      const result = verifySettlement({
        policyGrant: { ...baseGrant, expiresAt: pastExpiry },
        signedBudgetAuthorization: sba,
        paymentPolicyDecision: baseDecision,
        nowMs: Date.now(),
      });
      expect(result).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
    });

    it("fails when policy grant malformed (schema validation at pipeline)", () => {
      setupSbaKeys();
      const sba = makeSba({ allowedAssets: [], destinationAllowlist: [] });
      const malformedGrant = { policyHash: "not-hex!", allowedRails: ["xrpl"] };
      const result = verifySettlement({
        policyGrant: malformedGrant,
        signedBudgetAuthorization: sba,
        paymentPolicyDecision: baseDecision,
      });
      expect(result.valid).toBe(false);
      expect(result).toMatchObject({ artifact: "policyGrant" });
      expect(result.valid === false && result.reason).toMatch(/invalid_artifact/);
    });
  });
});
