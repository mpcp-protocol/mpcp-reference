import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { isSettlementBundle, bundleToContext } from "../../src/cli/bundle.js";
import { verifySettlement } from "../../src/verify/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTORS_DIR = join(__dirname, "../../vectors");

interface VectorManifestEntry {
  id: string;
  file: string;
  expect: "valid" | "invalid";
  reason?: string;
  artifact?: string;
  description?: string;
}

interface Manifest {
  version: string;
  description?: string;
  vectors: VectorManifestEntry[];
}

const SBA_ENV = {
  privateKey: process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SBA_SIGNING_KEY_ID,
};
const SPA_ENV = {
  privateKey: process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SPA_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = SBA_ENV.privateKey;
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = SBA_ENV.publicKey;
  process.env.MPCP_SBA_SIGNING_KEY_ID = SBA_ENV.keyId;
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = SPA_ENV.privateKey;
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = SPA_ENV.publicKey;
  process.env.MPCP_SPA_SIGNING_KEY_ID = SPA_ENV.keyId;
});

function injectBundleKeys(bundle: Record<string, unknown>) {
  const sba = bundle.sba as { keyId?: string } | undefined;
  const spa = bundle.spa as { keyId?: string } | undefined;
  if (bundle.sbaPublicKeyPem && typeof bundle.sbaPublicKeyPem === "string") {
    process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = bundle.sbaPublicKeyPem as string;
    if (sba?.keyId) process.env.MPCP_SBA_SIGNING_KEY_ID = sba.keyId;
  }
  if (bundle.spaPublicKeyPem && typeof bundle.spaPublicKeyPem === "string") {
    process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = bundle.spaPublicKeyPem as string;
    if (spa?.keyId) process.env.MPCP_SPA_SIGNING_KEY_ID = spa.keyId;
  }
}

function parseSettlementNowMs(settlement: { nowISO?: string }): number | undefined {
  const nowISO = settlement?.nowISO;
  if (!nowISO || typeof nowISO !== "string") return undefined;
  const ms = Date.parse(nowISO);
  return Number.isFinite(ms) ? ms : undefined;
}

describe("Golden Protocol Vectors", () => {
  const manifestPath = join(VECTORS_DIR, "manifest.json");
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  for (const entry of manifest.vectors) {
    it(`${entry.id}: ${entry.description ?? entry.expect}`, () => {
      const bundlePath = join(VECTORS_DIR, entry.file);
      const raw = JSON.parse(readFileSync(bundlePath, "utf-8"));

      if (!isSettlementBundle(raw)) {
        throw new Error(`Vector ${entry.id}: not a valid settlement bundle`);
      }

      injectBundleKeys(raw);

      const ctx = bundleToContext(raw);
      const nowMs = parseSettlementNowMs(raw.settlement);
      if (nowMs !== undefined) {
        (ctx as { nowMs?: number }).nowMs = nowMs;
      }

      const result = verifySettlement(ctx);

      if (entry.expect === "valid") {
        expect(result).toEqual({ valid: true });
      } else {
        expect(result.valid).toBe(false);
        if (result.valid === false) {
          if (entry.reason) {
            expect(result.reason).toBe(entry.reason);
          }
          if (entry.artifact) {
            expect(result.artifact).toBe(entry.artifact);
          }
        }
      }
    });
  }
});
