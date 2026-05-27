import { supabase } from './supabaseClient';

// Dashboard KPI strip — live Supabase queries.
//
// Tables read:
//   - estimates (created_at, updated_at, status, value, owner_id)
//
// Owner scoping: the spec asks for `owner_id = auth.uid()`. If the user is not
// authenticated (anon access), we fall back to the unscoped query, which will
// only return rows that RLS lets the anon role see — typically nothing, in
// which case the dashboard shows zeros and the caller can degrade to the
// local-only ProjectContext numbers.
//
// Status semantics used here:
//   - Pending value:  status IN ('draft', 'submitted')
//   - Win rate num:   status = 'approved'
//   - Win rate denom: status IN ('approved', 'rejected', 'lost')
//   - Avg scan-to-quote: time between created_at and updated_at on submitted

export interface DashboardKpis {
  estimatesThisMonth: number;
  pendingValue: number;
  winRate: number | null;             // percentage 0..100, null until first closed deal
  avgScanToQuoteHours: number | null; // null when no submitted estimates
  source: 'supabase' | 'empty';
}

const PENDING_STATUSES = ['draft', 'submitted'];
const WIN_NUMERATOR    = ['approved'];
const WIN_DENOMINATOR  = ['approved', 'rejected', 'lost'];

function startOfMonthIso(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return d.toISOString();
}

interface EstimateRow {
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  value?: number | null;
}

function rowTotal(r: EstimateRow): number {
  const v = r.value ?? 0;
  return typeof v === 'number' ? v : Number(v) || 0;
}

export async function fetchDashboardKpis(): Promise<
  | { ok: true; kpis: DashboardKpis }
  | { ok: false; error: string }
> {
  const now = new Date();
  const monthStart = startOfMonthIso(now);

  // Resolve current user (best-effort). RLS will scope the query if owner_id
  // policies are configured; the explicit eq is defence in depth so we never
  // accidentally count someone else's data when called from a shared client.
  let ownerId: string | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    ownerId = userData?.user?.id ?? null;
  } catch {
    ownerId = null;
  }

  const baseColumns = 'created_at, updated_at, status, value';

  try {
    let q = supabase.from('estimates').select(baseColumns).limit(2000);
    if (ownerId) q = q.eq('owner_id', ownerId);
    const { data, error } = await q;
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, kpis: computeKpis(data as EstimateRow[], monthStart) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

function computeKpis(rows: EstimateRow[], monthStartIso: string): DashboardKpis {
  if (!rows || rows.length === 0) {
    return {
      estimatesThisMonth: 0,
      pendingValue: 0,
      winRate: null,
      avgScanToQuoteHours: null,
      source: 'empty',
    };
  }

  const monthStart = new Date(monthStartIso).getTime();

  const estimatesThisMonth = rows.filter(r => {
    if (!r.created_at) return false;
    return new Date(r.created_at).getTime() >= monthStart;
  }).length;

  const pendingValue = rows
    .filter(r => r.status && PENDING_STATUSES.includes(r.status))
    .reduce((s, r) => s + rowTotal(r), 0);

  const denom = rows.filter(r => r.status && WIN_DENOMINATOR.includes(r.status)).length;
  const numer = rows.filter(r => r.status && WIN_NUMERATOR.includes(r.status)).length;
  const winRate = denom === 0 ? null : Math.round((numer / denom) * 100);

  const submitted = rows.filter(r => r.status === 'submitted' && r.created_at && r.updated_at);
  const avgScanToQuoteHours =
    submitted.length === 0
      ? null
      : Math.round(
          (submitted.reduce((s, r) => {
            const ms = new Date(r.updated_at!).getTime() - new Date(r.created_at!).getTime();
            return s + Math.max(ms, 0);
          }, 0) /
            submitted.length /
            (1000 * 60 * 60)) *
            10,
        ) / 10;

  return {
    estimatesThisMonth,
    pendingValue,
    winRate,
    avgScanToQuoteHours,
    source: 'supabase',
  };
}

export function formatScanToQuote(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
