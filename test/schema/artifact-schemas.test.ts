import { describe, expect, it } from "vitest";
import {
  policyGrantSchema,
  budgetAuthorizationSchema,
  signedBudgetAuthorizationSchema,
  paymentAuthorizationSchema,
  signedPaymentAuthorizationSchema,
  settlementIntentSchema,
  fleetPolicyAuthorizationSchema,
  validateWithSchema,
} from "../../src/schema/index.js";

const validPolicyGrant = {
  version: "1.0",
  grantId: "grant_7ab3",
  policyHash: "9f3a0d",
  subjectId: "vehicle_1284",
  scope: "SESSION",
  allowedRails: ["xrpl", "stripe"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  expiresAt: "2026-03-08T14:00:00Z",
};

const validBudgetAuthorization = {
  version: "1.0",
  budgetId: "550e8400-e29b-41d4-a716-446655440000",
  sessionId: "sess_456",
  vehicleId: "veh_001",
  policyHash: "a1b2c3",
  currency: "USD",
  minorUnit: 2,
  budgetScope: "SESSION",
  maxAmountMinor: "3000",
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "USDC", issuer: "rIssuer" }],
  expiresAt: "2026-03-08T14:00:00Z",
};

const validPaymentAuthorization = {
  version: "1.0",
  decisionId: "dec_123",
  sessionId: "sess_456",
  policyHash: "a1b2c3",
  quoteId: "quote_789",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "USDC", issuer: "rIssuer" },
  amount: "19440000",
  destination: "rDest",
  expiresAt: "2026-03-08T14:00:00Z",
};

const validSettlementIntent = {
  version: "1.0",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  amount: "19440000",
  destination: "rDestination",
  createdAt: "2026-03-08T13:55:00Z",
};

const validFleetPolicyPayload = {
  version: "1.0",
  fleetPolicyId: "fp_123",
  fleetId: "fleet_waymo_sf",
  vehicleId: "veh_456",
  scope: "DAY",
  currency: "USD",
  minorUnit: 2,
  maxAmountMinor: "5000",
  allowedRails: ["xrpl", "stripe"],
  allowedAssets: ["RLUSD"],
  allowedOperators: ["operator_42"],
  expiresAt: "2026-03-09T23:59:59Z",
};

