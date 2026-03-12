import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/hash/canonicalJson.js";
import { sha256Hex } from "../../src/hash/sha256.js";

describe("sha256Hex", () => {
  it("produces identical hash across multiple runs", () => {
    const input = '{"a":1,"b":2}';
    const h1 = sha256Hex(input);
    const h2 = sha256Hex(input);
    expect(h1).toBe(h2);
  });

  it("produces 64-char hex string", () => {
    const hash = sha256Hex("hello");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash stability — empty string", () => {
    const hash = sha256Hex("");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("hash stability — settlement intent canonical form", () => {
    const canonical = canonicalJson({
      rail: "xrpl",
      destination: "rDest...",
      amount: "19440000",
      asset: { kind: "IOU", currency: "USDC", issuer: "rIssuer..." },
    });
    const hash = sha256Hex(canonical);
    expect(hash).toMatchSnapshot();
  });
});
