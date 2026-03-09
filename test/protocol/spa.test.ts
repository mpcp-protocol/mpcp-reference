import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { PaymentPolicyDecision, SettlementResult } from "../../src/policy-core/types.js";
import {
  createSignedPaymentAuthorization,
  verifySignedPaymentAuthorizationForSettlement,
} from "../../src/protocol/spa.js";

const ORIGINAL_ENV = {
  privateKey: process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SPA_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = ORIGINAL_ENV.privateKey;
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = ORIGINAL_ENV.publicKey;
  process.env.MPCP_SPA_SIGNING_KEY_ID = ORIGINAL_ENV.keyId;
});

function setupKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";
}

const baseDecision: PaymentPolicyDecision = {
  decisionId: "dec-1",
  policyHash: "ph-1",
  action: "ALLOW",
  reasons: ["OK"],
  expiresAtISO: "2030-01-01T00:01:00.000Z",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  chosen: { rail: "xrpl", quoteId: "q1" },
  settlementQuotes: [
    {
      quoteId: "q1",
      rail: "xrpl",
      amount: { amount: "19440000", decimals: 6 },
      destination: "rDestination",
      expiresAt: "2030-01-01T00:01:00.000Z",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    },
  ],
};

const baseSettlement: SettlementResult = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: "2030-01-01T00:00:00.000Z",
};

describe("SPA intentHash strict verification", () => {
  it("fails when SPA has intentHash but options.settlementIntent is missing", () => {
    setupKeys();
    const intent = { rail: "xrpl", destination: "rDest", amount: "1000", currency: "RLUSD", issuer: "rIss" };
    const envelope = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision, {
      settlementIntent: intent,
    });
    expect(envelope).not.toBeNull();
    expect(envelope!.authorization.intentHash).toBeDefined();

    const verification = verifySignedPaymentAuthorizationForSettlement(envelope!, "dec-1", baseSettlement);
    expect(verification).toEqual({ ok: false, reason: "mismatch" });
  });

  it("fails when SPA has intentHash but settlementIntent hash does not match", () => {
    setupKeys();
    const intent = { rail: "xrpl", destination: "rDest", amount: "1000", currency: "RLUSD", issuer: "rIss" };
    const envelope = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision, {
      settlementIntent: intent,
    });
    expect(envelope).not.toBeNull();

    const differentIntent = { rail: "xrpl", destination: "rDest", amount: "2000", currency: "RLUSD", issuer: "rIss" };
    const verification = verifySignedPaymentAuthorizationForSettlement(envelope!, "dec-1", baseSettlement, {
      settlementIntent: differentIntent,
    });
    expect(verification).toEqual({ ok: false, reason: "mismatch" });
  });

  it("passes when SPA has intentHash and settlementIntent matches", () => {
    setupKeys();
    const intent = { rail: "xrpl", destination: "rDest", amount: "1000", currency: "RLUSD", issuer: "rIss" };
    const envelope = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision, {
      settlementIntent: intent,
    });
    expect(envelope).not.toBeNull();

    const verification = verifySignedPaymentAuthorizationForSettlement(envelope!, "dec-1", baseSettlement, {
      settlementIntent: intent,
    });
    expect(verification).toEqual({ ok: true });
  });
});
