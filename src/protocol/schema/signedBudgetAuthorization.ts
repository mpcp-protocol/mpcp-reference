import { z } from "zod";
import { budgetAuthorizationSchema } from "./budgetAuthorization.js";

export const signedBudgetAuthorizationSchema = z.strictObject({
  authorization: budgetAuthorizationSchema,
  signature: z.string(),
  keyId: z.string(),
});

export type SignedBudgetAuthorization = z.infer<typeof signedBudgetAuthorizationSchema>;
