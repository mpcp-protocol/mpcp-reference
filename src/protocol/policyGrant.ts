import crypto, { createHash } from "node:crypto";
import { canonicalJson } from "../hash/canonicalJson.js";
import type { PolicyGrantLike } from "../verifier/types.js";
import { resolveFromTrustBundle, type TrustBundle } from "./trustBundle.js";

export interface SignedPolicyGrant {
  grant: PolicyGrantLike;
  issuer?: string;
  issuerKeyId: string;
  signature: string;
}

function getExpectedKeyId(): string {
  return process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID || "mpcp-policy-grant-signing-key-1";
}

function hashGrant(grant: PolicyGrantLike): Buffer {
  return createHash("sha256").update("MPCP:PolicyGrant:1.0:" + canonicalJson(grant)).digest();
}

function parseSigningPrivateKey(): crypto.KeyObject | null {
  const pem = process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM;
  if (!pem) return null;
  try {
    return crypto.createPrivateKey(pem);
  } catch {
    return null;
  }
}

function parseVerificationPublicKey(): crypto.KeyObject | null {
  const pem = process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM;
  if (!pem) return null;
  try {
    return crypto.createPublicKey(pem);
  } catch {
    return null;
  }
}

export function createSignedPolicyGrant(
  grant: PolicyGrantLike,
  options?: { issuer?: string; keyId?: string },
): SignedPolicyGrant | null {
  const privateKey = parseSigningPrivateKey();
  if (!privateKey) return null;

  const issuerKeyId = options?.keyId ?? getExpectedKeyId();
  const signature = crypto.sign(null, hashGrant(grant), privateKey).toString("base64");
  const result: SignedPolicyGrant = { grant, issuerKeyId, signature };
  if (options?.issuer) result.issuer = options.issuer;
  return result;
}

export function verifyPolicyGrantSignature(
  envelope: SignedPolicyGrant,
  options?: { trustBundles?: TrustBundle[] },
): { ok: true } | { ok: false; reason: "invalid_signature" } {
  // Key resolution per spec (3-step algorithm):
  //   1. Trust Bundle — offline JWK lookup by issuer + issuerKeyId
  //   2. Pre-configured key — MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM env var
  //   3. HTTPS well-known — not yet implemented
  let publicKey: crypto.KeyObject | null = null;
  if (options?.trustBundles?.length && envelope.issuer) {
    const jwk = resolveFromTrustBundle(envelope.issuer, envelope.issuerKeyId, options.trustBundles);
    if (jwk) {
      try {
        publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
      } catch {
        // fall through to pre-configured key
      }
    }
  }
  // Step 2: Pre-configured key (env var fallback, with key ID check)
  if (!publicKey) {
    if (envelope.issuerKeyId !== getExpectedKeyId()) return { ok: false, reason: "invalid_signature" };
    publicKey = parseVerificationPublicKey();
  }
  if (!publicKey) return { ok: false, reason: "invalid_signature" };

  const isValid = crypto.verify(
    null,
    hashGrant(envelope.grant),
    publicKey,
    Buffer.from(envelope.signature, "base64"),
  );
  if (!isValid) return { ok: false, reason: "invalid_signature" };
  return { ok: true };
}
