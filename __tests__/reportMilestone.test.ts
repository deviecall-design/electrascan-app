import { describe, expect, it } from "vitest";
import { reportClaimStatus } from "../lib/reportMilestone";

describe("report claim status", () => {
  it("follows the July report statuses and holds retention back", () => {
    expect(reportClaimStatus({ due: false })).toBe("pending");
    expect(reportClaimStatus({ due: true })).toBe("ready");
    expect(reportClaimStatus({ due: true, retention: true })).toBe("pending");
    expect(reportClaimStatus({ stored: "draft" })).toBe("invoiced-draft");
    expect(reportClaimStatus({ hasInvoice: true })).toBe("invoiced");
    expect(reportClaimStatus({ stored: "paid", retention: true })).toBe("received");
  });
});
