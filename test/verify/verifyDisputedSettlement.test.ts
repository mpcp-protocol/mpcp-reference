import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  verifyDisputedSettlement,
  verifyDisputedSettlementAsync,
} from "../../src/verifier/verifyDisputedSettlement.js";
import { mockAnchorIntentHash } from "../../src/anchor/mockAnchor.js";
import { computeSettlementIntentHash } from "../../src/hash/index.js";
import { bundleToContext, isSettlementBundle } from "../../src/cli/bundle.js";

const __dirname = join(fileURLToPath(import.meta.url), "../..");
const BUNDLE_PATH = join(__dirname, "../examples/parking/settlement-bundle.json");

const SAVED_ENV: Record<string, string | undefined> = {};

function loadBundleAndInjectKeys() {
  const raw = readFileSync(BUNDLE_PATH, "utf-8");
  const data = JSON.parse(raw);
  if (!isSettlementBundle(data)) {
    throw new Error("Expected settlement bundle");
  }
  SAVED_ENV.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
  SAVED_ENV.MPCP_SBA_SIGNING_KEY_ID = process.env.MPCP_SBA_SIGNING_KEY_ID;
  SAVED_ENV.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM;
  SAVED_ENV.MPCP_SPA_SIGNING_KEY_ID = process.env.MPCP_SPA_SIGNING_KEY_ID;
  if (data.sbaPublicKeyPem) {
    process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = data.sbaPublicKeyPem;
    process.env.MPCP_SBA_SIGNING_KEY_ID = (data as { sba: { issuerKeyId: string } }).sba.issuerKeyId;
  }
  if (data.spaPublicKeyPem) {
    process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = data.spaPublicKeyPem;
    process.env.MPCP_SPA_SIGNING_KEY_ID = (data as { spa: { issuerKeyId: string } }).spa.issuerKeyId;
  }
  return data;
}

afterEach(() => {
  for (const [k, v] of Object.entries(SAVED_ENV)) {
    if (v !== undefined) process.env[k] = v;
    else delete process.env[k];
  }
});

describe("verifyDisputedSettlement", () => {
  it("returns verified when settlement passes and no anchor", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const result = verifyDisputedSettlement({ context: ctx });
    expect(result.verified).toBe(true);
  });

  it("returns verified when settlement passes and mock anchor matches", async () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const intent = ctx.settlementIntent;
    if (!intent) throw new Error("Bundle missing settlementIntent");
    const intentHash = computeSettlementIntentHash(intent);
    const anchor = await mockAnchorIntentHash(intentHash);
    const result = verifyDisputedSettlement({ context: ctx, ledgerAnchor: anchor });
    expect(result.verified).toBe(true);
  });

  it("returns invalid when mock anchor does not match intent", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const result = verifyDisputedSettlement({
      context: ctx,
      ledgerAnchor: {
        rail: "mock",
        txHash: "mock-" + "f".repeat(16),
      },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("anchor_mismatch");
  });

  it("returns invalid when anchor provided but settlementIntent missing", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const ctxNoIntent = { ...ctx, settlementIntent: undefined };
    const result = verifyDisputedSettlement({
      context: ctxNoIntent,
      ledgerAnchor: { rail: "mock", txHash: "mock-abcdef1234567890" },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("anchor_provided_but_settlement_intent_missing");
  });

  it("returns invalid when settlement verification fails", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const badContext = {
      ...ctx,
      settlement: { ...ctx.settlement, amount: "99999999" },
    };
    const result = verifyDisputedSettlement({ context: badContext });
    expect(result.verified).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("returns verified when hedera-hcs anchor has matching intentHash", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const intent = ctx.settlementIntent;
    if (!intent) throw new Error("Bundle missing settlementIntent");
    const intentHash = computeSettlementIntentHash(intent);
    const result = verifyDisputedSettlement({
      context: ctx,
      ledgerAnchor: { rail: "hedera-hcs", topicId: "0.0.123", sequenceNumber: "1", intentHash },
    });
    expect(result.verified).toBe(true);
  });

  it("returns invalid when hedera-hcs anchor has mismatched intentHash", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const result = verifyDisputedSettlement({
      context: ctx,
      ledgerAnchor: {
        rail: "hedera-hcs",
        topicId: "0.0.123",
        sequenceNumber: "1",
        intentHash: "f".repeat(64),
      },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("intent_hash_mismatch");
  });

  it("returns invalid when hedera-hcs anchor lacks intentHash (requires async verification)", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const result = verifyDisputedSettlement({
      context: ctx,
      ledgerAnchor: { rail: "hedera-hcs", topicId: "0.0.123", sequenceNumber: "1" },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("hedera_hcs_requires_async_verification");
  });

  it("returns invalid for unsupported anchor rails", () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const result = verifyDisputedSettlement({
      context: ctx,
      ledgerAnchor: { rail: "xrpl", txHash: "abc123" },
    });
    expect(result.verified).toBe(false);
    expect(result.reason).toContain("anchor_rail_not_supported");
  });

  it("verifyDisputedSettlementAsync verifies hedera-hcs anchor without intentHash via mirror", async () => {
    const bundle = loadBundleAndInjectKeys();
    const ctx = bundleToContext(bundle);
    const intent = ctx.settlementIntent;
    if (!intent) throw new Error("Bundle missing settlementIntent");
    const intentHash = computeSettlementIntentHash(intent);
    const messageB64 = Buffer.from(
      JSON.stringify({ intentHash, version: "1.0" }),
      "utf-8",
    ).toString("base64");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: messageB64 }),
      }),
    );

    try {
      const result = await verifyDisputedSettlementAsync({
        context: ctx,
        ledgerAnchor: { rail: "hedera-hcs", topicId: "0.0.123", sequenceNumber: "1" },
      });
      expect(result.verified).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
