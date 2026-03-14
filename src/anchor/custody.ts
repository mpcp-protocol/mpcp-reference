/**
 * Policy document custody — in-memory implementation.
 *
 * The Service layer (mpcp-policy-authority) is the custodian of full policy documents
 * when submitMode="hash-only". Auditors retrieve the document from the Service and
 * verify it against the on-chain policyHash.
 *
 * InMemoryPolicyCustody is for development and testing. Production deployments
 * (mpcp-policy-authority) back this interface with a real database.
 */

import type { PolicyDocumentCustody } from "./types.js";

/**
 * In-memory policy document custody store.
 * Documents are lost when the process exits. Use only for development and testing.
 */
export class InMemoryPolicyCustody implements PolicyDocumentCustody {
  private readonly _docs = new Map<string, object>();

  async store(policyHash: string, document: object): Promise<void> {
    this._docs.set(policyHash, document);
  }

  async retrieve(policyHash: string): Promise<object | null> {
    return this._docs.get(policyHash) ?? null;
  }

  /** Number of documents currently held. Useful for testing. */
  get size(): number {
    return this._docs.size;
  }

  /** Remove all documents. Useful for test teardown. */
  clear(): void {
    this._docs.clear();
  }
}
