/**
 * PR6 — Reference Implementation Conformance
 *
 * Verification suite for this implementation. Each area must pass.
 * - intent hash correctness
 * - policy grant validation
 * - budget authorization limits
 * - SPA verification
 * - settlement verification
 *
 * Uses Parker-shaped inputs (PaymentPolicyDecision, createSigned* helpers, quote
 * structures). For pure protocol conformance across implementations, use protocol-
 * agnostic fixtures and raw artifacts instead.
 */

import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { computeSettlementIntentHash } from "../../src/hash/index.js";
import type {
  PaymentPolicyDecision,
  SettlementResult,
} from "../../src/policy-core/types.js";
import {
  createSignedSessionBudgetAuthorization,
} from "../../src/protocol/sba.js";
import {
  createSignedPaymentAuthorization,
} from "../../src/protocol/spa.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import {
  verifyPolicyGrant,
  verifyBudgetAuthorization,
  verifyPaymentAuthorization,
  verifySettlementIntent,
  verifySettlement,
} from "../../src/verifier/index.js";

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

function setupBothKeys() {
  const sbaKeys = crypto.generateKeyPairSync("ed25519");
  const spaKeys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";
}

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
const pastExpiry = new Date(Date.now() - 60_000).toISOString();
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

function makeSpa(opts?: { sessionId?: string; settlementIntent?: unknown; budgetId?: string }) {
  const sessionId = opts?.sessionId ?? defaultSbaConfig.sessionId;
  const budgetId = opts?.budgetId ?? "00000000-0000-4000-8000-000000000000";
  const spa = createSignedPaymentAuthorization(
    sessionId,
    baseDecision,
    opts?.settlementIntent
      ? { settlementIntent: opts.settlementIntent, budgetId }
      : { budgetId },
  );
  expect(spa).not.toBeNull();
  return spa!;
}

const defaultIntent = {
  rail: "xrpl" as const,
  amount: "19440000",
  destination: "rDestination",
  asset: { kind: "IOU" as const, currency: "RLUSD", issuer: "rIssuer" },
};

function makeIntent(overrides?: Partial<typeof defaultIntent>) {
  return { ...defaultIntent, ...overrides };
}

