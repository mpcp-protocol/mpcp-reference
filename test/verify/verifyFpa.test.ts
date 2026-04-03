import crypto, { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/hash/canonicalJson.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import { verifyFleetPolicyAuthorization } from "../../src/verifier/verifyFpa.js";

const FPA_ENV = {
  publicKey: process.env.MPCP_FPA_SIGNING_PUBLIC_KEY_PEM,
};

afterEach(() => {
  process.env.MPCP_FPA_SIGNING_PUBLIC_KEY_PEM = FPA_ENV.publicKey;
});

let fpaPrivateKey: crypto.KeyObject;

function setupFpaKeys() {
  const keys = crypto.generateKeyPairSync("ed25519");
  fpaPrivateKey = keys.privateKey;
  process.env.MPCP_FPA_SIGNING_PUBLIC_KEY_PEM = keys.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
}

const futureExpiry = new Date(Date.now() + 120_000).toISOString();

const baseGrant: PolicyGrantLike = {
  grantId: "grant-fpa-1",
  policyHash: "ff00ff00ff00",
  expiresAt: futureExpiry,
  allowedRails: ["xrpl", "evm"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  budgetMinor: "50000",
  operatorId: "operator-A",
};

function makeFpaPayload(overrides?: Record<string, unknown>) {
  return {
    version: "1.0" as const,
    fleetPolicyId: "fpa-1",
    fleetId: "fleet-1",
    actorId: "actor-fpa",
    scope: "SESSION" as const,
    currency: "USD",
    minorUnit: 2,
    maxAmountMinor: "40000",
    allowedRails: ["xrpl"] as string[],
    allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
    allowedOperators: ["operator-A"],
    expiresAt: futureExpiry,
    ...overrides,
  };
}

function signFpa(authorization: unknown) {
  const hash = createHash("sha256")
    .update("MPCP:FPA:1.0:" + canonicalJson(authorization))
    .digest();
  return crypto.sign(null, hash, fpaPrivateKey).toString("base64");
}

function makeSignedFpa(overrides?: Record<string, unknown>) {
  const authorization = makeFpaPayload(overrides);
  return {
    authorization,
    issuerKeyId: "fpa-key-1",
    signature: signFpa(authorization),
  };
}

describe("verifyFleetPolicyAuthorization", () => {
  beforeEach(setupFpaKeys);

  it("passes for valid FPA", () => {
    const result = verifyFleetPolicyAuthorization(makeSignedFpa(), baseGrant);
    expect(result).toEqual({ valid: true });
  });

  it("rejects invalid schema", () => {
    const result = verifyFleetPolicyAuthorization({ bad: true }, baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "invalid_fpa_schema" });
  });

  it("rejects expired FPA (with zero drift)", () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    const fpa = makeSignedFpa({ expiresAt: pastExpiry });
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant, {
      clockDriftToleranceMs: 0,
    });
    expect(result).toMatchObject({ valid: false, reason: "fpa_expired" });
  });

  it("accepts expired FPA within drift tolerance", () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    const fpa = makeSignedFpa({ expiresAt: pastExpiry });
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant, {
      clockDriftToleranceMs: 300_000,
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects invalid signature", () => {
    const fpa = makeSignedFpa();
    fpa.signature = "aW52YWxpZA==";
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "invalid_fpa_signature" });
  });

  it("rejects FPA rail not in grant", () => {
    const fpa = makeSignedFpa({ allowedRails: ["evm", "stripe"] });
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "fpa_rail_not_in_grant" });
  });

  it("rejects FPA operator not in grant operator", () => {
    const fpa = makeSignedFpa({ allowedOperators: ["operator-B"] });
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "fpa_operator_not_allowed" });
  });

  it("rejects FPA maxAmountMinor exceeding grant budgetMinor", () => {
    const fpa = makeSignedFpa({ maxAmountMinor: "99999" });
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "fpa_cap_exceeds_grant_budget" });
  });

  it("passes when FPA cap equals grant ceiling", () => {
    const fpa = makeSignedFpa({ maxAmountMinor: "50000" });
    const result = verifyFleetPolicyAuthorization(fpa, baseGrant);
    expect(result).toEqual({ valid: true });
  });

  it("skips operator check when grant has no operatorId", () => {
    const grantNoOp = { ...baseGrant, operatorId: undefined };
    const fpa = makeSignedFpa({ allowedOperators: ["any-operator"] });
    const result = verifyFleetPolicyAuthorization(fpa, grantNoOp);
    expect(result).toEqual({ valid: true });
  });

  it("skips spending cap check when grant has no budgetMinor", () => {
    const grantNoBudget = { ...baseGrant, budgetMinor: undefined };
    const fpa = makeSignedFpa({ maxAmountMinor: "999999999" });
    const result = verifyFleetPolicyAuthorization(fpa, grantNoBudget);
    expect(result).toEqual({ valid: true });
  });
});
