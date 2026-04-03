import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PaymentPolicyDecision } from "../../src/policy-core/types.js";
import { createSignedSessionBudgetAuthorization } from "../../src/protocol/sba.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import {
  runVerificationPipeline,
  type VerificationPipelineOutput,
} from "../../src/verifier/verifyPipeline.js";
import { InMemoryBudgetIdStore } from "../../src/verifier/budgetIdStore.js";

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
  const keys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = keys.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = keys.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
}

const futureExpiry = new Date(Date.now() + 120_000).toISOString();

const baseGrant: PolicyGrantLike = {
  grantId: "grant-secop-1",
  policyHash: "aabbccdd0011",
  expiresAt: futureExpiry,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

const baseDecision: PaymentPolicyDecision = {
  decisionId: "dec-secop-1",
  policyHash: "aabbccdd0011",
  action: "ALLOW",
  reasons: ["OK"],
  expiresAtISO: futureExpiry,
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  priceFiat: { amountMinor: "1000", currency: "USD" },
  chosen: { rail: "xrpl", quoteId: "q1" },
  settlementQuotes: [
    {
      quoteId: "q1",
      rail: "xrpl",
      amount: { amount: "1000000", decimals: 6 },
      destination: "rDestination",
      expiresAt: futureExpiry,
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    },
  ],
};

function makeSba() {
  return createSignedSessionBudgetAuthorization({
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    actorId: "actor-1",
    grantId: "grant-secop-1",
    policyHash: "aabbccdd0011",
    currency: "USD",
    maxAmountMinor: "5000",
    allowedRails: ["xrpl"],
    allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
    destinationAllowlist: ["rDestination"],
    expiresAt: futureExpiry,
  })!;
}

function expectFail(
  output: VerificationPipelineOutput,
  reason: string,
  checkName?: string,
) {
  expect(output.result).toMatchObject({ valid: false, reason });
  if (checkName) {
    expect(output.checks.some((c) => c.name === checkName && !c.valid)).toBe(true);
  }
}

// ---------- authorizedGateway (SECOP 6b) ----------

describe("SECOP 6b — authorizedGateway", () => {
  beforeEach(setupSbaKeys);

  it("passes when gateway matches grant.authorizedGateway", () => {
    const grant = { ...baseGrant, authorizedGateway: "rGateway123" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      gatewayAddress: "rGateway123",
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.authorizedGateway")?.valid).toBe(true);
  });

  it("fails when gateway does not match", () => {
    const grant = { ...baseGrant, authorizedGateway: "rGateway123" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      gatewayAddress: "rDifferentGateway",
    });
    expectFail(result, "GATEWAY_NOT_AUTHORIZED", "PolicyGrant.authorizedGateway");
  });

  it("skips check when grant has no authorizedGateway", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      gatewayAddress: "rAnyGateway",
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.authorizedGateway")).toBeUndefined();
  });

  it("skips check when no gatewayAddress in context", () => {
    const grant = { ...baseGrant, authorizedGateway: "rGateway123" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
  });
});

// ---------- allowedPurposes (SECOP 1a) ----------

describe("SECOP 1a — allowedPurposes", () => {
  beforeEach(setupSbaKeys);

  it("passes when purpose matches allowedPurposes", () => {
    const grant = { ...baseGrant, allowedPurposes: ["parking", "ev-charging"] };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      purpose: "parking",
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.allowedPurposes")?.valid).toBe(true);
  });

  it("fails when purpose not in allowedPurposes", () => {
    const grant = { ...baseGrant, allowedPurposes: ["parking", "ev-charging"] };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      purpose: "food",
    });
    expectFail(result, "PURPOSE_NOT_ALLOWED", "PolicyGrant.allowedPurposes");
  });

  it("uses decision.purpose when ctx.purpose not set", () => {
    const grant = { ...baseGrant, allowedPurposes: ["parking"] };
    const decision = { ...baseDecision, purpose: "parking" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: decision,
    });
    expect(result.result).toEqual({ valid: true });
  });

  it("fails when decision.purpose not allowed", () => {
    const grant = { ...baseGrant, allowedPurposes: ["parking"] };
    const decision = { ...baseDecision, purpose: "food" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: decision,
    });
    expectFail(result, "PURPOSE_NOT_ALLOWED");
  });

  it("skips check when grant has no allowedPurposes", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      purpose: "anything",
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.allowedPurposes")).toBeUndefined();
  });

  it("skips check when no purpose provided", () => {
    const grant = { ...baseGrant, allowedPurposes: ["parking"] };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
  });
});

