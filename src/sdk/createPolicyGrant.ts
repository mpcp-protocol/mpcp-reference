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
  };
}
