import { z } from "zod";
import {
  railSchema,
  assetSchema,
  mpcpVersionSchema,
  policyHashSchema,
  iso8601DatetimeSchema,
} from "./shared.js";

const policyGrantScopeSchema = z.enum(["SESSION", "VEHICLE", "FLEET"]);

const maxSpendSchema = z.strictObject({
  perTxMinor: z.string().optional(),
  perSessionMinor: z.string().optional(),
  perDayMinor: z.string().optional(),
});

export const policyGrantSchema = z.strictObject({
  version: mpcpVersionSchema,
  grantId: z.string(),
  policyHash: policyHashSchema,
  subjectId: z.string(),
  operatorId: z.string().optional(),
  scope: policyGrantScopeSchema,
  allowedRails: z.array(railSchema),
  allowedAssets: z.array(assetSchema).optional(),
  maxSpend: maxSpendSchema.optional(),
  expiresAt: iso8601DatetimeSchema,
  requireApproval: z.boolean().optional(),
  reasons: z.array(z.string()).optional(),
});

export type PolicyGrant = z.infer<typeof policyGrantSchema>;
