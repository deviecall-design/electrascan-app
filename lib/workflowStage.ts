/**
 * The contractor's path through a job.
 * Upload plans, price the estimate, get approval, run the job, then suppliers.
 */

export const WORKFLOW_STAGES = [
  { id: "upload", label: "Upload" },
  { id: "estimate", label: "Estimate" },
  { id: "approval", label: "Approval" },
  { id: "job", label: "Job" },
  { id: "suppliers", label: "Suppliers" },
] as const;

export function workflowStageIndex(input: { approval?: string | null; hasEstimate: boolean }): number {
  const approval = input.approval || "";
  if (approval === "materials_sent") return 4;
  if (approval === "approved") return 3;
  if (approval === "sent_for_signature") return 2;
  if (input.hasEstimate || approval === "ready_for_approval") return 1;
  return 0;
}
