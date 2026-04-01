import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SettlementVerificationContext } from "../verifier/types.js";
import {
  verifySettlementDetailedSafe,
  verifySettlementWithReportSafe,
} from "../verifier/index.js";
import { formatVerificationReport } from "./formatReport.js";
import { formatExplainOutput } from "./formatExplain.js";
import { isSettlementBundle, bundleToContext } from "./bundle.js";

function appendAuditLog(
  logPath: string | undefined,
  filePath: string,
  result: { valid: boolean; reason?: string; artifact?: string },
  resolvedPath: string,
): void {
  if (!logPath) return;
  try {
    const resolvedLog = resolve(process.cwd(), logPath);
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      event: "settlement_verification",
      file: filePath,
      resolvedPath,
      valid: result.valid,
    };
    if (!result.valid && result.reason) entry.reason = result.reason;
    if (!result.valid && result.artifact) entry.artifact = result.artifact;
    appendFileSync(resolvedLog, JSON.stringify(entry) + "\n");
  } catch {
    /* ignore audit log write errors */
  }
}

export interface VerifyOptions {
  explain?: boolean;
  json?: boolean;
  /** Append verification result to audit log (JSONL file). */
  appendLog?: string;
}

export function runVerify(
  filePath: string,
  options: VerifyOptions = {},
): { ok: boolean; output: string } {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: `Error: cannot read file ${filePath}: ${msg}` };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: `Error: invalid JSON in ${filePath}: ${msg}` };
  }

  // Inject bundle public keys into env so verification can proceed without env config.
  // Save and restore to avoid mutating caller's process.env.
  const saved: Record<string, string | undefined> = {};
  if (isSettlementBundle(data)) {
    if (data.sbaPublicKeyPem) {
      saved.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
      saved.MPCP_SBA_SIGNING_KEY_ID = process.env.MPCP_SBA_SIGNING_KEY_ID;
      process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = data.sbaPublicKeyPem;
      process.env.MPCP_SBA_SIGNING_KEY_ID = data.sba.issuerKeyId;
    }
  }

  try {
    const ctx: SettlementVerificationContext = isSettlementBundle(data)
      ? bundleToContext(data)
      : (data as SettlementVerificationContext);

    if (options.explain || options.json) {
      const detailedReport = verifySettlementDetailedSafe(ctx);
      const failedCheck = !detailedReport.valid
        ? detailedReport.checks?.find((c) => !c.valid)
        : undefined;
      appendAuditLog(options.appendLog, filePath, {
        valid: detailedReport.valid,
        reason: failedCheck?.reason,
        artifact: failedCheck?.artifact,
      }, resolve(process.cwd(), filePath));
      if (options.json) {
        return { ok: detailedReport.valid, output: JSON.stringify(detailedReport, null, 2) };
      }
      return { ok: detailedReport.valid, output: formatExplainOutput(detailedReport) };
    }

    const reportWithSteps = verifySettlementWithReportSafe(ctx);
    const r = reportWithSteps.result;
    appendAuditLog(options.appendLog, filePath, {
      valid: r.valid,
      reason: !r.valid ? r.reason : undefined,
      artifact: !r.valid ? r.artifact : undefined,
    }, resolve(process.cwd(), filePath));
    return {
      ok: reportWithSteps.result.valid,
      output: formatVerificationReport(reportWithSteps),
    };
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
  }
}