// ---------- budgetId replay (SECOP 4a / 3b) ----------

describe("SECOP 4a/3b — budgetId replay prevention", () => {
  beforeEach(setupSbaKeys);

  it("passes on first submission", () => {
    const store = new InMemoryBudgetIdStore();
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      budgetIdStore: store,
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "SignedBudgetAuthorization.budgetIdReplay")?.valid).toBe(true);
    expect(store.size).toBe(1);
  });

  it("rejects replay of same budgetId", () => {
    const store = new InMemoryBudgetIdStore();
    const sba = makeSba();
    runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba,
      paymentPolicyDecision: baseDecision,
      budgetIdStore: store,
    });
    const second = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba,
      paymentPolicyDecision: baseDecision,
      budgetIdStore: store,
    });
    expectFail(second, "BUDGET_ID_REPLAY", "SignedBudgetAuthorization.budgetIdReplay");
  });

  it("skips check when no budgetIdStore provided", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "SignedBudgetAuthorization.budgetIdReplay")).toBeUndefined();
  });
});

// ---------- actorId binding (SECOP 5a-c) ----------

describe("SECOP 5a-c — actorId binding", () => {
  beforeEach(setupSbaKeys);

  it("passes when actorId matches expected", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      expectedActorId: "actor-1",
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "SignedBudgetAuthorization.actorIdBinding")?.valid).toBe(true);
  });

  it("fails when actorId does not match", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      expectedActorId: "different-actor",
    });
    expectFail(result, "ACTOR_ID_MISMATCH", "SignedBudgetAuthorization.actorIdBinding");
  });

  it("skips check when no expectedActorId", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "SignedBudgetAuthorization.actorIdBinding")).toBeUndefined();
  });
});

// ---------- budgetMinor ceiling (SECOP 10a) ----------

describe("SECOP 10a — grant-level budgetMinor ceiling", () => {
  beforeEach(setupSbaKeys);

  it("passes when cumulative spend + payment is within ceiling", () => {
    const grant = { ...baseGrant, budgetMinor: "10000" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      grantCumulativeSpentMinor: "5000",
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.budgetMinorCeiling")?.valid).toBe(true);
  });

  it("fails when cumulative spend + payment exceeds ceiling", () => {
    const grant = { ...baseGrant, budgetMinor: "5000" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      grantCumulativeSpentMinor: "4500",
    });
    expectFail(result, "GRANT_BUDGET_EXCEEDED", "PolicyGrant.budgetMinorCeiling");
  });

  it("passes at exact ceiling boundary", () => {
    const grant = { ...baseGrant, budgetMinor: "2000" };
    const decision = { ...baseDecision, priceFiat: { amountMinor: "1000", currency: "USD" } };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: decision,
      grantCumulativeSpentMinor: "1000",
    });
    expect(result.result).toEqual({ valid: true });
  });

  it("fails at ceiling + 1", () => {
    const grant = { ...baseGrant, budgetMinor: "2000" };
    const decision = { ...baseDecision, priceFiat: { amountMinor: "1001", currency: "USD" } };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: decision,
      grantCumulativeSpentMinor: "1000",
    });
    expectFail(result, "GRANT_BUDGET_EXCEEDED");
  });

  it("defaults grantCumulativeSpentMinor to 0 if not provided", () => {
    const grant = { ...baseGrant, budgetMinor: "2000" };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
  });

  it("skips check when grant has no budgetMinor", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.budgetMinorCeiling")).toBeUndefined();
  });
});

// ---------- destinationAllowlist (SECOP 1b) ----------

describe("SECOP 1b — grant-level destinationAllowlist", () => {
  beforeEach(setupSbaKeys);

  it("passes when destination is in allowlist", () => {
    const grant = { ...baseGrant, destinationAllowlist: ["rDestination", "rOther"] };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.destinationAllowlist")?.valid).toBe(true);
  });

  it("fails when destination not in allowlist", () => {
    const grant = { ...baseGrant, destinationAllowlist: ["rAllowed1", "rAllowed2"] };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expectFail(result, "DESTINATION_NOT_ALLOWED", "PolicyGrant.destinationAllowlist");
  });

  it("skips check when grant has no destinationAllowlist", () => {
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
    });
    expect(result.result).toEqual({ valid: true });
    expect(result.checks.find((c) => c.name === "PolicyGrant.destinationAllowlist")).toBeUndefined();
  });

  it("skips when no settlement quote is chosen", () => {
    const grant = { ...baseGrant, destinationAllowlist: ["rOnlyAllowed"] };
    const decision: PaymentPolicyDecision = {
      ...baseDecision,
      chosen: undefined,
      settlementQuotes: undefined,
    };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: decision,
    });
    expect(result.result).toEqual({ valid: true });
  });
});

