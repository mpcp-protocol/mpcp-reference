import { describe, it, expect } from "vitest";
import { mockAnchorIntentHash } from "../../src/anchor/mockAnchor.js";

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

  it("accepts options.rail 'mock'", async () => {
    const result = await mockAnchorIntentHash("a".repeat(64), { rail: "mock" });
    expect(result.rail).toBe("mock");
  });

  it("rejects non-mock rails", async () => {
    await expect(mockAnchorIntentHash("a".repeat(64), { rail: "hedera-hcs" })).rejects.toThrow(
      "mockAnchorIntentHash only supports rail 'mock'",
    );
    await expect(mockAnchorIntentHash("a".repeat(64), { rail: "xrpl" })).rejects.toThrow(
      "mockAnchorIntentHash only supports rail 'mock'",
    );
  });

  it("rejects invalid intentHash length", async () => {
    await expect(mockAnchorIntentHash("abc")).rejects.toThrow("64 hex chars");
    await expect(mockAnchorIntentHash("a".repeat(63))).rejects.toThrow("64 hex chars");
    await expect(mockAnchorIntentHash("a".repeat(65))).rejects.toThrow("64 hex chars");
  });

  it("rejects non-hex intentHash", async () => {
    await expect(mockAnchorIntentHash("g".repeat(64))).rejects.toThrow("hex");
    await expect(mockAnchorIntentHash("hello".padEnd(64, "0"))).rejects.toThrow("hex");
  });
});
