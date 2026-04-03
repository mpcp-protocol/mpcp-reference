/**
 * Domain-separated policy document hashing (SECOP 10a / spec alignment).
 *
 * Per PolicyGrant.md § Policy Hashing:
 *   policyHash = SHA256("MPCP:Policy:<version>:" || canonicalJson(policyDocument))
 */

import { createHash } from "node:crypto";
import { canonicalJson } from "./canonicalJson.js";

/**
 * Compute the spec-compliant policy hash for a policy document.
 *
 * @param policyDocument - The structured policy document object
 * @param version - Protocol version (default "1.0")
 * @returns Lowercase hex SHA-256 digest
 */
export function hashPolicyDocument(policyDocument: unknown, version = "1.0"): string {
  const prefix = `MPCP:Policy:${version}:`;
  return createHash("sha256")
    .update(prefix + canonicalJson(policyDocument))
    .digest("hex");
}
