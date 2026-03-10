/**
 * Canonical JSON serialization for deterministic hashing.
 * Per protocol spec: object fields with null or undefined values MUST be omitted.
 * Never emits undefined (JSON.stringify(undefined) is invalid).
 *
 * Rules:
 * - Sorts object keys lexicographically
 * - Omits fields with null or undefined values
 * - Recursively canonicalizes nested objects and arrays
 */
export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("Cannot canonicalize undefined");
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys
    .filter((k) => obj[k] !== undefined && obj[k] !== null)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k]!)}`);
  return `{${parts.join(",")}}`;
}