// ---------- clockDriftToleranceMs ----------

describe("clockDriftToleranceMs propagation", () => {
  beforeEach(setupSbaKeys);

  it("accepts expired grant within drift tolerance", () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    const grant = { ...baseGrant, expiresAt: pastExpiry };
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "actor-1",
      grantId: "grant-secop-1",
      policyHash: "aabbccdd0011",
      currency: "USD",
      maxAmountMinor: "5000",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      destinationAllowlist: ["rDestination"],
      expiresAt: pastExpiry,
    })!;
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: sba,
      paymentPolicyDecision: baseDecision,
      clockDriftToleranceMs: 300_000,
    });
    expect(result.result).toEqual({ valid: true });
  });

  it("rejects expired grant with zero drift tolerance", () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    const grant = { ...baseGrant, expiresAt: pastExpiry };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      clockDriftToleranceMs: 0,
    });
    expect(result.result).toMatchObject({ valid: false, reason: "policy_grant_expired" });
  });

  it("forwards clockDriftToleranceMs to SBA verifier (bug #1 regression test)", () => {
    const pastSbaExpiry = new Date(Date.now() - 60_000).toISOString();
    const sba = createSignedSessionBudgetAuthorization({
      sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "actor-1",
      grantId: "grant-secop-1",
      policyHash: "aabbccdd0011",
      currency: "USD",
      maxAmountMinor: "5000",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      destinationAllowlist: ["rDestination"],
      expiresAt: pastSbaExpiry,
    })!;
    const result = runVerificationPipeline({
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba,
      paymentPolicyDecision: baseDecision,
      clockDriftToleranceMs: 0,
    });
    expect(result.result).toMatchObject({ valid: false });
    expect(
      result.result.valid === false && result.result.reason,
    ).toMatch(/expired/);
  });
});

// ---------- combined SECOP checks ordering ----------

describe("SECOP check ordering", () => {
  beforeEach(setupSbaKeys);

  it("schema checks run before policy checks", () => {
    const result = runVerificationPipeline({
      policyGrant: { grantId: "x" } as unknown as PolicyGrantLike,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      gatewayAddress: "rGateway",
    });
    expect(result.result.valid).toBe(false);
    expect(result.checks[0]?.phase).toBe("schema");
  });

  it("authorizedGateway check runs before allowedPurposes", () => {
    const grant = {
      ...baseGrant,
      authorizedGateway: "rGateway123",
      allowedPurposes: ["parking"],
    };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      gatewayAddress: "rWrongGateway",
      purpose: "food",
    });
    expectFail(result, "GATEWAY_NOT_AUTHORIZED");
  });

  it("all SECOP checks pass for a fully-configured valid context", () => {
    const store = new InMemoryBudgetIdStore();
    const grant: PolicyGrantLike = {
      ...baseGrant,
      authorizedGateway: "rGateway",
      allowedPurposes: ["parking"],
      budgetMinor: "50000",
      destinationAllowlist: ["rDestination"],
    };
    const result = runVerificationPipeline({
      policyGrant: grant,
      signedBudgetAuthorization: makeSba(),
      paymentPolicyDecision: baseDecision,
      gatewayAddress: "rGateway",
      purpose: "parking",
      expectedActorId: "actor-1",
      budgetIdStore: store,
      grantCumulativeSpentMinor: "10000",
    });
    expect(result.result).toEqual({ valid: true });
    const checkNames = result.checks.map((c) => c.name);
    expect(checkNames).toContain("PolicyGrant.authorizedGateway");
    expect(checkNames).toContain("PolicyGrant.allowedPurposes");
    expect(checkNames).toContain("SignedBudgetAuthorization.budgetIdReplay");
    expect(checkNames).toContain("SignedBudgetAuthorization.actorIdBinding");
    expect(checkNames).toContain("PolicyGrant.budgetMinorCeiling");
    expect(checkNames).toContain("PolicyGrant.destinationAllowlist");
    expect(result.checks.every((c) => c.valid)).toBe(true);
  });
});
