import { describe, expect, it } from "vitest";
import { approvalFromRow, estimateStatusFor } from "../lib/approvalStatus";

describe("approval status", () => {
  it("lands a new or draft quote in Ready for approval", () => {
    expect(approvalFromRow({ status: "draft" })).toBe("ready_for_approval");
    expect(estimateStatusFor("ready_for_approval")).toBe("draft");
  });

  it("keeps later stages distinct from the older status check", () => {
    expect(approvalFromRow({ approval_status: "materials_sent", status: "approved" })).toBe("materials_sent");
    expect(estimateStatusFor("materials_sent")).toBe("approved");
    expect(estimateStatusFor("sent_for_signature")).toBe("sent");
  });
});
