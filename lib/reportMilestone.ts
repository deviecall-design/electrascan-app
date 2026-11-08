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
