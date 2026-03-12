import type { DetailedVerificationReport } from "../verifier/types.js";

const CHECK = "✔";
const CROSS = "✗";

export function formatExplainOutput(report: DetailedVerificationReport): string {
  const lines: string[] = ["MPCP Verification Report", ""];

  // checks are pre-sorted by verification phase in runVerificationPipeline()
  for (const c of report.checks) {
    const icon = c.valid ? CHECK : CROSS;
    const msg = c.valid ? c.name : `${c.name}${c.reason ? ` ${c.reason}` : ""}`;
    lines.push(`${icon} ${msg}`);
    if (!c.valid && c.expected !== undefined && c.actual !== undefined) {
      lines.push(`  Expected: ${String(c.expected)}`);
      lines.push(`  Actual:   ${String(c.actual)}`);
    }
  }

  lines.push("");
  lines.push(report.valid ? "Verification PASSED" : "Verification FAILED");
  return lines.join("\n");
}
