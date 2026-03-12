/**
 * PR17 — Reference Service API
 *
 * Lightweight facade for backend teams. Wraps protocol + verifier + anchor.
 */

import type {
  PolicyGrantLike,
  SettlementVerificationContext,
} from "../verifier/types.js";
import type { DisputeVerificationInput, DisputeVerificationResult } from "../verifier/verifyDisputedSettlement.js";
import type { Asset, Rail } from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "../protocol/sba.js";
import type { AnchorOptions, AnchorResult } from "../anchor/types.js";

import { createSignedSessionBudgetAuthorization } from "../protocol/sba.js";
import { verifySettlement } from "../verifier/verifySettlement.js";
import {
  verifyDisputedSettlement,
  verifyDisputedSettlementAsync,
} from "../verifier/verifyDisputedSettlement.js";
import { mockAnchorIntentHash } from "../anchor/mockAnchor.js";
import { hederaHcsAnchorIntentHash } from "../anchor/hederaHcsAnchor.js";

// --- Issue Budget ---

export interface IssueBudgetInput {
  /** Policy grant to derive constraints from */
  policyGrant: PolicyGrantLike;
  sessionId: string;
  vehicleId: string;
  maxAmountMinor: string;
  destinationAllowlist: string[];
  scopeId?: string;
  currency?: string;
  minorUnit?: number;
}

/**
 * Issue a signed budget authorization from a policy grant.
 * Requires MPCP_SBA_SIGNING_PRIVATE_KEY_PEM (and related env) to be set.
 *
 * @returns Signed budget auth or null if signing key not configured
 */
export function issueBudget(input: IssueBudgetInput): SignedSessionBudgetAuthorization | null {
  const {
    policyGrant,
    sessionId,
    vehicleId,
    maxAmountMinor,
    destinationAllowlist,
    scopeId,
    currency = "USD",
    minorUnit = 2,
  } = input;

  const policyHash = policyGrant.policyHash;
  const allowedRails = (policyGrant.allowedRails ?? []) as Rail[];
  const allowedAssets = (policyGrant.allowedAssets ?? []) as Asset[];
  const expiresAt = policyGrant.expiresAt ?? policyGrant.expiresAtISO ?? "";

  return createSignedSessionBudgetAuthorization({
    sessionId,
    vehicleId,
    scopeId,
    policyHash,
    currency,
    minorUnit,
    maxAmountMinor,
    allowedRails,
    allowedAssets,
    destinationAllowlist,
    expiresAt,
  });
}

// --- Verify Settlement ---

/**
 * Verify a settlement against the full MPCP chain.
 */
export function verifySettlementService(ctx: SettlementVerificationContext) {
  return verifySettlement(ctx);
}

// --- Verify Dispute ---

/**
 * Verify a disputed settlement (sync).
 */
export function verifyDispute(input: DisputeVerificationInput): DisputeVerificationResult {
  return verifyDisputedSettlement(input);
}

/**
 * Verify a disputed settlement (async). Use for Hedera HCS anchors.
 */
export function verifyDisputeAsync(input: DisputeVerificationInput): Promise<DisputeVerificationResult> {
  return verifyDisputedSettlementAsync(input);
}

// --- Anchor Intent ---

/**
 * Anchor an intent hash to a ledger.
 * - mock: stub (development/testing)
 * - hedera-hcs: Hedera HCS (requires env: HEDERA_OPERATOR_ACCOUNT_ID, etc.)
 */
export async function anchorIntent(
  intentHash: string,
  options?: AnchorOptions,
): Promise<AnchorResult> {
  const rail = options?.rail ?? "mock";

  if (rail === "mock") {
    return mockAnchorIntentHash(intentHash, { ...options, rail: "mock" });
  }
  if (rail === "hedera-hcs") {
    return hederaHcsAnchorIntentHash(intentHash, { ...options, rail: "hedera-hcs" });
  }
  throw new Error(
    `Unsupported anchor rail "${String(rail)}". Supported rails: "mock", "hedera-hcs".`,
  );
}
