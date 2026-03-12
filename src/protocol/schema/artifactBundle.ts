import { z } from "zod";
import { railSchema, assetSchema, iso8601DatetimeSchema } from "./shared.js";
import { signedBudgetAuthorizationSchema } from "./signedBudgetAuthorization.js";
import { signedPaymentAuthorizationSchema } from "./paymentAuthorization.js";
import { policyGrantForVerificationSchema } from "./verifySchemas.js";
import { settlementIntentForVerificationSchema } from "./verifySchemas.js";

/**
 * Settlement result (executed settlement) for verification.
 * Rail-specific fields (txHash, payer, etc.) may be present.
 */
export const settlementResultSchema = z
  .object({
    amount: z.string(),
    rail: railSchema,
    asset: assetSchema.optional(),
    destination: z.string().optional(),
    nowISO: iso8601DatetimeSchema.optional(),
  })
  .passthrough();

export type SettlementResultSchema = z.infer<typeof settlementResultSchema>;

/**
 * Canonical MPCP artifact bundle format.
 * Packages complete payment verification data for exchange between systems.
 *
 * Required: policyGrant, sba, spa, settlement
 * Optional: settlementIntent, paymentPolicyDecision, ledgerAnchor, public keys
 *
 * When sbaPublicKeyPem and spaPublicKeyPem are present, the bundle is self-contained
 * and verification can run without MPCP_*_SIGNING_PUBLIC_KEY_PEM env vars.
 */
export const artifactBundleSchema = z
  .object({
    policyGrant: policyGrantForVerificationSchema,
    sba: signedBudgetAuthorizationSchema,
    spa: signedPaymentAuthorizationSchema,
    settlement: settlementResultSchema,
    settlementIntent: settlementIntentForVerificationSchema.optional(),
    paymentPolicyDecision: z.record(z.unknown()).optional(),
    ledgerAnchor: z.record(z.unknown()).optional(),
    sbaPublicKeyPem: z.string().optional(),
    spaPublicKeyPem: z.string().optional(),
  })
  .strict();

export type ArtifactBundle = z.infer<typeof artifactBundleSchema>;
