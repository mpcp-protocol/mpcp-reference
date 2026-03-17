import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  signTrustBundle,
  verifyTrustBundle,
  resolveFromTrustBundle,
  type TrustBundle,
  type UnsignedTrustBundle,
  type KeyWithKid,
} from "../../src/protocol/trustBundle.js";
import {
  createSignedSessionBudgetAuthorization,
  verifySignedSessionBudgetAuthorizationForDecision,
} from "../../src/protocol/sba.js";
import type { PaymentPolicyDecision } from "../../src/policy-core/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateEd25519(kid: string) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const jwk = { ...publicKey.export({ format: "jwk" }), kid } as KeyWithKid;
  return { privateKeyPem, publicKeyPem, jwk };
}

function makeUnsignedBundle(opts: {
  issuer: string;
  issuerJwk: KeyWithKid;
  bundleKeyId?: string;
  expiresAt?: string;
  bundleId?: string;
}): UnsignedTrustBundle {
  return {
    version: "1.0",
    bundleId: opts.bundleId ?? "bundle-1",
    bundleIssuer: "bundle-authority.example.com",
    bundleKeyId: opts.bundleKeyId ?? "bundle-key-1",
    category: "payment-policy",
    approvedIssuers: [opts.issuer],
    issuers: [{ issuer: opts.issuer, keys: [opts.issuerJwk] }],
    expiresAt: opts.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// SBA env var cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  delete process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_KEY_ID;
});

// ---------------------------------------------------------------------------
// signTrustBundle + verifyTrustBundle
// ---------------------------------------------------------------------------

describe("signTrustBundle + verifyTrustBundle", () => {
  it("roundtrip: sign and verify a trust bundle", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    const signed = signTrustBundle(
      makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: sbaKeys.jwk }),
      bundleKeys.privateKeyPem,
    );

    const result = verifyTrustBundle(signed, bundleKeys.publicKeyPem);
    expect(result).toEqual({ valid: true });
  });

  it("rejects expired bundle", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    const signed = signTrustBundle(
      makeUnsignedBundle({
        issuer: "pa.example.com",
        issuerJwk: sbaKeys.jwk,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
      bundleKeys.privateKeyPem,
    );

    const result = verifyTrustBundle(signed, bundleKeys.publicKeyPem);
    expect(result).toEqual({ valid: false, reason: "bundle_expired" });
  });

  it("rejects tampered bundle signature", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    const signed = signTrustBundle(
      makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: sbaKeys.jwk }),
      bundleKeys.privateKeyPem,
    );
    const tampered: TrustBundle = { ...signed, signature: "aW52YWxpZHNpZ25hdHVyZQ==" };

    const result = verifyTrustBundle(tampered, bundleKeys.publicKeyPem);
    expect(result).toEqual({ valid: false, reason: "invalid_bundle_signature" });
  });
});

// ---------------------------------------------------------------------------
// resolveFromTrustBundle
// ---------------------------------------------------------------------------

describe("resolveFromTrustBundle", () => {
  it("returns the matching JWK from a valid bundle", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    const bundle = signTrustBundle(
      makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: sbaKeys.jwk }),
      bundleKeys.privateKeyPem,
    );

    const jwk = resolveFromTrustBundle("pa.example.com", "sba-key-1", [bundle]);
    expect(jwk).not.toBeNull();
    expect(jwk?.kid).toBe("sba-key-1");
  });

  it("returns null for expired bundle", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    const expired = signTrustBundle(
      makeUnsignedBundle({
        issuer: "pa.example.com",
        issuerJwk: sbaKeys.jwk,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
      bundleKeys.privateKeyPem,
    );

    const jwk = resolveFromTrustBundle("pa.example.com", "sba-key-1", [expired]);
    expect(jwk).toBeNull();
  });

  it("prefers bundle with latest expiresAt when multiple bundles match", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const earlyKeys = generateEd25519("sba-key-early");
    const laterKeys = generateEd25519("sba-key-later");
    const kid = "sba-key-1";

    // Both bundles contain the same kid but different key material
    const earlyBundle = signTrustBundle(
      {
        ...makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: { ...earlyKeys.jwk, kid }, bundleId: "early" }),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(), // +1 h
      },
      bundleKeys.privateKeyPem,
    );
    const laterBundle = signTrustBundle(
      {
        ...makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: { ...laterKeys.jwk, kid }, bundleId: "later" }),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(), // +24 h (later)
      },
      bundleKeys.privateKeyPem,
    );

    // Pass early first — resolver must return the later key (highest expiresAt)
    const jwk = resolveFromTrustBundle("pa.example.com", kid, [earlyBundle, laterBundle]);
    expect(jwk).not.toBeNull();
    expect(jwk?.x).toBe(laterKeys.jwk.x); // x matches the key from the later bundle
  });

  it("returns null when issuer not in any bundle", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    const bundle = signTrustBundle(
      makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: sbaKeys.jwk }),
      bundleKeys.privateKeyPem,
    );

    const jwk = resolveFromTrustBundle("other.example.com", "sba-key-1", [bundle]);
    expect(jwk).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// verifySignedBudgetAuthorization with trustBundles (integration)
// ---------------------------------------------------------------------------

describe("verifySignedSessionBudgetAuthorizationForDecision with trustBundles", () => {
  it("verifies SBA using trust bundle key — no env var needed", () => {
    const bundleKeys = generateEd25519("bundle-key-1");
    const sbaKeys = generateEd25519("sba-key-1");

    // Sign SBA via env var
    process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKeyPem;
    process.env.MPCP_SBA_SIGNING_KEY_ID = "sba-key-1";

    const envelope = createSignedSessionBudgetAuthorization({
      sessionId: "sess-tb-1",
      actorId: "agent-1",
      grantId: "grant-tb-1",
      policyHash: "ph-tb-1",
      currency: "USD",
      maxAmountMinor: "5000",
      allowedRails: ["stripe"],
      allowedAssets: [],
      destinationAllowlist: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      issuer: "pa.example.com",
    });
    expect(envelope).not.toBeNull();

    // Remove env vars — verification must rely exclusively on the trust bundle
    delete process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
    delete process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
    delete process.env.MPCP_SBA_SIGNING_KEY_ID;

    const trustBundle = signTrustBundle(
      makeUnsignedBundle({ issuer: "pa.example.com", issuerJwk: sbaKeys.jwk }),
      bundleKeys.privateKeyPem,
    );

    const decision: PaymentPolicyDecision = {
      decisionId: "dec-tb-1",
      policyHash: "ph-tb-1",
      action: "ALLOW",
      reasons: ["OK"],
      expiresAtISO: new Date(Date.now() + 60_000).toISOString(),
      rail: "stripe",
      priceFiat: { amountMinor: "1000", currency: "USD" },
    };

    const result = verifySignedSessionBudgetAuthorizationForDecision(envelope!, {
      sessionId: "sess-tb-1",
      decision,
      trustBundles: [trustBundle],
    });
    expect(result).toEqual({ ok: true });
  });
});
