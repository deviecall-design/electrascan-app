/**
 * Progress-claim transition.
 *
 * A failed save must leave the milestone exactly as it was. Advancing first
 * and hoping the insert succeeds is what left claims marked invoiced when
 * milestone_claims rejected the row.
 */

export interface ClaimSaveResult {
  ok: boolean;
}

export function milestoneAfterSave<T extends object>(
  current: T,
  save: ClaimSaveResult,
  next: Partial<T>,
): T {
  if (!save.ok) return current;
  return { ...current, ...next };
}