describe("Reference Implementation Conformance", () => {
  describe("intent hash correctness", () => {
    it("produces deterministic hash from canonical intent", () => {
      const intent = { rail: "xrpl" as const, amount: "19440000", destination: "rDest" };
      const h1 = computeSettlementIntentHash(intent);
      const h2 = computeSettlementIntentHash(intent);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("detects field change via hash mismatch", () => {
      const intent = { rail: "xrpl" as const, amount: "1000" };
      const altered = { rail: "xrpl" as const, amount: "2000" };
      expect(computeSettlementIntentHash(intent)).not.toBe(computeSettlementIntentHash(altered));
    });

    it("excludes metadata (createdAt) from hash; identical payloads produce same hash", () => {
      const semantic = { rail: "xrpl" as const, amount: "19440000", destination: "rDest" };
      const h = computeSettlementIntentHash(semantic);
      expect(computeSettlementIntentHash({ ...semantic, createdAt: "2026-03-08T13:55:00Z" })).toBe(h);
      expect(computeSettlementIntentHash({ ...semantic, createdAt: "2026-03-09T00:00:00Z" })).toBe(h);
    });

    it("verifier rejects tampered intent with forged intentHash (recomputes from intent, never trusts provided hash)", () => {
      setupBothKeys();
      const validIntent = makeIntent();
      const spa = makeSpa({ settlementIntent: validIntent });
      const tamperedIntent = { ...validIntent, amount: "99999999", intentHash: spa.authorization.intentHash };
      const result = verifySettlementIntent(spa, tamperedIntent);
      expect(result).toMatchObject({ valid: false, reason: "intent_hash_mismatch", artifact: "settlementIntent" });
    });
  });

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
      setupBothKeys();
      expect(verifyBudgetAuthorization(makeSba(), baseGrant, baseDecision)).toEqual({ valid: true });
    });

    it("fails when policy hash mismatch", () => {
      setupBothKeys();
      const sba = makeSba({ policyHash: "deadbeefcafe", allowedAssets: [], destinationAllowlist: [] });
      expect(verifyBudgetAuthorization(sba, baseGrant, baseDecision)).toMatchObject({
        valid: false,
        reason: "budget_policy_hash_mismatch",
        artifact: "signedBudgetAuthorization",
      });
    });

    it("fails when budget exceeded", () => {
      setupBothKeys();
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

  describe("SPA verification", () => {
    it("passes when full chain valid and settlement matches", () => {
      setupBothKeys();
      const sba = makeSba();
      const spa = makeSpa({ budgetId: sba.authorization.budgetId });
      expect(verifyPaymentAuthorization(spa, sba, baseGrant, baseDecision, baseSettlement)).toEqual({ valid: true });
    });

    it("fails when session mismatch between SPA and SBA", () => {
      setupBothKeys();
      const sba = makeSba({ allowedAssets: [], destinationAllowlist: [] });
      const spa = makeSpa({ sessionId: "22222222-2222-4222-8222-222222222222", budgetId: sba.authorization.budgetId });
      expect(verifyPaymentAuthorization(spa, sba, baseGrant, baseDecision, baseSettlement)).toMatchObject({
        valid: false,
        reason: "payment_auth_session_mismatch",
        artifact: "signedPaymentAuthorization",
      });
    });

    it("verifies intentHash when SPA binds intent", () => {
      setupBothKeys();
      const intent = makeIntent();
      const spa = makeSpa({ settlementIntent: intent });
      expect(spa.authorization.intentHash).toBeDefined();
      expect(verifySettlementIntent(spa, intent)).toEqual({ valid: true });
      expect(verifySettlementIntent(spa, makeIntent({ amount: "99999999" }))).toMatchObject({
        valid: false,
        reason: "intent_hash_mismatch",
        artifact: "settlementIntent",
      });
    });
  });

  describe("settlement verification", () => {
    it("passes full chain without intentHash", () => {
      setupBothKeys();
      const sba = makeSba();
      const spa = makeSpa({ budgetId: sba.authorization.budgetId });
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba,
        signedPaymentAuthorization: spa,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
      });
      expect(result).toEqual({ valid: true });
    });

    it("passes full chain with settlementIntent", () => {
      setupBothKeys();
      const intent = makeIntent();
      const sba = makeSba();
      const spa = makeSpa({ settlementIntent: intent, budgetId: sba.authorization.budgetId });
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba,
        signedPaymentAuthorization: spa,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
        settlementIntent: intent,
      });
      expect(result).toEqual({ valid: true });
    });

    it("fails when grant expired", () => {
      setupBothKeys();
      const sba = makeSba({ allowedAssets: [], destinationAllowlist: [] });
      const spa = makeSpa();
      const result = verifySettlement({
        policyGrant: { ...baseGrant, expiresAt: pastExpiry },
        signedBudgetAuthorization: sba,
        signedPaymentAuthorization: spa,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
        nowMs: Date.now(),
      });
      expect(result).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
    });

    it("fails when policy grant malformed (schema validation at pipeline)", () => {
      setupBothKeys();
      const sba = makeSba({ allowedAssets: [], destinationAllowlist: [] });
      const spa = makeSpa();
      const malformedGrant = { policyHash: "not-hex!", allowedRails: ["xrpl"] };
      const result = verifySettlement({
        policyGrant: malformedGrant,
        signedBudgetAuthorization: sba,
        signedPaymentAuthorization: spa,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
      });
      expect(result.valid).toBe(false);
      expect(result).toMatchObject({ artifact: "policyGrant" });
      expect(result.valid === false && result.reason).toMatch(/invalid_artifact/);
    });

    it("fails when SPA has intentHash but settlementIntent missing", () => {
      setupBothKeys();
      const intent = makeIntent({ destination: "rDest" });
      const sba = makeSba({ allowedAssets: [], destinationAllowlist: [] });
      const spa = makeSpa({ settlementIntent: intent });
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba,
        signedPaymentAuthorization: spa,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
        // settlementIntent omitted
      });
      expect(result).toMatchObject({ valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" });
    });
  });
});
