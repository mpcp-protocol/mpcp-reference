import crypto from "node:crypto";
import type {
  EntryPolicyContext,
  SessionPolicyGrant,
  PaymentPolicyContext,
  PaymentPolicyDecision,
  PolicyReasonCode,
  Rail,
  Asset,
  SettlementResult,
  SettlementQuote,
  EnforcementResult,
} from "./types.js";
import { POLICY_SCHEMA_VERSION } from "./types.js";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isoPlusMinutes(minutes: number, from: Date): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

function pickFirstAllowed<T>(offered: T[], allowlist?: T[]): T | undefined {
  if (allowlist === undefined) return offered[0];
  return offered.find((x) => allowlist.includes(x));
}

function geoInCircle(
  point: { lat: number; lng: number },
  circle: { centerLat: number; centerLng: number; radiusMeters: number },
): boolean {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(circle.centerLat - point.lat);
  const dLng = toRad(circle.centerLng - point.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(point.lat)) * Math.cos(toRad(circle.centerLat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c <= circle.radiusMeters;
}

export function evaluateEntryPolicy(ctx: EntryPolicyContext): SessionPolicyGrant {
  const { policy, nowISO, lotId, railsOffered, assetsOffered } = ctx;
  const reasons: PolicyReasonCode[] = [];
  let requireApproval = false;

  const vendorAllowlist = policy.vendorAllowlist ?? policy.operatorAllowlist;
  if (vendorAllowlist !== undefined) {
    if (!ctx.operatorId || !vendorAllowlist.includes(ctx.operatorId)) {
      return denyEntry(ctx, ["VENDOR_NOT_ALLOWED"]);
    }
  }

  if (policy.lotAllowlist !== undefined && !policy.lotAllowlist.includes(lotId)) {
    return denyEntry(ctx, ["LOT_NOT_ALLOWED"]);
  }

  if (policy.geoAllowlist !== undefined) {
    if (!ctx.geo) return denyEntry(ctx, ["GEO_NOT_ALLOWED"]);
    const inAny = policy.geoAllowlist.some((c) => geoInCircle(ctx.geo!, c));
    if (!inAny) return denyEntry(ctx, ["GEO_NOT_ALLOWED"]);
  }

  if ((ctx.riskScore ?? 0) >= 80) {
    requireApproval = true;
    reasons.push("RISK_HIGH", "NEEDS_APPROVAL");
  }

  const allowedRails =
    policy.railAllowlist !== undefined
      ? railsOffered.filter((r) => policy.railAllowlist!.includes(r))
      : [...railsOffered];
  const allowedAssets =
    policy.assetAllowlist !== undefined
      ? assetsOffered.filter((a) => {
          const key = (x: Asset) =>
            x.kind === "XRP"
              ? "XRP"
              : x.kind === "IOU"
                ? `IOU:${x.currency}:${x.issuer}`
                : `ERC20:${x.chainId}:${x.token}`;
          return policy.assetAllowlist!.some((p) => key(p) === key(a));
        })
      : [...assetsOffered];

  if (allowedRails.length === 0) return denyEntry(ctx, ["RAIL_NOT_ALLOWED"]);
  const hasCryptoRail = allowedRails.some((r) => r === "xrpl" || r === "evm");
  if (hasCryptoRail && allowedAssets.length === 0) return denyEntry(ctx, ["ASSET_NOT_ALLOWED"]);

  if (reasons.length === 0) reasons.push("OK");

  const grantId = crypto.randomUUID();
  const policyHash = sha256(
    JSON.stringify({
      policy,
      lotId,
      actorId: ctx.actorId,
      allowedRails,
      allowedAssets,
      requireApproval,
    }),
  );

  return {
    grantAction: requireApproval ? "REQUIRE_APPROVAL" : "ALLOW",
    grantId,
    policyHash,
    allowedRails,
    allowedAssets,
    maxSpend:
      policy.capPerTxMinor !== undefined ||
      policy.capPerSessionMinor !== undefined ||
      policy.capPerDayMinor !== undefined
        ? {
            perTxMinor: policy.capPerTxMinor,
            perSessionMinor: policy.capPerSessionMinor,
            perDayMinor: policy.capPerDayMinor,
          }
        : undefined,
    expiresAtISO: isoPlusMinutes(60, new Date(nowISO)),
    actorId: ctx.actorId,
    lotId,
    operatorId: ctx.operatorId,
    reasons,
    requireApproval,
  };
}

function denyEntry(ctx: EntryPolicyContext, reasons: PolicyReasonCode[]): SessionPolicyGrant {
  const grantId = crypto.randomUUID();
  const policyHash = sha256(JSON.stringify({ policy: ctx.policy, lotId: ctx.lotId, denied: reasons }));
  return {
    grantAction: "DENY",
    grantId,
    policyHash,
    allowedRails: [],
    allowedAssets: [],
    expiresAtISO: isoPlusMinutes(5, new Date(ctx.nowISO)),
    lotId: ctx.lotId,
    actorId: ctx.actorId,
    operatorId: ctx.operatorId,
    reasons,
  };
}

function getPriceFiatMinor(ctx: PaymentPolicyContext): string {
  if (ctx.priceFiat?.amountMinor != null) return ctx.priceFiat.amountMinor;
  if (ctx.quote?.amountMinor != null) return ctx.quote.amountMinor;
  return "0";
}

function getSpendTotals(ctx: PaymentPolicyContext): { dayTotal: string; sessionTotal: string } {
  if (ctx.spendTotalsFiat) {
    return {
      dayTotal: ctx.spendTotalsFiat.dayTotal?.amountMinor ?? "0",
      sessionTotal: ctx.spendTotalsFiat.sessionTotal?.amountMinor ?? "0",
    };
  }
  if (ctx.spend) {
    return {
      dayTotal: ctx.spend.dayTotalMinor ?? "0",
      sessionTotal: ctx.spend.sessionTotalMinor ?? "0",
    };
  }
  return { dayTotal: "0", sessionTotal: "0" };
}

function getPriceFiatForHash(ctx: PaymentPolicyContext): { amountMinor: string; currency: string } | null {
  if (ctx.priceFiat?.amountMinor != null && ctx.priceFiat.currency) {
    return { amountMinor: ctx.priceFiat.amountMinor, currency: ctx.priceFiat.currency };
  }
  if (ctx.quote?.amountMinor != null) {
    return {
      amountMinor: ctx.quote.amountMinor,
      currency: ctx.quote.currencyId ?? ctx.quote.currency ?? "UNKNOWN",
    };
  }
  return null;
}

function hashPaymentDecisionPayload(
  ctx: PaymentPolicyContext,
  input: {
    action: PaymentPolicyDecision["action"];
    rail?: Rail;
    asset?: Asset;
    expiresAtISO: string;
  },
): string {
  return sha256(
    JSON.stringify({
      schemaVersion: POLICY_SCHEMA_VERSION,
      policy: ctx.policy,
      lotId: ctx.lotId,
      operatorId: ctx.operatorId ?? null,
      actorId: ctx.actorId ?? null,
      sessionGrantId: ctx.sessionGrantId ?? null,
      action: input.action,
      rail: input.rail ?? null,
      asset: input.asset ?? null,
      priceFiat: getPriceFiatForHash(ctx),
      caps: {
        perTxMinor: ctx.policy.capPerTxMinor ?? null,
        perSessionMinor: ctx.policy.capPerSessionMinor ?? null,
        perDayMinor: ctx.policy.capPerDayMinor ?? null,
      },
      expiresAtISO: input.expiresAtISO,
    }),
  );
}

export function evaluatePaymentPolicy(ctx: PaymentPolicyContext): PaymentPolicyDecision {
  const { policy } = ctx;

  if (
    ctx.grantExpiresAtISO &&
    Number.isFinite(Date.parse(ctx.grantExpiresAtISO)) &&
    Date.parse(ctx.grantExpiresAtISO) <= Date.parse(ctx.nowISO)
  ) {
    const reasons: PolicyReasonCode[] = [...(ctx.grantReasons ?? []), "GRANT_EXPIRED", "NEEDS_APPROVAL"];
    return requireApprovalPayment(ctx, [...new Set(reasons)]);
  }

  const vendorAllowlist = policy.vendorAllowlist ?? policy.operatorAllowlist;
  if (vendorAllowlist !== undefined) {
    if (!ctx.operatorId || !vendorAllowlist.includes(ctx.operatorId)) {
      return denyPayment(ctx, ["VENDOR_NOT_ALLOWED"]);
    }
  }

  if (policy.lotAllowlist !== undefined && !policy.lotAllowlist.includes(ctx.lotId)) {
    return denyPayment(ctx, ["LOT_NOT_ALLOWED"]);
  }

  const priceMinor = BigInt(getPriceFiatMinor(ctx));
  const { dayTotal, sessionTotal } = getSpendTotals(ctx);

  if (policy.capPerTxMinor !== undefined && priceMinor > BigInt(policy.capPerTxMinor)) {
    return denyPayment(ctx, ["CAP_EXCEEDED_TX"]);
  }
  if (
    policy.capPerSessionMinor !== undefined &&
    BigInt(sessionTotal) + priceMinor > BigInt(policy.capPerSessionMinor)
  ) {
    return denyPayment(ctx, ["CAP_EXCEEDED_SESSION"]);
  }
  if (policy.capPerDayMinor !== undefined && BigInt(dayTotal) + priceMinor > BigInt(policy.capPerDayMinor)) {
    return denyPayment(ctx, ["CAP_EXCEEDED_DAY"]);
  }

  if (policy.requireApprovalOverMinor !== undefined && priceMinor > BigInt(policy.requireApprovalOverMinor)) {
    return requireApprovalPayment(ctx, ["PRICE_SPIKE", "NEEDS_APPROVAL"]);
  }
  if ((ctx.riskScore ?? 0) >= 80) {
    return requireApprovalPayment(ctx, ["RISK_HIGH", "NEEDS_APPROVAL"]);
  }

  const rail = pickFirstAllowed<Rail>(ctx.railsOffered, policy.railAllowlist);
  if (!rail) return denyPayment(ctx, ["RAIL_NOT_ALLOWED"]);

  let asset: Asset | undefined;
  if (rail !== "stripe" && rail !== "hosted") {
    asset = pickFirstAllowed<Asset>(ctx.assetsOffered, policy.assetAllowlist);
    if (!asset) return denyPayment(ctx, ["ASSET_NOT_ALLOWED"]);
  }

  const expiresAtISO = isoPlusMinutes(5, new Date(ctx.nowISO));
  const decisionId = crypto.randomUUID();
  const policyHash = hashPaymentDecisionPayload(ctx, { action: "ALLOW", rail, asset, expiresAtISO });

  return {
    action: "ALLOW",
    rail,
    asset,
    reasons: ["OK"],
    maxSpend: {
      perTxMinor: policy.capPerTxMinor,
      perSessionMinor: policy.capPerSessionMinor,
      perDayMinor: policy.capPerDayMinor,
    },
    expiresAtISO,
    decisionId,
    policyHash,
    sessionGrantId: ctx.sessionGrantId ?? null,
  };
}

function denyPayment(ctx: PaymentPolicyContext, reasons: PolicyReasonCode[]): PaymentPolicyDecision {
  const expiresAtISO = isoPlusMinutes(5, new Date(ctx.nowISO));
  const decisionId = crypto.randomUUID();
  const policyHash = hashPaymentDecisionPayload(ctx, { action: "DENY", expiresAtISO });
  return {
    action: "DENY",
    reasons,
    expiresAtISO,
    decisionId,
    policyHash,
    sessionGrantId: ctx.sessionGrantId ?? null,
  };
}

function requireApprovalPayment(ctx: PaymentPolicyContext, reasons: PolicyReasonCode[]): PaymentPolicyDecision {
  const expiresAtISO = isoPlusMinutes(5, new Date(ctx.nowISO));
  const decisionId = crypto.randomUUID();
  const policyHash = hashPaymentDecisionPayload(ctx, { action: "REQUIRE_APPROVAL", expiresAtISO });
  return {
    action: "REQUIRE_APPROVAL",
    reasons,
    expiresAtISO,
    decisionId,
    policyHash,
    sessionGrantId: ctx.sessionGrantId ?? null,
  };
}

function assetEqual(a: Asset, b: Asset): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "XRP") return true;
  if (a.kind === "IOU" && b.kind === "IOU") return a.currency === b.currency && a.issuer === b.issuer;
  if (a.kind === "ERC20" && b.kind === "ERC20") return a.chainId === b.chainId && a.token === b.token;
  return false;
}

