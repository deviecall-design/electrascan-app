import { supabase } from './supabaseClient';
import { type Project, type Timesheet, type Milestone } from '../contexts/ProjectContext';

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

// Helpers to derive financial KPIs from project data
export function getProjectTimesheets(project: Project | undefined): Timesheet[] {
  return project?.timesheets ?? [];
}

export function getProjectMilestones(project: Project | undefined): Milestone[] {
  return project?.milestones ?? [];
}

export function calculateLabourSpent(timesheets: Timesheet[]): number {
  return timesheets.reduce((sum, t) => sum + t.labourCost, 0);
}

export function calculateMaterialsSpent(timesheets: Timesheet[]): number {
  return timesheets.reduce((sum, t) => sum + t.materialsUsed, 0);
}

export function calculateOverrunAmount(project: Project | undefined): number {
  return (project?.overruns ?? []).reduce((sum, o) => sum + o.amount, 0);
}
