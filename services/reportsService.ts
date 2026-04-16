import { supabase } from './supabaseClient';

// Reports persistence — lightweight hooks for timesheet submissions and
// milestone claim events. The bulk of the Reports screen is read-only
// display using project-level budget data that will eventually live in a
// `project_financials` table; for now the UI derives everything from the
// mock constants embedded in the component.
//
// TODO(supabase-schema): Create tables when the financial reporting
// feature moves beyond mock data:
//   - timesheets (id, project_id, week_label, planned, actual, labour, materials, submitted_at)
//   - milestone_claims (id, project_id, milestone_label, amount, claimed_at, status)
//   - accounting_connections (id, platform, status, last_sync, company_file)

export async function submitTimesheet(entry: {
  projectName: string;
  week: string;
  planned: number;
  actual: number;
  labour: number;
  materials: number;
}) {
  try {
    const { error } = await supabase.from('timesheets').insert([{
      ...entry, submitted_at: new Date().toISOString(),
    }]);
    if (error) {
      console.warn('[reportsService] timesheet insert skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[reportsService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function submitMilestoneClaim(entry: {
  projectName: string;
  milestone: string;
  amount: number;
}) {
  try {
    const { error } = await supabase.from('milestone_claims').insert([{
      ...entry, claimed_at: new Date().toISOString(), status: 'claimed',
    }]);
    if (error) {
      console.warn('[reportsService] claim insert skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[reportsService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}
