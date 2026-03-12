import { z } from "zod";
import {
  railSchema,
  assetSchema,
  mpcpVersionSchema,
  iso8601DatetimeSchema,
} from "./shared.js";

export const settlementIntentSchema = z.strictObject({
  version: mpcpVersionSchema,
  rail: railSchema,
  asset: assetSchema.optional(),
  amount: z.string(),
  destination: z.string().optional(),
  referenceId: z.string().optional(),
  createdAt: iso8601DatetimeSchema,
});

export type SettlementIntent = z.infer<typeof settlementIntentSchema>;
