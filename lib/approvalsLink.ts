/** Sign & order opens Approvals. The quote and the scan are both named so Approvals can load the same takeoff. */
export function approvalsHref(scanId?: string | null, reference?: string | null): string {
  const params = new URLSearchParams();
  if (reference) params.set("estimate", reference);
  if (scanId && scanId !== "new") params.set("scan", scanId);
  const query = params.toString();
  return query ? `/approvals?${query}` : "/approvals";
}
