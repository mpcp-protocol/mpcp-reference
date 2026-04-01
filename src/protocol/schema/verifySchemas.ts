import { z } from "zod";
import {
  railSchema,
  assetSchema,
  policyHashSchema,
  iso8601DatetimeSchema,
  mpcpVersionSchema,
} from "./shared.js";

/**
 * Minimal policy grant shape for verification.
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
  })
  .refine((g) => g.expiresAt != null || g.expiresAtISO != null, {
    message: "policy_grant_missing_expiry",
  });

export type PolicyGrantForVerification = z.infer<
  typeof policyGrantForVerificationSchema
>;

/**
 * Settlement intent for verification. Requires core fields; version/createdAt optional
 * to support intents from various sources.
 */
export const settlementIntentForVerificationSchema = z.object({
  version: mpcpVersionSchema.optional(),
  rail: railSchema,
  amount: z.string(),
  destination: z.string().optional(),
  asset: assetSchema.optional(),
  referenceId: z.string().optional(),
  createdAt: iso8601DatetimeSchema.optional(),
});
