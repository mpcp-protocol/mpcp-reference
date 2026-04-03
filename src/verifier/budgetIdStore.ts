/**
 * Interface + in-memory default for budgetId replay prevention (SECOP 4a / 3b).
 *
 * The Trust Gateway MUST reject SBAs whose budgetId has already been accepted.
 * Deployments SHOULD use a durable store (database, etc.); the in-memory default
 * is suitable for tests and single-process gateways that accept restart risk.
 */

export interface BudgetIdStore {
  /**
   * Attempt to record a budgetId. Returns `true` if the id was new and recorded;
   * `false` if it was already seen (replay).
   */
  markSeen(budgetId: string): boolean | Promise<boolean>;
}

export class InMemoryBudgetIdStore implements BudgetIdStore {
  private readonly seen = new Set<string>();

  markSeen(budgetId: string): boolean {
    if (this.seen.has(budgetId)) return false;
    this.seen.add(budgetId);
    return true;
  }

  get size(): number {
    return this.seen.size;
  }

  clear(): void {
    this.seen.clear();
  }
}
