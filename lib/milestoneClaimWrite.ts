/**
 * Rows written to milestone_claims.
 * tenant_id is the workspace the RLS policies check.
 * owner_id is the signed-in user, stored for audit, and is not a filter.
 */

export interface ClaimActor {
  tenantId: string;
  ownerId: string | null;
}

export function progressClaimInsert(input: {
  projectId: string;
  milestoneId: string;
  milestoneLabel: string;
  amount: number;
  invRef: string;
  status: string;
  tenantId: string;
  ownerId: string | null;
}) {
  return {
    project_id: input.projectId,
    milestone_id: input.milestoneId,
    milestone_label: input.milestoneLabel,
    amount: input.amount,
    inv_ref: input.invRef,
    status: input.status,
    tenant_id: input.tenantId,
    owner_id: input.ownerId,
  };
}

/** Older Reports screen. Its table columns are project_name and milestone. */
export function reportsClaimInsert(input: {
  projectName: string;
  milestone: string;
  amount: number;
  claimedAt: string;
  status: string;
  tenantId: string;
  ownerId: string | null;
}) {
  return {
    project_name: input.projectName,
    milestone: input.milestone,
    milestone_label: input.milestone,
    amount: input.amount,
    claimed_at: input.claimedAt,
    status: input.status,
    tenant_id: input.tenantId,
    owner_id: input.ownerId,
  };
}

export function milestoneClaimPatch(input: {
  status: string;
  invRef?: string | null;
  tenantId: string;
  ownerId: string | null;
}) {
  return {
    status: input.status,
    ...(input.invRef !== undefined ? { inv_ref: input.invRef } : {}),
    tenant_id: input.tenantId,
    owner_id: input.ownerId,
  };
}
