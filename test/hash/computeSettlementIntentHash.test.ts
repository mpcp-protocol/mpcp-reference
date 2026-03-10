import { describe, expect, it } from "vitest";
import {
  computeSettlementIntentHash,
  computeIntentHash,
} from "../../src/hash/index.js";
import { canonicalJson } from "../../src/canonical/canonicalJson.js";
import { sha256Hex } from "../../src/canonical/hash.js";

describe("computeSettlementIntentHash", () => {
  it("uses domain-separated hashing (MPCP:SettlementIntent:1.0: prefix)", () => {
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      asset: { kind: "IOU" as const, currency: "USDC", issuer: "rIssuer" },
    };
    const canonical = canonicalJson(intent);
    const expected = sha256Hex(`MPCP:SettlementIntent:1.0:${canonical}`);
    expect(computeSettlementIntentHash(intent)).toBe(expected);
  });
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

  it("strips intentHash from intent before hashing (never trust intent.intentHash)", () => {
    const intent = { rail: "xrpl", amount: "1000", destination: "rDest" };
    const hashWithout = computeSettlementIntentHash(intent);
    const intentWithFakeHash = { ...intent, intentHash: "a".repeat(64) };
    expect(computeSettlementIntentHash(intentWithFakeHash)).toBe(hashWithout);
  });
});
