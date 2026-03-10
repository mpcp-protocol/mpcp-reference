import { describe, expect, it } from "vitest";
import {
  computeSettlementIntentHash,
  computeIntentHash,
} from "../../src/hash/index.js";

describe("computeSettlementIntentHash", () => {
  it("produces identical hash across identical intents", () => {
    const intent = {
      rail: "xrpl",
      destination: "rDest...",
      amount: "19440000",
      asset: { kind: "IOU" as const, currency: "USDC", issuer: "rIssuer" },
    };
    const h1 = computeSettlementIntentHash(intent);
    const h2 = computeSettlementIntentHash(intent);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes when any field changes", () => {
    const base = { rail: "xrpl" as const, amount: "1000" };
    expect(computeSettlementIntentHash(base)).toBe(
      computeSettlementIntentHash({ ...base }),
    );
    expect(computeSettlementIntentHash({ ...base, amount: "1000" })).not.toBe(
      computeSettlementIntentHash({ ...base, amount: "2000" }),
    );
    expect(computeSettlementIntentHash({ ...base, rail: "xrpl" })).not.toBe(
      computeSettlementIntentHash({ ...base, rail: "evm" }),
    );
    expect(
      computeSettlementIntentHash({
        ...base,
        asset: { kind: "IOU" as const, currency: "USDC", issuer: "A" },
      }),
    ).not.toBe(
      computeSettlementIntentHash({
        ...base,
        asset: { kind: "IOU" as const, currency: "USDC", issuer: "B" },
      }),
    );
  });

  it("is insensitive to key order (canonical)", () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { m: 3, a: 2, z: 1 };
    expect(computeSettlementIntentHash(a)).toBe(computeSettlementIntentHash(b));
  });

  it("computeIntentHash is an alias producing same result", () => {
    const intent = { rail: "xrpl", amount: "1000" };
    expect(computeIntentHash(intent)).toBe(computeSettlementIntentHash(intent));
  });
});
