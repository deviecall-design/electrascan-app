/** Persisted on estimates.approval_status. The older status column stays within its check constraint. */
export const APPROVAL_STATUSES = [
  "ready_for_approval",
  "sent_for_signature",
  "approved",
  "materials_sent",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  ready_for_approval: "Ready for approval",
  sent_for_signature: "Sent for signature",
  approved: "Approved / signed",
  materials_sent: "Materials sent",
};

/** Values allowed by estimates.status. materials_sent stays approved there. */
export function estimateStatusFor(approval: ApprovalStatus): "draft" | "sent" | "approved" {
  if (approval === "sent_for_signature") return "sent";
  if (approval === "approved" || approval === "materials_sent") return "approved";
  return "draft";
}

export function approvalFromRow(row: { approval_status?: string | null; status?: string | null }): ApprovalStatus {
  if (row.approval_status && (APPROVAL_STATUSES as readonly string[]).includes(row.approval_status)) {
    return row.approval_status as ApprovalStatus;
  }
  if (row.status === "approved") return "approved";
  if (row.status === "sent" || row.status === "viewed") return "sent_for_signature";
  return "ready_for_approval";
}
