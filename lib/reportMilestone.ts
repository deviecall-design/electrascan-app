/**
 * Milestone claim statuses from the July project reports (Section 9.1).
 * Pending, Ready to Claim, Invoiced (Draft), Invoiced, Received.
 * Retention stays pending until the claim is actually invoiced or paid.
 */

export type ReportClaimStatus = "pending" | "ready" | "invoiced-draft" | "invoiced" | "received";

export const REPORT_STATUS_LABEL: Record<ReportClaimStatus, string> = {
  pending: "Pending",
  ready: "Ready to Claim",
  "invoiced-draft": "Invoiced (Draft)",
  invoiced: "Invoiced",
  received: "Received",
};

export function reportClaimStatus(input: {
  retention?: boolean;
  due?: boolean;
  stored?: string | null;
  hasInvoice?: boolean;
}): ReportClaimStatus {
  const stored = (input.stored || "").toLowerCase().replace(/_/g, "-");
  if (stored === "received" || stored === "paid") return "received";
  if (stored === "invoiced" || input.hasInvoice) return "invoiced";
  if (stored === "draft" || stored === "invoiced-draft") return "invoiced-draft";
  if (input.retention) return "pending";
  if (input.due) return "ready";
  return "pending";
}

export function claimedMilestone(status: ReportClaimStatus): boolean {
  return status === "invoiced-draft" || status === "invoiced" || status === "received";
}

/** The yellow banner only when spend has reached a milestone that is still unclaimed. */
export function milestoneWarning(input: {
  burnPct: number;
  milestones: Array<{ label: string; cumulativePct: number; status: string }>;
}): { label: string; cumulativePct: number } | null {
  const reached = input.milestones.find(row => {
    const claimed = row.status === "received" || row.status === "invoiced" || row.status === "invoiced-draft" || row.status === "paid";
    return row.cumulativePct > 0 && input.burnPct + 0.01 >= row.cumulativePct && !claimed;
  });
  return reached ? { label: reached.label, cumulativePct: reached.cumulativePct } : null;
}

/** The red banner only when unplanned cost exists, or spend has run past the plan. */
export function showOverrunAlert(input: { overrunAmount: number; costToDate: number; plannedToDate: number }): boolean {
  return input.overrunAmount > 0.009 || input.costToDate > input.plannedToDate + 0.009;
}
