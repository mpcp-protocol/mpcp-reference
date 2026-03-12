import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  issueBudget,
  verifySettlementService,
  verifyDispute,
  anchorIntent,
} from "../../src/service/index.js";
import { createPolicyGrant } from "../../src/sdk/createPolicyGrant.js";
import type { SettlementVerificationContext } from "../../src/verifier/types.js";

describe("service API", () => {
  describe("issueBudget", () => {
    it("returns null when signing key not configured", () => {
      const policyGrant = createPolicyGrant({
        policyHash: "abc",
        allowedRails: ["xrpl"],
        expiresAt: "2030-12-31T23:59:59Z",
      });
      const sba = issueBudget({
        policyGrant,
        sessionId: "s1",
        vehicleId: "v1",
        maxAmountMinor: "3000",
        destinationAllowlist: ["rDest"],
      });
      expect(sba).toBeNull();
    });

    it("returns SBA when signing key is configured", () => {
      const keys = crypto.generateKeyPairSync("ed25519");
      const orig = process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
      const origPub = process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
      const origKeyId = process.env.MPCP_SBA_SIGNING_KEY_ID;
      process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = keys.privateKey.export({
        type: "pkcs8",
        format: "pem",
      }) as string;
      process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = keys.publicKey.export({
        type: "spki",
        format: "pem",
      }) as string;
      process.env.MPCP_SBA_SIGNING_KEY_ID = "test-key";

      try {
        const policyGrant = createPolicyGrant({
          policyHash: "abc",
          allowedRails: ["xrpl"],
          expiresAt: "2030-12-31T23:59:59Z",
        });
        const sba = issueBudget({
          policyGrant,
          sessionId: "s1",
          vehicleId: "v1",
          maxAmountMinor: "3000",
          destinationAllowlist: ["rDest"],
        });
        expect(sba).not.toBeNull();
        expect(sba!.authorization.sessionId).toBe("s1");
        expect(sba!.authorization.vehicleId).toBe("v1");
        expect(sba!.signature).toBeDefined();
      } finally {
        if (orig !== undefined) process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = orig;
        else delete process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
        if (origPub !== undefined) process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = origPub;
        else delete process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
        if (origKeyId !== undefined) process.env.MPCP_SBA_SIGNING_KEY_ID = origKeyId;
        else delete process.env.MPCP_SBA_SIGNING_KEY_ID;
      }
    });
  });

  describe("verifySettlementService", () => {
    it("delegates to verifySettlement", () => {
      const ctx = {
        policyGrant: { policyHash: "x", allowedRails: ["xrpl"], expiresAt: "2030-12-31T23:59:59Z" },
        signedBudgetAuthorization: {} as never,
        signedPaymentAuthorization: {} as never,
        settlement: {} as never,
        paymentPolicyDecision: {} as never,
        decisionId: "d1",
      } as unknown as SettlementVerificationContext;
      const result = verifySettlementService(ctx);
      expect(result.valid).toBe(false);
      expect("reason" in result).toBe(true);
    });
  });

  describe("verifyDispute", () => {
    it("returns verified when no anchor", () => {
      const result = verifyDispute({
        context: {} as never,
      });
      expect(result.verified).toBe(false);
    });
  });

  describe("anchorIntent", () => {
    it("anchors to mock rail by default", async () => {
      const intentHash = "a".repeat(64);
      const result = await anchorIntent(intentHash);
      expect(result.rail).toBe("mock");
      expect(result.txHash).toMatch(/^mock-[a-f0-9]{16}$/);
    });

    it("anchors to mock when rail specified", async () => {
      const intentHash = "b".repeat(64);
      const result = await anchorIntent(intentHash, { rail: "mock" });
      expect(result.rail).toBe("mock");
    });

    it("throws for unsupported rail", async () => {
      const intentHash = "c".repeat(64);
      await expect(anchorIntent(intentHash, { rail: "xrpl" })).rejects.toThrow(/Unsupported anchor rail/);
    });
  });
});
