import { z } from "zod";
import { railSchema, assetSchema, mpcpVersionSchema } from "./shared.js";

const budgetScopeSchema = z.enum(["SESSION", "DAY", "VEHICLE", "FLEET"]);

export const budgetAuthorizationSchema = z.object({
  version: mpcpVersionSchema,
  budgetId: z.string(),
  sessionId: z.string(),
  vehicleId: z.string(),
  scopeId: z.string().optional(),
  policyHash: z.string(),
  currency: z.string(),
  minorUnit: z.number(),
  budgetScope: budgetScopeSchema,
  maxAmountMinor: z.string(),
  allowedRails: z.array(railSchema),
  allowedAssets: z.array(assetSchema),
  destinationAllowlist: z.array(z.string()).optional(),
  expiresAt: z.string(),
});

export type BudgetAuthorization = z.infer<typeof budgetAuthorizationSchema>;
