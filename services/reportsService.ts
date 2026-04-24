import { supabase } from './supabaseClient';

// Reports persistence — lightweight hooks for timesheet submissions and
// milestone claim events. The bulk of the Reports screen is read-only
// display using project-level budget data that will eventually live in a
// `project_financials` table; for now the UI derives everything from the
// mock constants embedded in the component.
//
// TODO(supabase-schema): Create tables when the financial reporting
// feature moves beyond mock data:
//   - timesheets (id, project_name, week, planned, actual, labour, materials, submitted_at, owner_id)
//   - milestone_claims (id, project_name, milestone, amount, claimed_at, status, owner_id)
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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: 'Not signed in.' };
    }
    const { error } = await supabase.from('timesheets').insert([{
      project_name: entry.projectName,
      week: entry.week,
      planned: entry.planned,
      actual: entry.actual,
      labour: entry.labour,
      materials: entry.materials,
      submitted_at: new Date().toISOString(),
      owner_id: userData.user.id,
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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: 'Not signed in.' };
    }
    const { error } = await supabase.from('milestone_claims').insert([{
      project_name: entry.projectName,
      milestone: entry.milestone,
      amount: entry.amount,
      claimed_at: new Date().toISOString(),
      status: 'claimed',
      owner_id: userData.user.id,
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
