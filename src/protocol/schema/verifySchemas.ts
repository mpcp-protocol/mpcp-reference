import { z } from "zod";
import {
  railSchema,
  assetSchema,
  policyHashSchema,
  iso8601DatetimeSchema,
} from "./shared.js";

const velocityLimitSchema = z.strictObject({
  maxPayments: z.number().int().min(1),
  windowSeconds: z.number().int().min(1),
});

const maxSpendSchema = z.object({
  perTxMinor: z.string().optional(),
  perSessionMinor: z.string().optional(),
  perDayMinor: z.string().optional(),
});

/**
 * Policy grant shape for verification (SECOP-aligned).
 * Accepts expiresAt or expiresAtISO (at least one required).
 */
export const policyGrantForVerificationSchema = z
  .object({
    grantId: z.string(),
    policyHash: policyHashSchema,
    expiresAt: iso8601DatetimeSchema.optional(),
    expiresAtISO: iso8601DatetimeSchema.optional(),
    allowedRails: z.array(railSchema),
    allowedAssets: z.array(assetSchema).optional(),
    issuer: z.string().optional(),
    issuerKeyId: z.string().optional(),
    signature: z.string().optional(),
    revocationEndpoint: z.string().url().optional(),
    allowedPurposes: z.array(z.string()).optional(),
    anchorRef: z.string().optional(),
    budgetMinor: z.string().regex(/^\d+$/).optional(),
    budgetCurrency: z.string().optional(),
    budgetEscrowRef: z.string().optional(),
    authorizedGateway: z.string().optional(),
    offlineMaxSinglePayment: z.string().regex(/^\d+$/).optional(),
    offlineMaxSinglePaymentCurrency: z.string().optional(),
    offlineMaxCumulativePayment: z.string().regex(/^\d+$/).optional(),
    offlineMaxCumulativePaymentCurrency: z.string().optional(),
    velocityLimit: velocityLimitSchema.optional(),
    maxSpend: maxSpendSchema.optional(),
    destinationAllowlist: z.array(z.string()).optional(),
    merchantCredentialIssuer: z.string().optional(),
    merchantCredentialType: z.string().optional(),
    activeGrantCredentialIssuer: z.string().optional(),
    gatewayCredentialIssuer: z.string().optional(),
    gatewayCredentialType: z.string().optional(),
    subjectCredentialIssuer: z.string().optional(),
    subjectCredentialType: z.string().optional(),
    operatorId: z.string().optional(),
  })
  .refine((g) => g.expiresAt != null || g.expiresAtISO != null, {
    message: "policy_grant_missing_expiry",
  });

export type PolicyGrantForVerification = z.infer<
  typeof policyGrantForVerificationSchema
>;
