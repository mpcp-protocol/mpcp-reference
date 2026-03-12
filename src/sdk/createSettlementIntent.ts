import type { Asset } from "../policy-core/types.js";

export interface SettlementIntent {
  version: "1.0";
  rail: string;
  amount: string;
  destination?: string;
  asset?: Asset;
  referenceId?: string;
  createdAt: string;
}

export interface CreateSettlementIntentInput {
  rail: string;
  amount: string;
  destination?: string;
  asset?: Asset;
  referenceId?: string;
  /** Optional. Defaults to new Date().toISOString(). Use fixed value for deterministic examples. */
  createdAt?: string;
}

/**
 * Create a settlement intent artifact.
 * Compatible with computeSettlementIntentHash and verification.
 *
 * @param input - Intent parameters
 * @returns Settlement intent
 */
export function createSettlementIntent(input: CreateSettlementIntentInput): SettlementIntent {
  return {
    version: "1.0",
    rail: input.rail,
    amount: input.amount,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.asset ? { asset: input.asset } : {}),
    ...(input.referenceId ? { referenceId: input.referenceId } : {}),
  };
}
