import { describe, expect, it } from "vitest";
import { milestoneAfterSave } from "../lib/progressClaim";

describe("milestoneAfterSave", () => {
  const pending = { id: "rough-in", status: "pending", invRef: null as string | null };

  it("leaves the milestone unchanged when the save fails", () => {
    const next = milestoneAfterSave(pending, { ok: false }, { status: "invoiced_draft", invRef: "INV-1" });
    expect(next).toBe(pending);
    expect(next.status).toBe("pending");
    expect(next.invRef).toBeNull();
  });

  it("advances the milestone only after a successful save", () => {
    const next = milestoneAfterSave(pending, { ok: true }, { status: "invoiced_draft", invRef: "INV-1" });
    expect(next.status).toBe("invoiced_draft");
    expect(next.invRef).toBe("INV-1");
  });
});
