import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/hash/canonicalJson.js";

describe("canonicalJson", () => {
  it("uses deterministic key ordering (sorted lexicographically)", () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { m: 3, z: 1, a: 2 };
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    expect(canonicalJson(obj1)).toBe('{"a":2,"m":3,"z":1}');
  });

  it("omits undefined and null object fields per protocol spec", () => {
    const obj = {
      a: "keep",
      b: undefined,
      c: null,
      d: 0,
    } as Record<string, unknown>;
    expect(canonicalJson(obj)).toBe('{"a":"keep","d":0}');
  });

  it("throws on top-level undefined", () => {
    expect(() => canonicalJson(undefined)).toThrow("Cannot canonicalize undefined");
  });

  it("serializes arrays deterministically with undefined as null", () => {
    const arr = [1, undefined, 3] as unknown[];
    expect(canonicalJson(arr)).toBe("[1,null,3]");
  });

  it("canonical serialization snapshot — settlement intent", () => {
    const intent = {
      rail: "xrpl",
      destination: "rDest...",
      amount: "19440000",
      asset: { kind: "IOU", currency: "USDC", issuer: "rIssuer..." },
    };
    expect(canonicalJson(intent)).toMatchSnapshot();
  });

  it("canonical serialization snapshot — nested structures", () => {
    const obj = {
      z: 1,
      a: { y: 2, b: { x: 3 } },
      m: [4, { p: 5, q: null }],
    } as Record<string, unknown>;
    expect(canonicalJson(obj)).toMatchSnapshot();
  });
});
