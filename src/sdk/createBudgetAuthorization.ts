import { randomUUID } from "node:crypto";
import type { Asset } from "../policy-core/types.js";
import type { BudgetScope } from "../protocol/sba.js";

export interface BudgetAuthorization {
  version: "1.0";
  budgetId: string;
  grantId: string;
  sessionId: string;
  actorId: string;
  scopeId?: string;
  policyHash: string;
  currency: string;
  minorUnit: number;
  budgetScope: BudgetScope;
  maxAmountMinor: string;
  allowedRails: string[];
  allowedAssets: Asset[];
  destinationAllowlist: string[];
  expiresAt: string;
}

export interface CreateBudgetAuthorizationInput {
  sessionId: string;
  actorId: string;
  grantId: string;
  policyHash: string;
  currency: string;
  maxAmountMinor: string;
  allowedRails: string[];
  allowedAssets: Asset[];
  destinationAllowlist: string[];
  expiresAt: string;
  budgetId?: string;
  scopeId?: string;
  minorUnit?: number;
  budgetScope?: BudgetScope;
}

/**
 * Create an unsigned budget authorization artifact.
 * Use createSignedBudgetAuthorization to produce a signed envelope.
 *
 * @param input - Budget parameters
 * @returns Unsigned budget authorization
 */
export function createBudgetAuthorization(input: CreateBudgetAuthorizationInput): BudgetAuthorization {
  return {
    version: "1.0",
    budgetId: input.budgetId ?? randomUUID(),
    grantId: input.grantId,
    sessionId: input.sessionId,
    actorId: input.actorId,
    ...(input.scopeId ? { scopeId: input.scopeId } : {}),
    policyHash: input.policyHash,
    currency: input.currency,
    minorUnit: input.minorUnit ?? 2,
    budgetScope: input.budgetScope ?? "SESSION",
    maxAmountMinor: input.maxAmountMinor,
    allowedRails: input.allowedRails ?? [],
    allowedAssets: input.allowedAssets ?? [],
    destinationAllowlist: input.destinationAllowlist ?? [],
    expiresAt: input.expiresAt,
  };
}
