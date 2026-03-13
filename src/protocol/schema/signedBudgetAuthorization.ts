import { z } from "zod";
import { budgetAuthorizationSchema } from "./budgetAuthorization.js";

export const signedBudgetAuthorizationSchema = z.strictObject({
  authorization: budgetAuthorizationSchema,
  issuer: z.string().optional(),
  issuerKeyId: z.string(),
  signature: z.string(),
});

export type SignedBudgetAuthorization = z.infer<typeof signedBudgetAuthorizationSchema>;
