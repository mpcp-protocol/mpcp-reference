import { describe, expect, it } from "vitest";
import {
  createPolicyGrant,
  createBudgetAuthorization,
  createSettlementIntent,
  computeSettlementIntentHash,
  verifyPolicyGrant,
} from "../../src/sdk/index.js";

describe("createPolicyGrant", () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  it("creates valid grant with required fields", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3",
      allowedRails: ["xrpl"],
      expiresAt,
    });
    expect(grant.policyHash).toBe("a1b2c3");
    expect(grant.allowedRails).toEqual(["xrpl"]);
    expect(grant.expiresAt).toBe(expiresAt);
    expect(grant.grantId).toBeDefined();
    expect(typeof grant.grantId).toBe("string");
    expect(verifyPolicyGrant(grant)).toEqual({ valid: true });
  });

  it("uses provided grantId when given", () => {
    const grant = createPolicyGrant({
      policyHash: "deadbeef",
      allowedRails: ["evm"],
      expiresAt,
      grantId: "my-grant-123",
    });
    expect(grant.grantId).toBe("my-grant-123");
  });

  it("includes allowedAssets when provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3",
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
      vehicleId: "v1",
      policyHash: "a1b2c3",
      currency: "USD",
      maxAmountMinor: "3000",
      allowedRails: ["xrpl"],
      allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
      destinationAllowlist: ["rDest"],
      expiresAt,
    });
    expect(auth.version).toBe(1);
    expect(auth.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(auth.vehicleId).toBe("v1");
    expect(auth.policyHash).toBe("a1b2c3");
    expect(auth.maxAmountMinor).toBe("3000");
    expect(auth.budgetScope).toBe("SESSION");
    expect(auth.minorUnit).toBe(2);
    expect(auth.budgetId).toBeDefined();
  });

  it("uses provided budgetId when given", () => {
    const auth = createBudgetAuthorization({
      sessionId: "s1",
      vehicleId: "v1",
      policyHash: "ph",
      currency: "USD",
      maxAmountMinor: "1000",
      allowedRails: ["stripe"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt,
      budgetId: "budget-abc",
    });
    expect(auth.budgetId).toBe("budget-abc");
  });
});

describe("createSettlementIntent", () => {
  it("creates intent with required fields", () => {
    const intent = createSettlementIntent({ rail: "xrpl", amount: "19440000" });
    expect(intent.rail).toBe("xrpl");
    expect(intent.amount).toBe("19440000");
    expect(intent.destination).toBeUndefined();
  });

  it("includes optional fields when provided", () => {
    const intent = createSettlementIntent({
      rail: "xrpl",
      amount: "1000",
      destination: "rDest",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    });
    expect(intent.destination).toBe("rDest");
    expect(intent.asset).toEqual({ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" });
  });

  it("produces hashable intent compatible with computeSettlementIntentHash", () => {
    const intent = createSettlementIntent({
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    });
    const hash = computeSettlementIntentHash(intent);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
