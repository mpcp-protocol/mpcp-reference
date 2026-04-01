import { z } from "zod";
import { signedBudgetAuthorizationSchema } from "./signedBudgetAuthorization.js";
import { policyGrantForVerificationSchema } from "./verifySchemas.js";

/**
 * Canonical MPCP artifact bundle format.
 * Packages complete authorization verification data for exchange between systems.
 *
 * Required: policyGrant, sba
 * Optional: paymentPolicyDecision, public key
 *
 * When sbaPublicKeyPem is present, the bundle is self-contained
 * and verification can run without MPCP_SBA_SIGNING_PUBLIC_KEY_PEM env var.
 */
export const artifactBundleSchema = z
  .object({
    policyGrant: policyGrantForVerificationSchema,
    sba: signedBudgetAuthorizationSchema,
    paymentPolicyDecision: z.record(z.unknown()).optional(),
    sbaPublicKeyPem: z.string().optional(),
  })
  .strict();

export type ArtifactBundle = z.infer<typeof artifactBundleSchema>;
