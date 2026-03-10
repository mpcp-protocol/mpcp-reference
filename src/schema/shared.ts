import { z } from "zod";

export const railSchema = z.enum(["xrpl", "evm", "stripe", "hosted"]);
export type Rail = z.infer<typeof railSchema>;

/** ISO 8601 datetime (e.g. 2026-03-08T14:00:00Z or 2026-03-08T14:00:00.123Z) */
export const iso8601DatetimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/);

/** Non-negative integer (e.g. minor unit scale) */
export const minorUnitSchema = z.number().int().min(0);

/** ISO 4217 currency code (3 uppercase letters) */
export const currencySchema = z.string().length(3).regex(/^[A-Z]{3}$/);

/** Policy hash (hex, 6–64 chars; allows truncated hashes) */
export const policyHashSchema = z.string().regex(/^[a-f0-9]{6,64}$/);

/** SHA256 hex hash (64 chars) */
export const intentHashSchema = z.string().length(64).regex(/^[a-f0-9]{64}$/);

/** Asset/token currency (e.g. USDC, RLUSD) — not necessarily ISO 4217 */
const assetCurrencySchema = z.string().min(2).max(10).regex(/^[A-Z0-9]+$/);

export const assetIouSchema = z.strictObject({
  kind: z.literal("IOU"),
  currency: assetCurrencySchema,
  issuer: z.string(),
});

export const assetXrpSchema = z.strictObject({
  kind: z.literal("XRP"),
});

export const assetErc20Schema = z.strictObject({
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

/** Protocol docs recommend semantic strings ("1.0"); numeric 1 accepted for backward compatibility. */
export const mpcpVersionSchema = z.union([
  z.literal(1),
  z.string().regex(/^\d+\.\d+$/),
]);
