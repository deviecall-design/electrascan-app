import { describe, expect, it } from "vitest";
import { workflowStageIndex } from "../lib/workflowStage";

describe("workflow stage", () => {
  it("walks upload, estimate, approval, job, then suppliers", () => {
    expect(workflowStageIndex({ hasEstimate: false })).toBe(0);
    expect(workflowStageIndex({ hasEstimate: true, approval: "ready_for_approval" })).toBe(1);
    expect(workflowStageIndex({ hasEstimate: true, approval: "sent_for_signature" })).toBe(2);
    expect(workflowStageIndex({ hasEstimate: true, approval: "approved" })).toBe(3);
    expect(workflowStageIndex({ hasEstimate: true, approval: "materials_sent" })).toBe(4);
  });
});
