/**
 * Format a verification report for CLI output.
 * Internal identifiers (artifact-style) → human-readable display.
 */

import type { VerificationReport, VerificationStep } from "../verifier/types.js";

const CHECK = "✔";
const CROSS = "✗";

/** Reverse execution order for chain display: leaf (intent) → root (grant). */
const CHAIN_ORDER = [
  "SettlementIntent.intentHash",
  "SignedPaymentAuthorization.valid",
  "SignedBudgetAuthorization.valid",
  "PolicyGrant.valid",
];

function orderSteps(steps: VerificationStep[]): VerificationStep[] {
  const ordered: VerificationStep[] = [];
  for (const id of CHAIN_ORDER) {
    const step = steps.find((s) => s.name === id);
    if (step) ordered.push(step);
  }
  return ordered;
}

export function formatVerificationReport(report: VerificationReport): string {
  const lines: string[] = [];
  const ordered = orderSteps(report.steps);

  for (const step of ordered) {
    const icon = step.ok ? CHECK : CROSS;
    const msg = step.ok ? step.name : `${step.name}: ${step.reason ?? "failed"}`;
    lines.push(`${icon} ${msg}`);
  }

  if (ordered.length > 0) lines.push("");

  if (report.result.valid) {
    lines.push("MPCP verification PASSED");
  } else {
    lines.push(`MPCP verification FAILED: ${report.result.reason}`);
  }

  return lines.join("\n");
}
