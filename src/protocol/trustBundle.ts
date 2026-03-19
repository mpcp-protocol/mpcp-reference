import crypto, { createHash } from "node:crypto";
import { canonicalJson } from "../hash/canonicalJson.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A JWK augmented with the standard `kid` identifier (RFC 7517). */
export type KeyWithKid = JsonWebKey & { kid?: string };

export interface TrustBundleIssuerEntry {
  issuer: string;
  keys: KeyWithKid[];
}

export interface TrustBundle {
  version: "1.0";
  bundleId: string;
  bundleIssuer: string;
  bundleKeyId: string;
  category: string;
  /** Identity (DID or domain) of the payment-accepting merchant this bundle is scoped to.
   *  Used by embedded devices (e.g. EV charging stations) to filter bundles by the
   *  merchant network they belong to. Omit for unscoped (multi-merchant) bundles. */
  merchant?: string;
  geography?: { region?: string; countryCodes?: string[] };
  approvedIssuers: string[];
  issuers: TrustBundleIssuerEntry[];
  expiresAt: string;
  signature: string;
}

/** Bundle document before signing — all fields except `signature`. */
export type UnsignedTrustBundle = Omit<TrustBundle, "signature">;

// ---------------------------------------------------------------------------
// Canonical hash
// ---------------------------------------------------------------------------

function hashBundle(bundle: UnsignedTrustBundle): Buffer {
  return createHash("sha256")
    .update("MPCP:TrustBundle:1.0:" + canonicalJson(bundle))
    .digest();
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Sign a Trust Bundle document.
 *
 * Constructs the canonical payload (`"MPCP:TrustBundle:1.0:" + canonicalJson(bundle)`),
 * signs it with the provided private key PEM (Ed25519 or ECDSA P-256), and returns the
 * completed bundle with the `signature` field set.
 *
 * @throws if the private key PEM is invalid
 */
export function signTrustBundle(bundle: UnsignedTrustBundle, privateKeyPem: string): TrustBundle {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, hashBundle(bundle), privateKey).toString("base64");
  return { ...bundle, signature };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify a Trust Bundle's own signature and expiry.
 *
 * The caller is responsible for resolving the bundle signer's public key from their
 * pre-configured root key set (identified by `bundle.bundleIssuer` + `bundle.bundleKeyId`).
 * This function takes the already-resolved `rootPublicKeyPem` and checks:
 *   1. Optional key ID match (`options.expectedKeyId` vs `bundle.bundleKeyId`)
 *   2. Signature validity over the canonical payload
 *   3. Bundle has not expired
 */
export function verifyTrustBundle(
  bundle: TrustBundle,
  rootPublicKeyPem: string,
  options?: { nowMs?: number; expectedKeyId?: string },
): { valid: true } | { valid: false; reason: string } {
  // Optional key ID check
  if (options?.expectedKeyId && bundle.bundleKeyId !== options.expectedKeyId) {
    return { valid: false, reason: "bundle_key_id_mismatch" };
  }

  // Parse root public key
  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey(rootPublicKeyPem);
  } catch {
    return { valid: false, reason: "invalid_root_public_key" };
  }

  // Verify signature over bundle-without-signature
  const { signature, ...bundleWithoutSig } = bundle;
  let isValid: boolean;
  try {
    isValid = crypto.verify(
      null,
      hashBundle(bundleWithoutSig),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return { valid: false, reason: "signature_verification_failed" };
  }

  if (!isValid) return { valid: false, reason: "invalid_bundle_signature" };

  // Check expiry
  const nowMs = options?.nowMs ?? Date.now();
  const expiryMs = Date.parse(bundle.expiresAt);
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    return { valid: false, reason: "bundle_expired" };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Key resolution (step 1 of the 3-step algorithm)
// ---------------------------------------------------------------------------

/**
 * Resolve an issuer's public key from a set of pre-loaded Trust Bundles.
 *
 * Implements step 1 of the MPCP key resolution algorithm:
 * https://mpcp-protocol.github.io/spec/protocol/key-resolution/
 *
 * Bundles are searched in descending `expiresAt` order so the most recently
 * issued bundle is preferred when multiple bundles cover the same issuer.
 *
 * **Security**: callers MUST pre-filter `bundles` with `verifyTrustBundle` before
 * passing them here. Unverified bundles allow an attacker to substitute arbitrary
 * keys and forge SBAs. Example:
 * ```typescript
 * const valid = bundles.filter((b) => verifyTrustBundle(b, rootPublicKeyPem).valid);
 * resolveFromTrustBundle(issuer, keyId, valid);
 * ```
 *
 * @returns The matching JWK, or `null` if no non-expired bundle contains the key.
 */
export function resolveFromTrustBundle(
  issuer: string,
  issuerKeyId: string,
  bundles: TrustBundle[],
): KeyWithKid | null {
  const nowMs = Date.now();

  // Sort by expiresAt descending — latest-expiring bundle checked first
  const sorted = [...bundles].sort(
    (a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt),
  );

  for (const bundle of sorted) {
    // Skip expired bundles
    if (Date.parse(bundle.expiresAt) <= nowMs) continue;

    // issuer must be in the approved set
    if (!bundle.approvedIssuers.includes(issuer)) continue;

    // find the entry with embedded keys for this issuer
    const entry = bundle.issuers.find((e) => e.issuer === issuer);
    if (!entry) continue; // approved but no embedded keys — fall through to next bundle

    // find the specific key by kid
    const jwk = entry.keys.find((k) => k.kid === issuerKeyId);
    if (jwk) return jwk;
  }

  return null;
}
