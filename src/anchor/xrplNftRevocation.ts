/**
 * XRPL NFT-based revocation check.
 *
 * Checks whether an XRPL NFToken still exists (has not been burned).
 * A burned (non-existent) NFT is treated as revocation of the associated PolicyGrant.
 *
 * Uses XRPL JSON-RPC `nft_info` method. No SDK dependency — fetch only.
 *
 * Default RPC endpoint: https://xrplcluster.com (mainnet)
 */

const DEFAULT_XRPL_RPC = "https://xrplcluster.com";

/** XRPL error codes that indicate the NFT no longer exists (burned / revoked). */
const REVOKED_ERROR_CODES = new Set([
  "objectNotFound",
  "entryNotFound",
  "nftNotFound",
]);

/**
 * Check whether an XRPL NFT exists (not burned).
 * Non-existence = revoked.
 *
 * @param tokenId - XRPL NFToken ID (64-char hex string)
 * @param options - Optional RPC URL and timeout
 * @returns { revoked: false } if NFT exists, { revoked: true } if burned, { revoked: false, error } on network/parse errors
 */
export async function checkXrplNftRevocation(
  tokenId: string,
  options?: { rpcUrl?: string; timeoutMs?: number },
): Promise<{ revoked: boolean; error?: string }> {
  const rpcUrl = options?.rpcUrl ?? DEFAULT_XRPL_RPC;

  const body = JSON.stringify({
    method: "nft_info",
    params: [{ nft_id: tokenId }],
  });

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? 5000;
    const timer = setTimeout(() => controller.abort(), timeout);
    res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    return {
      revoked: false,
      error: `xrpl_rpc_fetch_failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    return { revoked: false, error: `xrpl_rpc_http_error: ${res.status} ${res.statusText}` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { revoked: false, error: "xrpl_rpc_invalid_json" };
  }

  const result = (data as { result?: { nft_id?: string; error?: string } }).result;
  if (!result) {
    return { revoked: false, error: "xrpl_rpc_missing_result" };
  }

  // NFT exists — not revoked
  if (typeof result.nft_id === "string" && result.nft_id.length > 0) {
    return { revoked: false };
  }

  // Check for known "not found" error codes → NFT burned → revoked
  const errorCode = result.error;
  if (typeof errorCode === "string" && REVOKED_ERROR_CODES.has(errorCode)) {
    return { revoked: true };
  }

  // Unexpected error — treat as non-revoked, surface the error
  return {
    revoked: false,
    error: `xrpl_nft_info_error: ${errorCode ?? "unknown"}`,
  };
}
