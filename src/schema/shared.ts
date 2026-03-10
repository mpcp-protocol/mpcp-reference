import { z } from "zod";

export const railSchema = z.enum(["xrpl", "evm", "stripe", "hosted"]);
export type Rail = z.infer<typeof railSchema>;

export const assetIouSchema = z.object({
  kind: z.literal("IOU"),
  currency: z.string(),
  issuer: z.string(),
});

export const assetXrpSchema = z.object({
  kind: z.literal("XRP"),
});

export const assetErc20Schema = z.object({
  kind: z.literal("ERC20"),
  chainId: z.number(),
  token: z.string(),
});

export const assetSchema = z.discriminatedUnion("kind", [
  assetXrpSchema,
  assetIouSchema,
  assetErc20Schema,
]);
export type Asset = z.infer<typeof assetSchema>;

export const mpcpVersionSchema = z.union([
  z.literal(1),
  z.string().regex(/^\d+\.\d+$/),
]);
