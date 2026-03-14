import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPolicyCustody } from "../../src/anchor/custody.js";

const POLICY_HASH = "a".repeat(64);
const POLICY_DOC = { allowedRails: ["xrpl"], maxAmountMinor: "10000" };

describe("InMemoryPolicyCustody", () => {
  let custody: InMemoryPolicyCustody;

  beforeEach(() => {
    custody = new InMemoryPolicyCustody();
  });

  it("stores and retrieves a document by policyHash", async () => {
    await custody.store(POLICY_HASH, POLICY_DOC);
    const result = await custody.retrieve(POLICY_HASH);
    expect(result).toEqual(POLICY_DOC);
  });

  it("returns null for unknown policyHash", async () => {
    const result = await custody.retrieve("b".repeat(64));
    expect(result).toBeNull();
  });

  it("overwrites document on duplicate store", async () => {
    const v1 = { allowedRails: ["xrpl"] };
    const v2 = { allowedRails: ["xrpl", "stripe"] };
    await custody.store(POLICY_HASH, v1);
    await custody.store(POLICY_HASH, v2);
    expect(await custody.retrieve(POLICY_HASH)).toEqual(v2);
  });

  it("tracks size correctly", async () => {
    expect(custody.size).toBe(0);
    await custody.store(POLICY_HASH, POLICY_DOC);
    expect(custody.size).toBe(1);
    await custody.store("b".repeat(64), POLICY_DOC);
    expect(custody.size).toBe(2);
  });

  it("clear removes all documents", async () => {
    await custody.store(POLICY_HASH, POLICY_DOC);
    await custody.store("b".repeat(64), POLICY_DOC);
    custody.clear();
    expect(custody.size).toBe(0);
    expect(await custody.retrieve(POLICY_HASH)).toBeNull();
  });

  it("independent instances do not share state", async () => {
    const other = new InMemoryPolicyCustody();
    await custody.store(POLICY_HASH, POLICY_DOC);
    expect(await other.retrieve(POLICY_HASH)).toBeNull();
  });
});
