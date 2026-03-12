import { describe, expect, it } from "vitest";
import { formatVerificationReport } from "../../src/cli/formatReport.js";
import type { VerificationReport } from "../../src/verifier/types.js";

describe("formatVerificationReport", () => {
  it("formats success with full chain in display order", () => {
    const report: VerificationReport = {
      result: { valid: true },
      steps: [
        { name: "PolicyGrant.valid", ok: true },
        { name: "SignedBudgetAuthorization.valid", ok: true },
        { name: "SignedPaymentAuthorization.valid", ok: true },
        { name: "SettlementIntent.intentHash", ok: true },
      ],
    };
    const out = formatVerificationReport(report);
    expect(out).toContain("✔ SettlementIntent.intentHash");
    expect(out).toContain("✔ SignedPaymentAuthorization.valid");
    expect(out).toContain("✔ SignedBudgetAuthorization.valid");
    expect(out).toContain("✔ PolicyGrant.valid");
    expect(out).toContain("MPCP verification PASSED");
  });

  it("formats success without intent step", () => {
    const report: VerificationReport = {
      result: { valid: true },
      steps: [
        { name: "PolicyGrant.valid", ok: true },
        { name: "SignedBudgetAuthorization.valid", ok: true },
        { name: "SignedPaymentAuthorization.valid", ok: true },
      ],
    };
    const out = formatVerificationReport(report);
    expect(out).toContain("✔ PolicyGrant.valid");
    expect(out).toContain("✔ SignedBudgetAuthorization.valid");
    expect(out).toContain("✔ SignedPaymentAuthorization.valid");
    expect(out).not.toContain("SettlementIntent");
    expect(out).toContain("MPCP verification PASSED");
  });

  it("formats failure with failing step", () => {
    const report: VerificationReport = {
      result: { valid: false, reason: "policy_grant_expired", artifact: "policyGrant" },
      steps: [{ name: "PolicyGrant.valid", ok: false, reason: "policy_grant_expired" }],
    };
    const out = formatVerificationReport(report);
    expect(out).toContain("✗ PolicyGrant.valid");
    expect(out).toContain("policy_grant_expired");
    expect(out).toContain("MPCP verification FAILED");
  });
});