describe("PolicyGrant schema", () => {
  it("accepts valid PolicyGrant", () => {
    const result = validateWithSchema(policyGrantSchema, validPolicyGrant);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.grantId).toBe("grant_7ab3");
  });

  it("accepts version as number 1 (backward compat; protocol recommends '1.0' strings)", () => {
    const result = validateWithSchema(policyGrantSchema, {
      ...validPolicyGrant,
      version: 1,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing required field with clear error", () => {
    const result = validateWithSchema(policyGrantSchema, {
      ...validPolicyGrant,
      grantId: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("grantId");
    }
  });

  it("rejects invalid expiresAt format", () => {
    const result = validateWithSchema(policyGrantSchema, {
      ...validPolicyGrant,
      expiresAt: "not-iso-datetime",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid policyHash format", () => {
    const result = validateWithSchema(policyGrantSchema, {
      ...validPolicyGrant,
      policyHash: "not-hex!",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid scope", () => {
    const result = validateWithSchema(policyGrantSchema, {
      ...validPolicyGrant,
      scope: "INVALID_SCOPE",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields (strict)", () => {
    const result = validateWithSchema(policyGrantSchema, {
      ...validPolicyGrant,
      unexpectedField: "should fail",
    });
    expect(result.ok).toBe(false);
  });
});

describe("BudgetAuthorization schema", () => {
  it("accepts valid BudgetAuthorization", () => {
    const result = validateWithSchema(budgetAuthorizationSchema, validBudgetAuthorization);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid currency format", () => {
    const result = validateWithSchema(budgetAuthorizationSchema, {
      ...validBudgetAuthorization,
      currency: "US", // not 3 chars
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid minorUnit (negative)", () => {
    const result = validateWithSchema(budgetAuthorizationSchema, {
      ...validBudgetAuthorization,
      minorUnit: -1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid budgetScope", () => {
    const result = validateWithSchema(budgetAuthorizationSchema, {
      ...validBudgetAuthorization,
      budgetScope: "INVALID",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields (strict)", () => {
    const result = validateWithSchema(budgetAuthorizationSchema, {
      ...validBudgetAuthorization,
      extraKey: "invalid",
    });
    expect(result.ok).toBe(false);
  });
});

describe("SignedBudgetAuthorization schema", () => {
  it("accepts valid envelope", () => {
    const result = validateWithSchema(signedBudgetAuthorizationSchema, {
      authorization: validBudgetAuthorization,
      signature: "base64...",
      keyId: "mpcp-sba-signing-key-1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing signature", () => {
    const result = validateWithSchema(signedBudgetAuthorizationSchema, {
      authorization: validBudgetAuthorization,
      keyId: "key",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields (strict)", () => {
    const result = validateWithSchema(signedBudgetAuthorizationSchema, {
      authorization: validBudgetAuthorization,
      signature: "base64...",
      keyId: "key",
      unknown: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("PaymentAuthorization schema", () => {
  it("accepts valid PaymentAuthorization", () => {
    const result = validateWithSchema(paymentAuthorizationSchema, validPaymentAuthorization);
    expect(result.ok).toBe(true);
  });

  it("accepts optional intentHash", () => {
    const result = validateWithSchema(paymentAuthorizationSchema, {
      ...validPaymentAuthorization,
      intentHash: "a".repeat(64),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid intentHash (wrong length)", () => {
    const result = validateWithSchema(paymentAuthorizationSchema, {
      ...validPaymentAuthorization,
      intentHash: "abc", // not 64 chars
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields (strict)", () => {
    const result = validateWithSchema(paymentAuthorizationSchema, {
      ...validPaymentAuthorization,
      rogue: "field",
    });
    expect(result.ok).toBe(false);
  });
});

describe("SignedPaymentAuthorization schema", () => {
  it("accepts valid envelope", () => {
    const result = validateWithSchema(signedPaymentAuthorizationSchema, {
      authorization: validPaymentAuthorization,
      signature: "base64...",
      keyId: "mpcp-spa-signing-key-1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unexpected fields (strict)", () => {
    const result = validateWithSchema(signedPaymentAuthorizationSchema, {
      authorization: validPaymentAuthorization,
      signature: "base64...",
      keyId: "key",
      unknownField: "invalid",
    });
    expect(result.ok).toBe(false);
  });
});

describe("SettlementIntent schema", () => {
  it("accepts valid SettlementIntent", () => {
    const result = validateWithSchema(settlementIntentSchema, validSettlementIntent);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid createdAt format", () => {
    const result = validateWithSchema(settlementIntentSchema, {
      ...validSettlementIntent,
      createdAt: "invalid",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid rail", () => {
    const result = validateWithSchema(settlementIntentSchema, {
      ...validSettlementIntent,
      rail: "bitcoin",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields (strict)", () => {
    const result = validateWithSchema(settlementIntentSchema, {
      ...validSettlementIntent,
      extra: "field",
    });
    expect(result.ok).toBe(false);
  });
});

describe("FleetPolicyAuthorization schema", () => {
  it("accepts valid FleetPolicyAuthorization", () => {
    const result = validateWithSchema(fleetPolicyAuthorizationSchema, {
      authorization: validFleetPolicyPayload,
      signature: "base64...",
      keyId: "fleet-signing-key-1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unexpected fields in envelope (strict)", () => {
    const result = validateWithSchema(fleetPolicyAuthorizationSchema, {
      authorization: validFleetPolicyPayload,
      signature: "base64...",
      keyId: "key",
      unwanted: true,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects unexpected fields in payload (strict)", () => {
    const result = validateWithSchema(fleetPolicyAuthorizationSchema, {
      authorization: { ...validFleetPolicyPayload, invalidPayloadField: "x" },
      signature: "base64...",
      keyId: "key",
    });
    expect(result.ok).toBe(false);
  });
});
