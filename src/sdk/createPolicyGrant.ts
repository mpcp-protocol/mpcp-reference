import { randomUUID } from "node:crypto";
import type { PolicyGrantLike } from "../verifier/types.js";
export { createSignedPolicyGrant } from "../protocol/policyGrant.js";
export type { SignedPolicyGrant } from "../protocol/policyGrant.js";

export interface CreatePolicyGrantInput {
  policyHash: string;
  allowedRails: string[];
  expiresAt: string;
  grantId?: string;
  allowedAssets?: Array<{ kind: "XRP" } | { kind: "IOU"; currency: string; issuer: string } | { kind: "ERC20"; chainId: number; token: string }>;
  revocationEndpoint?: string;
  allowedPurposes?: string[];
  anchorRef?: string;
  /** Total authorized spend in minor units (e.g. drops for XRP). Signed by the PA. */
  budgetMinor?: string;
  /** Currency code for budgetMinor (e.g. "XRP"). Required when budgetMinor is set. */
  budgetCurrency?: string;
  /** On-chain escrow locking budgetMinor. Format: "xrpl:escrow:{account}:{sequence}". Signed by the PA. */
  budgetEscrowRef?: string;
  /** Address of the only gateway authorized to spend against this grant's escrow. Rail-specific format. PA-signed. */
  authorizedGateway?: string;
  /** PA-signed per-transaction cap for offline merchant acceptance, in minor units (see offlineMaxSinglePaymentCurrency). */
  offlineMaxSinglePayment?: string;
  /** Currency code for offlineMaxSinglePayment (e.g. "XRP"). */
  offlineMaxSinglePaymentCurrency?: string;
}

/**
 * Create a policy grant artifact for verification.
 *
 * @param input - Grant parameters
 * @returns Policy grant compatible with verifyPolicyGrant / verifySettlement
 */
export function createPolicyGrant(input: CreatePolicyGrantInput): PolicyGrantLike {
  return {
    grantId: input.grantId ?? randomUUID(),
    policyHash: input.policyHash,
    expiresAt: input.expiresAt,
    allowedRails: input.allowedRails,
    allowedAssets: input.allowedAssets ?? [],
    ...(input.revocationEndpoint ? { revocationEndpoint: input.revocationEndpoint } : {}),
    ...(input.allowedPurposes ? { allowedPurposes: input.allowedPurposes } : {}),
    ...(input.anchorRef ? { anchorRef: input.anchorRef } : {}),
    ...(input.budgetMinor ? { budgetMinor: input.budgetMinor } : {}),
    ...(input.budgetCurrency ? { budgetCurrency: input.budgetCurrency } : {}),
    ...(input.budgetEscrowRef ? { budgetEscrowRef: input.budgetEscrowRef } : {}),
    ...(input.authorizedGateway ? { authorizedGateway: input.authorizedGateway } : {}),
    ...(input.offlineMaxSinglePayment ? { offlineMaxSinglePayment: input.offlineMaxSinglePayment } : {}),
    ...(input.offlineMaxSinglePaymentCurrency ? { offlineMaxSinglePaymentCurrency: input.offlineMaxSinglePaymentCurrency } : {}),
  };
}
