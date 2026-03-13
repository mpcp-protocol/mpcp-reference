import { z } from "zod";
import {
  railSchema,
  assetSchema,
  mpcpVersionSchema,
  policyHashSchema,
  intentHashSchema,
  iso8601DatetimeSchema,
} from "./shared.js";

export const paymentAuthorizationSchema = z.strictObject({
  version: mpcpVersionSchema,
  decisionId: z.string(),
  sessionId: z.string(),
  policyHash: policyHashSchema,
  budgetId: z.string(),
  quoteId: z.string(),
  rail: railSchema,
  asset: assetSchema.optional(),
  amount: z.string(),
  destination: z.string().optional(),
  intentHash: intentHashSchema.optional(),
  expiresAt: iso8601DatetimeSchema,
});

export const signedPaymentAuthorizationSchema = z.strictObject({
  authorization: paymentAuthorizationSchema,
  issuer: z.string().optional(),
  issuerKeyId: z.string(),
  signature: z.string(),
});

export type PaymentAuthorization = z.infer<typeof paymentAuthorizationSchema>;
export type SignedPaymentAuthorization = z.infer<typeof signedPaymentAuthorizationSchema>;
