import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkXrplNftRevocation } from "../../src/anchor/xrplNftRevocation.js";

const MOCK_TOKEN_ID = "000800006B55D0F1584E4D2CBD04F60B9E61FFDD2A4E3F9F00000001";

describe("checkXrplNftRevocation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns revoked=false when NFT exists", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          nft_id: MOCK_TOKEN_ID,
          owner: "rSomeOwner",
          is_burned: false,
        },
      }),
    } as Response);

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result).toEqual({ revoked: false });
  });

  it("returns revoked=true when NFT is burned (objectNotFound)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { error: "objectNotFound" },
      }),
    } as Response);

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result).toEqual({ revoked: true });
  });

  it("returns revoked=true for entryNotFound error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { error: "entryNotFound" },
      }),
    } as Response);

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result).toEqual({ revoked: true });
  });

  it("returns revoked=true for nftNotFound error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { error: "nftNotFound" },
      }),
    } as Response);

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result).toEqual({ revoked: true });
  });

  it("returns revoked=false with error for unexpected error codes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { error: "internalError" },
      }),
    } as Response);

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result.revoked).toBe(false);
    expect(result.error).toContain("xrpl_nft_info_error");
  });

  it("returns revoked=false with error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("connection refused"));

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result.revoked).toBe(false);
    expect(result.error).toContain("xrpl_rpc_fetch_failed");
    expect(result.error).toContain("connection refused");
  });

  it("returns revoked=false with error on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    } as Response);

    const result = await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(result.revoked).toBe(false);
    expect(result.error).toContain("xrpl_rpc_http_error");
  });

  it("uses default mainnet RPC URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { nft_id: MOCK_TOKEN_ID } }),
    } as Response);

    await checkXrplNftRevocation(MOCK_TOKEN_ID);
    expect(fetch).toHaveBeenCalledWith(
      "https://xrplcluster.com",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses custom rpcUrl when provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { nft_id: MOCK_TOKEN_ID } }),
    } as Response);

    await checkXrplNftRevocation(MOCK_TOKEN_ID, {
      rpcUrl: "https://testnet-rpc.xrpl.example.com",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://testnet-rpc.xrpl.example.com",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends correct nft_info JSON-RPC payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { nft_id: MOCK_TOKEN_ID } }),
    } as Response);

    await checkXrplNftRevocation(MOCK_TOKEN_ID);

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body).toEqual({
      method: "nft_info",
      params: [{ nft_id: MOCK_TOKEN_ID }],
    });
  });
});
