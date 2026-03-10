import { z } from "zod";
import { railSchema, assetSchema, mpcpVersionSchema } from "./shared.js";

const maxSpendSchema = z.object({
  perTxMinor: z.string().optional(),
  perSessionMinor: z.string().optional(),
  perDayMinor: z.string().optional(),
});

export const policyGrantSchema = z.object({
  version: mpcpVersionSchema,
  grantId: z.string(),
  policyHash: z.string(),
  subjectId: z.string(),
  operatorId: z.string().optional(),
  scope: z.string(),
  allowedRails: z.array(railSchema),
  allowedAssets: z.array(assetSchema).optional(),
  maxSpend: maxSpendSchema.optional(),
  expiresAt: z.string(),
  requireApproval: z.boolean().optional(),
  reasons: z.array(z.string()).optional(),
});

export type PolicyGrant = z.infer<typeof policyGrantSchema>;
