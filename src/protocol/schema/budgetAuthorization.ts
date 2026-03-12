import { z } from "zod";
import {
  railSchema,
  assetSchema,
  mpcpVersionSchema,
  policyHashSchema,
  currencySchema,
  minorUnitSchema,
  iso8601DatetimeSchema,
} from "./shared.js";

const budgetScopeSchema = z.enum(["SESSION", "DAY", "VEHICLE", "FLEET"]);

export const budgetAuthorizationSchema = z.strictObject({
  version: mpcpVersionSchema,
  budgetId: z.string(),
  sessionId: z.string(),
  vehicleId: z.string(),
  scopeId: z.string().optional(),
  policyHash: policyHashSchema,
  currency: currencySchema,
  minorUnit: minorUnitSchema,
  budgetScope: budgetScopeSchema,
  maxAmountMinor: z.string(),
  allowedRails: z.array(railSchema),
  allowedAssets: z.array(assetSchema),
  destinationAllowlist: z.array(z.string()).optional(),
  expiresAt: iso8601DatetimeSchema,
});

export type BudgetAuthorization = z.infer<typeof budgetAuthorizationSchema>;
