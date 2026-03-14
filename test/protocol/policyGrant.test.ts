import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createSignedPolicyGrant, verifyPolicyGrantSignature } from "../../src/protocol/policyGrant.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import { verifyPolicyGrant } from "../../src/verifier/verifyPolicyGrant.js";
import { createPolicyGrant } from "../../src/sdk/createPolicyGrant.js";

const ORIGINAL_ENV = {
  privateKey: process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM = ORIGINAL_ENV.privateKey;
  process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM = ORIGINAL_ENV.publicKey;
  process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID = ORIGINAL_ENV.keyId;
  delete process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID;
});

function setupKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID = "mpcp-policy-grant-signing-key-1";
}

const baseGrant: PolicyGrantLike = {
  grantId: "grant-pg-1",
  policyHash: "a1b2c3d4e5f6",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

describe("createSignedPolicyGrant + verifyPolicyGrantSignature", () => {
  it("returns null when private key env var not set", () => {
    const result = createSignedPolicyGrant(baseGrant);
    expect(result).toBeNull();
  });

  it("creates a signed policy grant and verifies it", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();
    expect(signed!.signature).toBeDefined();
    expect(signed!.issuerKeyId).toBe("mpcp-policy-grant-signing-key-1");
    expect(signed!.grant).toEqual(baseGrant);

    const result = verifyPolicyGrantSignature(signed!);
    expect(result).toEqual({ ok: true });
  });

  it("fails verification with tampered grant payload", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();

    const tampered = { ...signed!, grant: { ...signed!.grant, policyHash: "deadbeefcafe" } };
    const result = verifyPolicyGrantSignature(tampered);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("fails verification with wrong key ID", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();

    const wrongKeyId = { ...signed!, issuerKeyId: "wrong-key-id" };
    const result = verifyPolicyGrantSignature(wrongKeyId);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("fails verification when public key env var not set", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();
    delete process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM;

    const result = verifyPolicyGrantSignature(signed!);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });
});

describe("createPolicyGrant with new fields", () => {
  it("includes revocationEndpoint when provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
      revocationEndpoint: "https://wallet.alice.example.com/revoke",
    });
    expect(grant.revocationEndpoint).toBe("https://wallet.alice.example.com/revoke");
  });

  it("omits revocationEndpoint when not provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
    });
    expect(grant.revocationEndpoint).toBeUndefined();
    expect("revocationEndpoint" in grant).toBe(false);
  });

  it("includes allowedPurposes when provided", () => {
    const purposes = ["travel:hotel", "travel:flight", "travel:transport"];
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
      allowedPurposes: purposes,
    });
    expect(grant.allowedPurposes).toEqual(purposes);
  });

  it("omits allowedPurposes when not provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
    });
    expect(grant.allowedPurposes).toBeUndefined();
  });

  it("includes both revocationEndpoint and allowedPurposes together", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
      revocationEndpoint: "https://wallet.example.com/revoke",
      allowedPurposes: ["travel:hotel"],
    });
    expect(grant.revocationEndpoint).toBe("https://wallet.example.com/revoke");
    expect(grant.allowedPurposes).toEqual(["travel:hotel"]);
  });

  it("includes anchorRef when provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
      anchorRef: "hcs:0.0.1234:99",
    });
    expect(grant.anchorRef).toBe("hcs:0.0.1234:99");
  });

  it("includes xrpl:nft anchorRef when provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
      anchorRef: "xrpl:nft:000800006B55D0F1584E4D2CBD04F60B9E61FFDD2A4E3F9F00000001",
    });
    expect(grant.anchorRef).toBe(
      "xrpl:nft:000800006B55D0F1584E4D2CBD04F60B9E61FFDD2A4E3F9F00000001",
    );
  });

  it("omits anchorRef when not provided", () => {
    const grant = createPolicyGrant({
      policyHash: "a1b2c3d4e5f6",
      allowedRails: ["xrpl"],
      expiresAt: "2030-01-01T00:00:00Z",
    });
    expect(grant.anchorRef).toBeUndefined();
    expect("anchorRef" in grant).toBe(false);
  });
});

describe("verifyPolicyGrant with signature enforcement", () => {
  it("passes without signature when public key env var not set", () => {
    const result = verifyPolicyGrant(baseGrant);
    expect(result).toEqual({ valid: true });
  });

  it("fails when public key env var set but grant has no signature", () => {
    setupKeys();
    const result = verifyPolicyGrant(baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" });
  });

  it("passes when public key env var set and grant is properly signed", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();

    const grantWithSig = { ...baseGrant, issuerKeyId: signed!.issuerKeyId, signature: signed!.signature };
    const result = verifyPolicyGrant(grantWithSig);
    expect(result).toEqual({ valid: true });
  });

  it("fails when public key env var set and grant has invalid signature", () => {
    setupKeys();
    const grantWithBadSig = {
      ...baseGrant,
      issuerKeyId: "mpcp-policy-grant-signing-key-1",
      signature: "aW52YWxpZHNpZ25hdHVyZQ==", // invalid base64 signature
    };
    const result = verifyPolicyGrant(grantWithBadSig);
    expect(result).toMatchObject({ valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" });
  });
});
