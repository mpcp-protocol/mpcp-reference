#!/usr/bin/env node

/**
 * MPCP Verifier CLI
 *
 * Usage: mpcp verify <settlement.json>
 *
 * Reads a JSON file with SettlementVerificationContext and prints the verification chain.
 */

import { runVerify } from "./verify.js";
import { runPolicySummary } from "./policySummary.js";

const HELP = `Usage:
  mpcp verify <settlement-file> [options]
  mpcp policy-summary <policy-file> [--profile <name>]

Commands:
  verify           Verify settlement bundle
  policy-summary   Print fleet policy constraints (max spend, rails, destinations); optional --profile validates against a reference profile

Verify options:
  --explain      Step-by-step diagnostics (schema checks, expected/actual)
  --json         Machine-readable JSON output
  --append-log <file>   Append verification result to JSONL audit log

Accepts:
  - Full SettlementVerificationContext (policyGrant, signedBudgetAuthorization, etc.)
  - JSON artifact bundle: settlement, intent, spa, sba, policyGrant

Examples:
  mpcp verify examples/parking/settlement-bundle.json
  mpcp verify settlement.json --explain
  mpcp verify settlement.json --append-log audit.jsonl
  mpcp policy-summary examples/machine-commerce/fleet-policy.json
  mpcp policy-summary profiles/parking.json --profile parking
`;

function main(): number {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(HELP);
    return 0;
  }

  if (cmd === "policy-summary") {
    const filePath = args[1];
    if (!filePath) {
      process.stderr.write("Error: missing policy file path\n");
      process.stderr.write("Usage: mpcp policy-summary <policy-file> [--profile <name>]\n");
      return 1;
    }
    const profileIdx = args.indexOf("--profile");
    const profile = profileIdx >= 0 && args[profileIdx + 1] ? args[profileIdx + 1] : undefined;
    return runPolicySummary(filePath, { profile });
  }

  if (cmd !== "verify") {
    process.stderr.write(`Unknown command: ${cmd}\n`);
    process.stdout.write(HELP);
    return 1;
  }

  const rest = args.slice(1);
  const explain = rest.includes("--explain");
  const json = rest.includes("--json");
  const appendLogIdx = rest.indexOf("--append-log");
  const appendLog = appendLogIdx >= 0 && rest[appendLogIdx + 1] ? rest[appendLogIdx + 1] : undefined;
  const filePath = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1] === "--append-log"))[0];

  if (!filePath) {
    process.stderr.write("Error: missing file path\n");
    process.stderr.write(`Usage: mpcp verify <file>\n`);
    return 1;
  }

  const { ok, output } = runVerify(filePath, { explain, json, appendLog });

  process.stdout.write(output);
  process.stdout.write("\n");
  return ok ? 0 : 1;
}


process.exitCode = main();
