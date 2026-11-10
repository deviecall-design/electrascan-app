// List order for /api/beta/records. Each column exists on that table in
// supabase/migrations and on the live project (checked 9 Nov 2026).
// draft_invoices, job_actuals, job_costs, milestone_claims and
// detection_corrections have no updated_at. Ordering by it makes PostgREST
// return HTTP 400 (42703).

export const RECORD_LIST_ORDER = {
  assemblies: "updated_at.desc",
  detection_corrections: "created_at.desc",
  draft_invoices: "created_at.desc",
  job_records: "updated_at.desc",
  contractor_price_lists: "updated_at.desc",
  labour_rate_cards: "updated_at.desc",
  job_actuals: "spent_on.desc",
  job_schedules: "updated_at.desc",
  job_costs: "spent_on.desc",
  milestone_claims: "created_at.desc",
};

export function orderForTable(table) {
  const order = RECORD_LIST_ORDER[table];
  if (!order) throw new Error(`No list order for ${table}`);
  return order;
}
