import { describe, expect, it } from "vitest";
import { InMemoryBudgetIdStore } from "../../src/verifier/budgetIdStore.js";

describe("InMemoryBudgetIdStore", () => {
  it("returns true for new budgetId", () => {
    const store = new InMemoryBudgetIdStore();
    expect(store.markSeen("budget-1")).toBe(true);
  });

  it("returns false for duplicate budgetId", () => {
    const store = new InMemoryBudgetIdStore();
    store.markSeen("budget-1");
    expect(store.markSeen("budget-1")).toBe(false);
  });

  it("tracks different budgetIds independently", () => {
    const store = new InMemoryBudgetIdStore();
    expect(store.markSeen("a")).toBe(true);
    expect(store.markSeen("b")).toBe(true);
    expect(store.markSeen("a")).toBe(false);
    expect(store.markSeen("b")).toBe(false);
    expect(store.markSeen("c")).toBe(true);
  });

  it("reports correct size", () => {
    const store = new InMemoryBudgetIdStore();
    expect(store.size).toBe(0);
    store.markSeen("a");
    expect(store.size).toBe(1);
    store.markSeen("b");
    expect(store.size).toBe(2);
    store.markSeen("a");
    expect(store.size).toBe(2);
  });

  it("clears all entries", () => {
    const store = new InMemoryBudgetIdStore();
    store.markSeen("a");
    store.markSeen("b");
    store.clear();
    expect(store.size).toBe(0);
    expect(store.markSeen("a")).toBe(true);
  });

  it("markSeen returns a boolean, not a Promise", () => {
    const store = new InMemoryBudgetIdStore();
    const result = store.markSeen("test");
    expect(typeof result).toBe("boolean");
    expect(result).not.toBeInstanceOf(Promise);
  });
});
