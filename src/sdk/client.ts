import type { PolicyGrant, SignedBudgetAuthorization } from "../protocol/types.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";
import type {
  Asset,
  Policy,
  Rail,
  PaymentPolicyDecision,
  SettlementResult,
} from "../policy-core/types.js";

import type { VerificationResult } from "../verifier/types.js";
export type { VerificationResult };

/** Rail-specific settlement intent. Use Record<string, unknown> for custom shapes. */
export type SettlementIntent = Record<string, unknown>;

export interface MPCPClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface GrantRequest {
  policy: Policy;
  lotId: string;
  vehicleId?: string;
  operatorId?: string;
  railsOffered: Rail[];
  assetsOffered: Asset[];
  nowISO?: string;
}

export interface BudgetRequest {
  sessionId: string;
  vehicleId: string;
  grantId: string;
  policyHash: string;
  maxAmountMinor: string;
  allowedRails: Rail[];
  allowedAssets: Asset[];
  destinationAllowlist: string[];
  expiresAt: string;
}

export interface AuthorizeRequest {
  sessionId: string;
  decision: PaymentPolicyDecision;
  settlementIntent?: SettlementIntent;
}

export interface VerifySettlementRequest {
  decisionId: string;
  settlement: SettlementResult;
  spa: SignedPaymentAuthorization;
  settlementIntent?: SettlementIntent;
}

export interface MPCPError extends Error {
  status?: number;
  body?: unknown;
}

/**
 * Tiny HTTP client for the MPCP Service.
 * Wraps /grant, /budget, /authorize, /verify-settlement, /intent/hash.
 */
export class MPCPClient {
  constructor(private readonly config: MPCPClientConfig) {}

  private async fetch<TBody = unknown>(
    path: string,
    init: Omit<RequestInit, "body"> & { body?: TBody } = {},
  ): Promise<Response> {
    const { body, ...rest } = init;
    const url = `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }
    const res = await fetch(url, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  private async json<T>(path: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
    const res = await this.fetch(path, init);
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      const err = new Error(data?.error ?? `MPCP API error: ${res.status}`) as MPCPError;
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data as T;
  }

  async createGrant(input: GrantRequest): Promise<PolicyGrant> {
    return this.json<PolicyGrant>("/grant", { method: "POST", body: input });
  }

  async createBudget(input: BudgetRequest): Promise<SignedBudgetAuthorization> {
    return this.json<SignedBudgetAuthorization>("/budget", { method: "POST", body: input });
  }

  async createAuthorization(input: AuthorizeRequest): Promise<SignedPaymentAuthorization> {
    return this.json<SignedPaymentAuthorization>("/authorize", { method: "POST", body: input });
  }

  async verifySettlement(input: VerifySettlementRequest): Promise<VerificationResult> {
    return this.json<VerificationResult>("/verify-settlement", {
      method: "POST",
      body: input,
    });
  }

  async computeIntentHash(intent: SettlementIntent): Promise<{ intentHash: string; canonicalIntent: object }> {
    return this.json<{ intentHash: string; canonicalIntent: object }>("/intent/hash", {
      method: "POST",
      body: { intent },
    });
  }
}
