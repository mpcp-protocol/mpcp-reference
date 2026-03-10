import type { z } from "zod";

export type ValidateResult<T> = { ok: true; data: T } | { ok: false; error: string; details?: z.ZodError };

export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
): ValidateResult<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const err = result.error;
  const flattened = err.flatten();
  const firstError = err.errors[0];
  const path = firstError?.path?.length ? firstError.path.join(".") : "";
  const msg = firstError?.message ?? err.message;
  const errorStr = path ? `${path}: ${msg}` : msg;
  return { ok: false, error: errorStr, details: err };
}
