import crypto, { createHash, randomUUID } from "node:crypto";
import type { Asset, PaymentPolicyDecision, Rail } from "../policy-core/types.js";
import { canonicalJson } from "../hash/canonicalJson.js";
import { resolveFromTrustBundle, type TrustBundle } from "./trustBundle.js";

export type BudgetScope = "SESSION" | "DAY" | "VEHICLE" | "FLEET" | "TRIP";

export interface SessionBudgetAuthorization {
  version: "1.0";
  budgetId: string;
  grantId: string;
  sessionId: string;
  actorId: string;
  scopeId?: string;
  policyHash: string;
  currency: string;
  minorUnit: number;
  budgetScope: BudgetScope;
  maxAmountMinor: string;
  allowedRails: Rail[];
  allowedAssets: Asset[];
  destinationAllowlist: string[];
  expiresAt: string;
}

export interface SignedSessionBudgetAuthorization {
  authorization: SessionBudgetAuthorization;
  issuer?: string;
  issuerKeyId: string;
  signature: string;
}

function hashAuthorization(authorization: SessionBudgetAuthorization): Buffer {
  return createHash("sha256").update("MPCP:SBA:1.0:" + canonicalJson(authorization)).digest();
}

function getExpectedKeyId(): string {
  return process.env.MPCP_SBA_SIGNING_KEY_ID || "mpcp-sba-signing-key-1";
}

function parseSigningPrivateKey(): crypto.KeyObject | null {
  const pem = process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
  if (!pem) return null;
  try {
    return crypto.createPrivateKey(pem);
  } catch {
    return null;
  }
}

function parseVerificationPublicKey(): crypto.KeyObject | null {
  const pem = process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
  if (!pem) return null;
  try {
    return crypto.createPublicKey(pem);
  } catch {
    return null;
  }
}

function assetMatches(a: Asset, b: Asset): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function createSignedSessionBudgetAuthorization(input: {
  sessionId: string;
  actorId: string;
  scopeId?: string;
  grantId: string;
  policyHash: string;
  currency: string;
  minorUnit?: number;
  budgetScope?: BudgetScope;
  maxAmountMinor: string;
  allowedRails: Rail[];
  allowedAssets: Asset[];
  destinationAllowlist: string[];
  expiresAt: string;
  /** Issuer identity (domain or DID). Required when the merchant uses Trust Bundle key resolution. */
  issuer?: string;
}): SignedSessionBudgetAuthorization | null {
  const privateKey = parseSigningPrivateKey();
  if (!privateKey) return null;

  const authorization: SessionBudgetAuthorization = {
    version: "1.0",
    budgetId: randomUUID(),
    grantId: input.grantId,
    sessionId: input.sessionId,
    actorId: input.actorId,
    ...(input.scopeId ? { scopeId: input.scopeId } : {}),
    policyHash: input.policyHash,
    currency: input.currency,
    minorUnit: input.minorUnit ?? 2,
    budgetScope: input.budgetScope ?? "SESSION",
    maxAmountMinor: input.maxAmountMinor,
    allowedRails: input.allowedRails,
    allowedAssets: input.allowedAssets,
    destinationAllowlist: input.destinationAllowlist,
    expiresAt: input.expiresAt,
  };

  const signature = crypto.sign(null, hashAuthorization(authorization), privateKey).toString("base64");
  const result: SignedSessionBudgetAuthorization = {
    authorization,
    issuerKeyId: getExpectedKeyId(),
    signature,
  };
  if (input.issuer) result.issuer = input.issuer;
  return result;
}

export function verifySignedSessionBudgetAuthorizationForDecision(
  envelope: SignedSessionBudgetAuthorization,
  input: { sessionId: string; decision: PaymentPolicyDecision; nowMs?: number; cumulativeSpentMinor?: string; trustBundles?: TrustBundle[]; clockDriftToleranceMs?: number },
): { ok: true } | { ok: false; reason: "invalid_signature" | "expired" | "budget_exceeded" | "mismatch" } {
  // Key resolution per spec (3-step algorithm):
  //   1. Trust Bundle — offline JWK lookup by issuer + issuerKeyId
  //   2. Pre-configured key — MPCP_SBA_SIGNING_PUBLIC_KEY_PEM env var
  //   3. HTTPS well-known — not yet implemented
  let publicKey: crypto.KeyObject | null = null;
  if (input.trustBundles?.length && envelope.issuer) {
    const jwk = resolveFromTrustBundle(envelope.issuer, envelope.issuerKeyId, input.trustBundles);
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
    hashAuthorization(envelope.authorization),
    publicKey,
    Buffer.from(envelope.signature, "base64"),
  );
  if (!isValid) return { ok: false, reason: "invalid_signature" };

  const nowMs = typeof input.nowMs === "number" ? input.nowMs : Date.now();
  const driftMs = input.clockDriftToleranceMs ?? 300_000;
  if (Date.parse(envelope.authorization.expiresAt) <= nowMs - driftMs) return { ok: false, reason: "expired" };

  const { authorization } = envelope;
  const { decision } = input;
  if (authorization.sessionId !== input.sessionId || authorization.policyHash !== decision.policyHash) {
    return { ok: false, reason: "mismatch" };
  }
  if (authorization.budgetScope !== "SESSION" && authorization.budgetScope !== "TRIP") return { ok: false, reason: "mismatch" };
  if (decision.rail && !authorization.allowedRails.includes(decision.rail)) {
    return { ok: false, reason: "mismatch" };
  }
  if (
    decision.asset &&
    authorization.allowedAssets.length > 0 &&
    !authorization.allowedAssets.some((allowedAsset) => assetMatches(allowedAsset, decision.asset!))
  ) {
    return { ok: false, reason: "mismatch" };
  }
  if (decision.priceFiat?.amountMinor) {
    const budgetMinor = BigInt(authorization.maxAmountMinor);
    const decisionMinor = BigInt(decision.priceFiat.amountMinor);
    const alreadySpent = BigInt(input.cumulativeSpentMinor ?? "0");
    if (alreadySpent + decisionMinor > budgetMinor) return { ok: false, reason: "budget_exceeded" };
  }

  const quoteId = decision.chosen?.quoteId;
  const chosenQuote = quoteId
    ? decision.settlementQuotes?.find((q) => q.quoteId === quoteId)
    : decision.settlementQuotes?.find((q) => q.rail === decision.rail);
  if (chosenQuote && authorization.destinationAllowlist.length > 0) {
    if (!authorization.destinationAllowlist.includes(chosenQuote.destination)) {
      return { ok: false, reason: "mismatch" };
    }
  }
  return { ok: true };
}
