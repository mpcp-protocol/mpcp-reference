import { z } from "zod";
import { railSchema } from "./shared.js";
import { assetSchema } from "./shared.js";
import { mpcpVersionSchema } from "./shared.js";

export const settlementIntentSchema = z.object({
  version: mpcpVersionSchema,
  rail: railSchema,
  asset: assetSchema.optional(),
  amount: z.string(),
  destination: z.string().optional(),
  referenceId: z.string().optional(),
  createdAt: z.string(),
});

export type SettlementIntent = z.infer<typeof settlementIntentSchema>;
