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
  budgetMinor?: string;
  budgetCurrency?: string;
  budgetEscrowRef?: string;
  authorizedGateway?: string;
  offlineMaxSinglePayment?: string;
  offlineMaxSinglePaymentCurrency?: string;
  offlineMaxCumulativePayment?: string;
  offlineMaxCumulativePaymentCurrency?: string;
  velocityLimit?: { maxPayments: number; windowSeconds: number };
  maxSpend?: { perTxMinor?: string; perSessionMinor?: string; perDayMinor?: string };
  destinationAllowlist?: string[];
  merchantCredentialIssuer?: string;
  merchantCredentialType?: string;
  activeGrantCredentialIssuer?: string;
  gatewayCredentialIssuer?: string;
  gatewayCredentialType?: string;
  subjectCredentialIssuer?: string;
  subjectCredentialType?: string;
  operatorId?: string;
}

/**
 * Create a policy grant artifact for verification.
 *
 * @param input - Grant parameters
 * @returns Policy grant compatible with verifyPolicyGrant / verifySettlement
 */
export function createPolicyGrant(input: CreatePolicyGrantInput): PolicyGrantLike {
  const grant: PolicyGrantLike = {
    grantId: input.grantId ?? randomUUID(),
    policyHash: input.policyHash,
    expiresAt: input.expiresAt,
    allowedRails: input.allowedRails,
    allowedAssets: input.allowedAssets ?? [],
  };
  const optionalFields: Array<keyof CreatePolicyGrantInput> = [
    "revocationEndpoint", "allowedPurposes", "anchorRef",
    "budgetMinor", "budgetCurrency", "budgetEscrowRef", "authorizedGateway",
    "offlineMaxSinglePayment", "offlineMaxSinglePaymentCurrency",
    "offlineMaxCumulativePayment", "offlineMaxCumulativePaymentCurrency",
    "velocityLimit", "maxSpend", "destinationAllowlist",
    "merchantCredentialIssuer", "merchantCredentialType",
    "activeGrantCredentialIssuer",
    "gatewayCredentialIssuer", "gatewayCredentialType",
    "subjectCredentialIssuer", "subjectCredentialType",
    "operatorId",
  ];
  for (const key of optionalFields) {
    const val = input[key];
    if (val !== undefined && val !== null) {
      (grant as Record<string, unknown>)[key] = val;
    }
  }
  return grant;
}
