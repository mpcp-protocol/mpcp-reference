import crypto, { createHash, randomUUID } from "node:crypto";
import type { Asset, PaymentPolicyDecision, Rail } from "../policy-core/types.js";
import { canonicalJson } from "../canonical/canonicalJson.js";

export type BudgetScope = "SESSION" | "DAY" | "VEHICLE" | "FLEET";

export interface SessionBudgetAuthorization {
  version: 1;
  budgetId: string;
  sessionId: string;
  vehicleId: string;
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
  signature: string;
  keyId: string;
}

function hashAuthorization(authorization: SessionBudgetAuthorization): Buffer {
  return createHash("sha256").update(canonicalJson(authorization)).digest();
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
  vehicleId: string;
  scopeId?: string;
  policyHash: string;
  currency: string;
  minorUnit?: number;
  budgetScope?: BudgetScope;
  maxAmountMinor: string;
  allowedRails: Rail[];
  allowedAssets: Asset[];
  destinationAllowlist: string[];
  expiresAt: string;
}): SignedSessionBudgetAuthorization | null {
  const privateKey = parseSigningPrivateKey();
  if (!privateKey) return null;

  const authorization: SessionBudgetAuthorization = {
    version: 1,
    budgetId: randomUUID(),
    sessionId: input.sessionId,
    vehicleId: input.vehicleId,
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
  return {
    authorization,
    signature,
    keyId: getExpectedKeyId(),
  };
}

export function verifySignedSessionBudgetAuthorizationForDecision(
  envelope: SignedSessionBudgetAuthorization,
  input: { sessionId: string; decision: PaymentPolicyDecision; nowMs?: number },
): { ok: true } | { ok: false; reason: "invalid_signature" | "expired" | "mismatch" } {
  if (envelope.keyId !== getExpectedKeyId()) return { ok: false, reason: "invalid_signature" };
  const publicKey = parseVerificationPublicKey();
  if (!publicKey) return { ok: false, reason: "invalid_signature" };

  const isValid = crypto.verify(
    null,
    hashAuthorization(envelope.authorization),
    publicKey,
    Buffer.from(envelope.signature, "base64"),
  );
  if (!isValid) return { ok: false, reason: "invalid_signature" };

  const nowMs = typeof input.nowMs === "number" ? input.nowMs : Date.now();
  if (Date.parse(envelope.authorization.expiresAt) <= nowMs) return { ok: false, reason: "expired" };

  const { authorization } = envelope;
  const { decision } = input;
  if (authorization.sessionId !== input.sessionId || authorization.policyHash !== decision.policyHash) {
    return { ok: false, reason: "mismatch" };
  }
  if (authorization.budgetScope !== "SESSION") return { ok: false, reason: "mismatch" };
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
    if (decisionMinor > budgetMinor) return { ok: false, reason: "mismatch" };
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
