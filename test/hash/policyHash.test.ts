import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPolicyDocument } from "../../src/hash/policyHash.js";
import { canonicalJson } from "../../src/hash/canonicalJson.js";

describe("hashPolicyDocument", () => {
  it("produces SHA-256 hex with MPCP:Policy:1.0: prefix", () => {
    const doc = { vendorAllowlist: ["v1"], railAllowlist: ["xrpl"] };
    const expected = createHash("sha256")
      .update("MPCP:Policy:1.0:" + canonicalJson(doc))
      .digest("hex");
    expect(hashPolicyDocument(doc)).toBe(expected);
  });

  it("uses custom version when provided", () => {
    const doc = { a: 1 };
    const expected = createHash("sha256")
      .update("MPCP:Policy:2.0:" + canonicalJson(doc))
      .digest("hex");
    expect(hashPolicyDocument(doc, "2.0")).toBe(expected);
  });

  it("produces deterministic output for same input", () => {
    const doc = { z: 2, a: 1 };
    expect(hashPolicyDocument(doc)).toBe(hashPolicyDocument(doc));
  });

  it("produces different hashes for different documents", () => {
    const h1 = hashPolicyDocument({ x: 1 });
    const h2 = hashPolicyDocument({ x: 2 });
    expect(h1).not.toBe(h2);
  });

  it("returns lowercase hex string of 64 chars", () => {
    const hash = hashPolicyDocument({ test: true });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
