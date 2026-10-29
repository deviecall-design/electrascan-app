import { describe, expect, it } from "vitest";
import { approvalsHref } from "../lib/approvalsLink";

describe("approvals link", () => {
  it("names the scan and the saved quote", () => {
    expect(approvalsHref("scan-1", "EST-2610-0004")).toBe("/approvals?estimate=EST-2610-0004&scan=scan-1");
  });

  it("opens Approvals for an unsaved takeoff", () => {
    expect(approvalsHref("scan-1", null)).toBe("/approvals?scan=scan-1");
    expect(approvalsHref("new", null)).toBe("/approvals");
  });
});
