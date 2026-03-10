import { describe, it, expect } from "vitest";
import { mockAnchorIntentHash } from "../../src/anchor/mockAnchor.js";
import { computeSettlementIntentHash } from "../../src/hash/index.js";

describe("mockAnchorIntentHash", () => {
  it("returns stub anchor result", async () => {
    const intentHash = "a".repeat(64);
    const result = await mockAnchorIntentHash(intentHash);
    expect(result.rail).toBe("mock");
    expect(result.txHash).toMatch(/^mock-[a-f0-9]+$/);
    expect(result.anchoredAt).toBeDefined();
  });

  it("includes first 16 chars of intentHash in txHash", async () => {
    const intentHash = "abcd1234" + "0".repeat(56);
    const result = await mockAnchorIntentHash(intentHash);
    expect(result.txHash).toBe("mock-abcd123400000000");
  });

  it("works with computeSettlementIntentHash", async () => {
    const intent = {
      version: "1.0",
      rail: "xrpl",
      amount: "1000",
      destination: "rDest",
    };
    const intentHash = computeSettlementIntentHash(intent);
    const result = await mockAnchorIntentHash(intentHash);
    expect(result.rail).toBe("mock");
    expect(result.txHash).toMatch(/^mock-/);
  });
});
