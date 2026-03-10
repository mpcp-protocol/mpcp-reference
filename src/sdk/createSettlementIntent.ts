import type { Asset } from "../policy-core/types.js";

export interface SettlementIntent {
  rail: string;
  amount: string;
  destination?: string;
  asset?: Asset;
  referenceId?: string;
  version?: 1 | string;
  createdAt?: string;
}

export interface CreateSettlementIntentInput {
  rail: string;
  amount: string;
  destination?: string;
  asset?: Asset;
  referenceId?: string;
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
    rail: input.rail,
    amount: input.amount,
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.asset ? { asset: input.asset } : {}),
    ...(input.referenceId ? { referenceId: input.referenceId } : {}),
  };
}
