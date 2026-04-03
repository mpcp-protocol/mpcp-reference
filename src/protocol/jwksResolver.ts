/**
 * HTTPS JWKS key resolution (SECOP 2a / 8a).
 *
 * Step 3 of the MPCP 3-step key resolution algorithm:
 *   1. Trust Bundle (offline)
 *   2. Pre-configured key (env var)
 *   3. HTTPS well-known endpoint  ← this module
 *
 * Fetches /.well-known/mpcp-keys.json from the issuer's domain, filters by
 * `active` field (SECOP 2a), and optionally validates the `alg` field (SECOP 8a).
 */

import type { KeyWithKid } from "./trustBundle.js";

export interface JwksResolverOptions {
  /** Timeout in ms for the HTTPS fetch. Default 5000. */
  timeoutMs?: number;
  /** Required algorithm — reject keys whose `alg` does not match. */
  requiredAlg?: string;
}

export interface JwksDocument {
  keys: (KeyWithKid & { active?: boolean; alg?: string })[];
}

/**
 * Fetch the JWKS document from an issuer's well-known endpoint.
 *
 * @param issuer - Domain or did:web (only the domain part is used)
 * @returns Parsed JWKS document, or null on failure
 */
export async function fetchJwks(
  issuer: string,
  options?: JwksResolverOptions,
): Promise<JwksDocument | null> {
  const domain = issuerToDomain(issuer);
  if (!domain) return null;

  const url = `https://${domain}/.well-known/mpcp-keys.json`;
  const timeoutMs = options?.timeoutMs ?? 5000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as JwksDocument;
  } catch {
    return null;
  }
}

/**
 * Resolve a specific key from a remote JWKS endpoint.
 *
 * Filters by:
 *   - `kid` match
 *   - `active !== false` (SECOP 2a: inactive keys are excluded)
 *   - `alg` match when `options.requiredAlg` is set (SECOP 8a)
 */
export async function resolveFromJwks(
  issuer: string,
  issuerKeyId: string,
  options?: JwksResolverOptions,
): Promise<KeyWithKid | null> {
  const doc = await fetchJwks(issuer, options);
  if (!doc?.keys) return null;

  for (const key of doc.keys) {
    if (key.kid !== issuerKeyId) continue;
    if (key.active === false) continue;
    if (options?.requiredAlg && key.alg && key.alg !== options.requiredAlg) continue;
    return key;
  }
  return null;
}

function issuerToDomain(issuer: string): string | null {
  if (issuer.startsWith("did:web:")) {
    return issuer.slice("did:web:".length).replace(/%3A/gi, ":");
  }
  if (issuer.startsWith("https://")) {
    try {
      return new URL(issuer).hostname;
    } catch {
      return null;
    }
  }
  if (issuer.includes(".") && !issuer.includes(" ")) {
    return issuer;
  }
  return null;
}
