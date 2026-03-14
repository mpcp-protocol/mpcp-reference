/**
 * XRPL DID resolver for did:xrpl:{network}:{rAddress}.
 *
 * Resolves an XRPL account DID to a JWK public key using the XRPL JSON-RPC
 * `account_objects` method with type "DID". No SDK dependency — fetch only.
 *
 * Supported DID formats:
 *   did:xrpl:mainnet:rAddress
 *   did:xrpl:testnet:rAddress
 *
 * Network RPC defaults:
 *   mainnet → https://xrplcluster.com
 *   testnet → https://s.altnet.rippletest.net:51234
 */

const XRPL_RPC: Record<string, string> = {
  mainnet: "https://xrplcluster.com",
  testnet: "https://s.altnet.rippletest.net:51234",
};

export interface ResolveXrplDidSuccess {
  jwk: JsonWebKey;
}

export interface ResolveXrplDidError {
  error: string;
}

export type ResolveXrplDidResult = ResolveXrplDidSuccess | ResolveXrplDidError;

/**
 * Resolve a did:xrpl DID to a JWK public key.
 *
 * @param did - DID string, e.g. "did:xrpl:mainnet:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
 * @param options - Optional RPC URL override and timeout
 * @returns { jwk } on success or { error } on failure
 */
export async function resolveXrplDid(
  did: string,
  options?: { rpcUrl?: string; timeoutMs?: number },
): Promise<ResolveXrplDidResult> {
  // Parse DID: did:xrpl:{network}:{rAddress}
  const parts = did.split(":");
  if (parts.length < 4 || parts[0] !== "did" || parts[1] !== "xrpl") {
    return { error: `invalid_did_format: expected did:xrpl:{network}:{rAddress}, got "${did}"` };
  }

  const network = parts[2];
  const account = parts.slice(3).join(":");

  const rpcUrl = options?.rpcUrl ?? XRPL_RPC[network];
  if (!rpcUrl) {
    return { error: `unknown_xrpl_network: "${network}". Use mainnet or testnet, or pass rpcUrl.` };
  }

  const body = JSON.stringify({
    method: "account_objects",
    params: [{ account, type: "DID" }],
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
    return { error: `xrpl_rpc_fetch_failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    return { error: `xrpl_rpc_http_error: ${res.status} ${res.statusText}` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { error: "xrpl_rpc_invalid_json" };
  }

  const result = (data as { result?: { account_objects?: Array<{ DIDDocument?: string }> } }).result;
  if (!result) {
    return { error: "xrpl_rpc_missing_result" };
  }

  const objects = result.account_objects;
  if (!Array.isArray(objects) || objects.length === 0) {
    return { error: `xrpl_did_not_found: no DID object on account "${account}"` };
  }

  const didObject = objects[0];
  const didDocumentHex = didObject.DIDDocument;
  if (typeof didDocumentHex !== "string" || didDocumentHex.length === 0) {
    return { error: "xrpl_did_document_missing: DIDDocument field is absent or empty" };
  }

  // Hex-decode the DIDDocument field
  let didDocumentJson: string;
  try {
    const bytes = Buffer.from(didDocumentHex, "hex");
    didDocumentJson = bytes.toString("utf-8");
  } catch {
    return { error: "xrpl_did_document_invalid_hex" };
  }

  let didDocument: unknown;
  try {
    didDocument = JSON.parse(didDocumentJson);
  } catch {
    return { error: "xrpl_did_document_invalid_json" };
  }

  const verificationMethods = (
    didDocument as { verificationMethod?: Array<{ publicKeyJwk?: JsonWebKey }> }
  ).verificationMethod;

  if (!Array.isArray(verificationMethods) || verificationMethods.length === 0) {
    return { error: "xrpl_did_no_verification_method" };
  }

  const jwk = verificationMethods[0].publicKeyJwk;
  if (!jwk || typeof jwk !== "object") {
    return { error: "xrpl_did_no_public_key_jwk" };
  }

  return { jwk };
}
