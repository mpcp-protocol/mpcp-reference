#!/usr/bin/env node
/**
 * PR8C — Fleet Spend Policy Simulator
 *
 * SBA policy simulator: builds an SBA from fleet policy inputs and tests
 * payment decisions against it via verifySignedBudgetAuthorization.
 *
 * Run: npm run build && npm run example:simulate
 * Or:  node examples/machine-commerce/simulate.mjs [policy.json] [scenarios.json]
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = __dirname;

const policyPath = process.argv[2] ?? join(EXAMPLE_DIR, "fleet-policy.json");
const scenariosPath = process.argv[3] ?? join(EXAMPLE_DIR, "scenarios.json");

const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const scenarios = JSON.parse(readFileSync(scenariosPath, "utf8"));

const policyHash = "sim-policy-hash-" + crypto.randomUUID().slice(0, 8);
const EXPIRY = policy.expiresAt ?? "2030-12-31T23:59:59Z";

const sbaKeys = crypto.generateKeyPairSync("ed25519");
process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";

const {
  createSignedBudgetAuthorization,
  verifySignedBudgetAuthorization,
} = await import("../../dist/sdk/index.js");

const sba = createSignedBudgetAuthorization({
  sessionId: "sim-session-001",
  vehicleId: "sim-vehicle-001",
  policyHash,
  currency: "USD",
  maxAmountMinor: policy.maxSessionSpendMinor ?? String(policy.maxSessionSpend * 100),
  allowedRails: policy.allowedRails ?? ["xrpl"],
  allowedAssets: policy.allowedAssets ?? [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  destinationAllowlist: policy.destinations ?? [],
  expiresAt: EXPIRY,
});

if (!sba) throw new Error("Failed to create SBA");

function log(msg) {
  console.log(msg);
}

const rail = (policy.allowedRails ?? ["xrpl"])[0];
const defaultAsset = { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" };
const asset = (policy.allowedAssets ?? [defaultAsset])[0];

log("");
log("MPCP Fleet Spend Policy Simulator");
log("=========================================");
log("");
log("Policy:");
log(`  maxSessionSpend: $${policy.maxSessionSpend ?? Number(policy.maxSessionSpendMinor) / 100}`);
log(`  allowedRails: ${(policy.allowedRails ?? ["xrpl"]).join(", ")}`);
log(`  allowedAssets: ${asset.kind === "IOU" ? asset.currency : JSON.stringify(asset)}`);
log(`  destinations: ${(policy.destinations ?? []).join(", ")}`);
log("");
log("Scenarios:");
log("");

const nowISO = new Date(Date.now() + 60_000).toISOString();
let allowedCount = 0;

for (const scenario of scenarios) {
  const amountMinor =
    scenario.amountMinor ??
    String(Math.round(Number(String(scenario.amountUsd ?? "0").replace(/[^0-9.]/g, "")) * 100));
  if (amountMinor === "NaN" || Number.isNaN(Number(amountMinor))) {
    throw new Error(`Invalid amount for scenario ${scenario.id}: need amountMinor or parseable amountUsd`);
  }
  const destination = scenario.destination ?? "rUnknown";
  const amountRail = String(Number(amountMinor) * 1_000_000);

  const decision = {
    decisionId: `dec-${scenario.id}`,
    policyHash,
    action: "ALLOW",
    reasons: ["OK"],
    expiresAtISO: nowISO,
    rail,
    asset,
    priceFiat: { amountMinor, currency: "USD" },
    chosen: { rail, quoteId: `q-${scenario.id}` },
    settlementQuotes: [
      {
        quoteId: `q-${scenario.id}`,
        rail,
        amount: { amount: amountRail, decimals: 6 },
        destination,
        expiresAt: nowISO,
        asset,
      },
    ],
  };

  const result = verifySignedBudgetAuthorization(sba, {
    sessionId: sba.authorization.sessionId,
    decision,
    nowMs: Date.now(),
  });

  const allowed = result.ok === true;
  const reason = result.ok === false ? result.reason : null;
  if (allowed) allowedCount++;

  const status = allowed ? "✓ ALLOW" : "✗ REJECT";
  const reasonStr = reason ? ` (${reason})` : "";
  log(`  ${scenario.id}: ${scenario.amountUsd ?? "$" + (Number(amountMinor) / 100).toFixed(2)} → ${destination}  ${status}${reasonStr}`);
  log(`    ${scenario.description ?? ""}`);
  if (!allowed && reason) {
    if (reason === "budget_exceeded") log(`    → Amount exceeds session max ($${policy.maxSessionSpend ?? Number(policy.maxSessionSpendMinor) / 100})`);
    else if (reason === "mismatch") log(`    → Destination not in allowlist or rail/asset mismatch`);
  }
  log("");
}

log("Summary:");
log(`  Policy: $${policy.maxSessionSpend ?? Number(policy.maxSessionSpendMinor) / 100} max session, ${(policy.destinations ?? []).length} allowed destinations`);
log(`  Allowed: ${allowedCount} / ${scenarios.length}`);
log("");

process.exit(0);