function enforcementNowMs(settlement: SettlementResult): number {
  if (settlement.nowISO) {
    const parsed = Date.parse(settlement.nowISO);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function findMatchingQuote(decision: PaymentPolicyDecision, settlement: SettlementResult): SettlementQuote | undefined {
  const quotes = decision.settlementQuotes;
  if (!quotes?.length) return undefined;
  if (settlement.quoteId) {
    return quotes.find((q) => q.quoteId === settlement.quoteId && q.rail === settlement.rail);
  }
  return quotes.find(
    (q) =>
      q.rail === settlement.rail &&
      (settlement.rail === "stripe" ||
        settlement.rail === "hosted" ||
        (q.asset && assetEqual(q.asset, settlement.asset))),
  );
}

export function enforcePayment(decision: PaymentPolicyDecision, settlement: SettlementResult): EnforcementResult {
  if (!decision.decisionId) return { allowed: false, reason: "NEEDS_APPROVAL" };
  if (decision.action !== "ALLOW") return { allowed: false, reason: decision.reasons[0] ?? "NEEDS_APPROVAL" };
  if (Date.parse(decision.expiresAtISO) <= enforcementNowMs(settlement)) {
    return { allowed: false, reason: "NEEDS_APPROVAL" };
  }
  if (
    settlement.expectedSessionGrantId != null &&
    settlement.expectedSessionGrantId.length > 0 &&
    decision.sessionGrantId !== settlement.expectedSessionGrantId
  ) {
    return { allowed: false, reason: "NEEDS_APPROVAL" };
  }
  if (
    settlement.expectedPolicyHash != null &&
    settlement.expectedPolicyHash.length > 0 &&
    decision.policyHash !== settlement.expectedPolicyHash
  ) {
    return { allowed: false, reason: "POLICY_HASH_MISMATCH" };
  }
  if (decision.rail !== settlement.rail) return { allowed: false, reason: "RAIL_NOT_ALLOWED" };

  const quote = findMatchingQuote(decision, settlement);
  const hasQuotes = Boolean(decision.settlementQuotes?.length);
  if (hasQuotes && !quote) return { allowed: false, reason: "QUOTE_NOT_FOUND" };

  if (quote) {
    const amountOk = BigInt(settlement.amount) === BigInt(quote.amount.amount);
    if (!amountOk) return { allowed: false, reason: "QUOTE_AMOUNT_MISMATCH" };
    if (quote.destination) {
      if (!settlement.destination || settlement.destination !== quote.destination) {
        return { allowed: false, reason: "DESTINATION_MISMATCH" };
      }
    }
    if (decision.rail !== "stripe" && decision.rail !== "hosted") {
      if (!quote.asset || !assetEqual(quote.asset, settlement.asset)) {
        return { allowed: false, reason: "ASSET_NOT_ALLOWED" };
      }
    }
    return { allowed: true };
  }

  if (decision.rail !== "stripe" && decision.rail !== "hosted") {
    if (!decision.asset || !assetEqual(decision.asset, settlement.asset)) {
      return { allowed: false, reason: "ASSET_NOT_ALLOWED" };
    }
  }

  const amountMinor = BigInt(settlement.amount);
  const capTx = decision.maxSpend?.perTxMinor;
  if (capTx !== undefined && amountMinor > BigInt(capTx)) {
    return { allowed: false, reason: "CAP_EXCEEDED_TX" };
  }
  return { allowed: true };
}

export function evaluatePolicy(ctx: PaymentPolicyContext): PaymentPolicyDecision {
  return evaluatePaymentPolicy(ctx);
}
