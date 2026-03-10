import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
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
import type { PolicyGrantLike } from "../../src/verify/types.js";
import {
  verifyPolicyGrant,
  verifyBudgetAuthorization,
  verifyPaymentAuthorization,
  verifySettlementIntent,
  verifySettlement,
} from "../../src/verify/index.js";

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
/** SPA verification uses settlement.nowISO as verification time; use past so SPA not expired */
const verificationNowIso = new Date(Date.now() - 1000).toISOString();

const baseGrant: PolicyGrantLike = {
  grantId: "grant-1",
  policyHash: "a1b2c3",
  expiresAt: futureExpiry,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

const baseDecision: PaymentPolicyDecision = {
  decisionId: "dec-1",
  policyHash: "a1b2c3",
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

describe("verifyPolicyGrant", () => {
  it("passes when grant not expired", () => {
    expect(verifyPolicyGrant(baseGrant)).toEqual({ valid: true });
  });

  it("fails when grant expired", () => {
    const expired = { ...baseGrant, expiresAt: pastExpiry };
    expect(verifyPolicyGrant(expired)).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
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
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
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
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "deadbeef",
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

describe("verifyPaymentAuthorization", () => {
  it("passes when full chain valid and settlement matches", () => {
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
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
    );
    expect(sba).not.toBeNull();
    expect(spa).not.toBeNull();
    const result = verifyPaymentAuthorization(
      spa!,
      sba!,
      baseGrant,
      baseDecision,
      baseSettlement,
    );
    expect(result).toEqual({ valid: true });
  });

  it("fails when session mismatch", () => {
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: futureExpiry,
    });
    const spa = createSignedPaymentAuthorization(
      "22222222-2222-4222-8222-222222222222", // different session
      baseDecision,
    );
    expect(sba).not.toBeNull();
    expect(spa).not.toBeNull();
    const result = verifyPaymentAuthorization(
      spa!,
      sba!,
      baseGrant,
      baseDecision,
      baseSettlement,
    );
    expect(result).toMatchObject({ valid: false, reason: "payment_auth_session_mismatch", artifact: "signedPaymentAuthorization" });
  });
});

describe("verifySettlementIntent", () => {
  it("passes when intent matches SPA and no intentHash", () => {
    setupBothKeys();
    const spa = createSignedPaymentAuthorization(
      "11111111-1111-4111-8111-111111111111",
      baseDecision,
    );
    expect(spa).not.toBeNull();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
    const result = verifySettlementIntent(spa!, intent);
    expect(result).toEqual({ valid: true });
  });

  it("passes when intentHash matches", () => {
    setupBothKeys();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
    const spa = createSignedPaymentAuthorization(
      "11111111-1111-4111-8111-111111111111",
      baseDecision,
      { settlementIntent: intent },
    );
    expect(spa).not.toBeNull();
    expect(spa!.authorization.intentHash).toBeDefined();
    const result = verifySettlementIntent(spa!, intent);
    expect(result).toEqual({ valid: true });
  });

  it("fails when intentHash present but does not match", () => {
    setupBothKeys();
    const intent = { rail: "xrpl", amount: "19440000", destination: "rDest" };
    const spa = createSignedPaymentAuthorization(
      "11111111-1111-4111-8111-111111111111",
      baseDecision,
      { settlementIntent: intent },
    );
    expect(spa).not.toBeNull();
    const wrongIntent = { rail: "xrpl", amount: "99999999", destination: "rDest" };
    const result = verifySettlementIntent(spa!, wrongIntent);
    expect(result).toMatchObject({ valid: false, reason: "intent_hash_mismatch", artifact: "settlementIntent" });
  });

  it("rejects modified intent even when attacker forges intentHash field (verifier recomputes)", () => {
    setupBothKeys();
    const validIntent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU" as const, currency: "RLUSD", issuer: "rIssuer" },
    };
    const spa = createSignedPaymentAuthorization(
      "11111111-1111-4111-8111-111111111111",
      baseDecision,
      { settlementIntent: validIntent },
    );
    expect(spa).not.toBeNull();
    const tamperedIntent = {
      ...validIntent,
      amount: "99999999",
      intentHash: spa!.authorization.intentHash,
    };
    const result = verifySettlementIntent(spa!, tamperedIntent);
    expect(result).toMatchObject({ valid: false, reason: "intent_hash_mismatch", artifact: "settlementIntent" });
  });
});

describe("verifySettlement", () => {
  it("passes full chain without intentHash", () => {
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
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
    );
    expect(sba).not.toBeNull();
    expect(spa).not.toBeNull();
    const result = verifySettlement({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
    });
    expect(result).toEqual({ valid: true });
  });

  it("passes full chain with settlementIntent", () => {
    setupBothKeys();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
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
      { settlementIntent: intent },
    );
    expect(sba).not.toBeNull();
    expect(spa).not.toBeNull();
    const result = verifySettlement({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
      settlementIntent: intent,
    });
    expect(result).toEqual({ valid: true });
  });

  it("fails when SPA has intentHash but settlementIntent missing", () => {
    setupBothKeys();
    const intent = { rail: "xrpl", amount: "19440000", destination: "rDest" };
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
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
      { settlementIntent: intent },
    );
    expect(sba).not.toBeNull();
    expect(spa).not.toBeNull();
    const result = verifySettlement({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
      // settlementIntent omitted
    });
    expect(result).toMatchObject({ valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" });
  });

  it("fails when grant expired", () => {
    setupBothKeys();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "11111111-1111-4111-8111-111111111111",
      vehicleId: "1234567",
      policyHash: "a1b2c3",
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
    );
    expect(sba).not.toBeNull();
    expect(spa).not.toBeNull();
    const result = verifySettlement({
      policyGrant: { ...baseGrant, expiresAt: pastExpiry },
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
      nowMs: Date.now(),
    });
    expect(result).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
  });
});
