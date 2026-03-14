import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveXrplDid } from "../../src/anchor/xrplDid.js";

describe("resolveXrplDid", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockDIDDocumentHex = Buffer.from(
    JSON.stringify({
      "@context": ["https://www.w3.org/ns/did/v1"],
      id: "did:xrpl:mainnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      verificationMethod: [
        {
          id: "did:xrpl:mainnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh#key-1",
          type: "JsonWebKey2020",
          publicKeyJwk: {
            kty: "OKP",
            crv: "Ed25519",
            x: "base64url-encoded-key",
          },
        },
      ],
    }),
    "utf-8",
  ).toString("hex");

  const mockSuccessResponse = {
    result: {
      account_objects: [
        {
          LedgerEntryType: "DID",
          DIDDocument: mockDIDDocumentHex,
        },
      ],
    },
  };

  it("resolves a valid did:xrpl:mainnet DID and returns JWK", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response);

    const result = await resolveXrplDid(
      "did:xrpl:mainnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    );

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.jwk).toMatchObject({ kty: "OKP", crv: "Ed25519" });
    }

    expect(fetch).toHaveBeenCalledWith(
      "https://xrplcluster.com",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("resolves a valid did:xrpl:testnet DID against testnet RPC", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response);

    const result = await resolveXrplDid(
      "did:xrpl:testnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
    );

    expect("error" in result).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      "https://s.altnet.rippletest.net:51234",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses custom rpcUrl when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response);

    await resolveXrplDid("did:xrpl:mainnet:rHb9", {
      rpcUrl: "https://custom.rpc.example.com",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://custom.rpc.example.com",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns error for invalid DID format (not did:xrpl)", async () => {
    const result = await resolveXrplDid("did:web:example.com");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("invalid_did_format");
    }
  });

  it("returns error for unknown network", async () => {
    const result = await resolveXrplDid("did:xrpl:devnet:rAddr");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("unknown_xrpl_network");
    }
  });

  it("returns error when DID object not found on account", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { account_objects: [] } }),
    } as Response);

    const result = await resolveXrplDid("did:xrpl:mainnet:rNoDidAccount");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("xrpl_did_not_found");
    }
  });

  it("returns error when DIDDocument field is missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { account_objects: [{ LedgerEntryType: "DID" }] },
      }),
    } as Response);

    const result = await resolveXrplDid("did:xrpl:mainnet:rAddr");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("xrpl_did_document_missing");
    }
  });

  it("returns error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const result = await resolveXrplDid("did:xrpl:mainnet:rAddr");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("xrpl_rpc_fetch_failed");
    }
  });

  it("returns error on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    const result = await resolveXrplDid("did:xrpl:mainnet:rAddr");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("xrpl_rpc_http_error");
    }
  });

  it("returns error when publicKeyJwk is absent from verificationMethod", async () => {
    const hexNoJwk = Buffer.from(
      JSON.stringify({
        verificationMethod: [{ id: "key-1", type: "JsonWebKey2020" }],
      }),
      "utf-8",
    ).toString("hex");

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { account_objects: [{ DIDDocument: hexNoJwk }] },
      }),
    } as Response);

    const result = await resolveXrplDid("did:xrpl:mainnet:rAddr");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("xrpl_did_no_public_key_jwk");
    }
  });
});
