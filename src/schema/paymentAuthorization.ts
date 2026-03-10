import { z } from "zod";
import { railSchema } from "./shared.js";
import { assetSchema } from "./shared.js";
import { mpcpVersionSchema } from "./shared.js";

export const paymentAuthorizationSchema = z.object({
  version: mpcpVersionSchema,
  decisionId: z.string(),
  sessionId: z.string(),
  policyHash: z.string(),
  quoteId: z.string(),
  rail: railSchema,
  asset: assetSchema.optional(),
  amount: z.string(),
  destination: z.string().optional(),
  intentHash: z.string().optional(),
  expiresAt: z.string(),
});

export const signedPaymentAuthorizationSchema = z.object({
  authorization: paymentAuthorizationSchema,
  signature: z.string(),
  keyId: z.string(),
});

export type PaymentAuthorization = z.infer<typeof paymentAuthorizationSchema>;
export type SignedPaymentAuthorization = z.infer<typeof signedPaymentAuthorizationSchema>;
