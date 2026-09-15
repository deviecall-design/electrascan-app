import { supabase } from './supabaseClient';
import { computeDashboardMoneyStats, type EstimateMoneyRow } from '../lib/estimateMoney';

// Dashboard KPI strip — same money rules as screens/DashboardScreen.
//
// Pending value: GST-inclusive quoted total of status IN ('sent', 'viewed')
// Win rate:      approved / (approved + rejected + lost), 90-day lookback
//                (pending jobs are not losses)

export interface DashboardKpis {
  estimatesThisMonth: number;
  pendingValue: number;
  winRate: number | null;             // percentage 0..100, null until first closed deal
  avgScanToQuoteHours: number | null; // null when no linked scans
  source: 'supabase' | 'empty';
}

function startOfMonthIso(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return d.toISOString();
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

  const baseColumns = 'created_at, updated_at, status, value, subtotal, margin_pct, ref, reference';

  try {
    let q = supabase.from('estimates').select(baseColumns).limit(2000);
    if (ownerId) q = q.eq('owner_id', ownerId);
    const { data, error } = await q;
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, kpis: computeKpis((data ?? []) as EstimateMoneyRow[], monthStart) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

function computeKpis(rows: EstimateMoneyRow[], _monthStartIso: string): DashboardKpis {
  if (!rows || rows.length === 0) {
    return {
      estimatesThisMonth: 0,
      pendingValue: 0,
      winRate: null,
      avgScanToQuoteHours: null,
      source: 'empty',
    };
  }

  const stats = computeDashboardMoneyStats(rows);
  return {
    estimatesThisMonth: stats.estimatesThisMonth,
    pendingValue: stats.pendingValue,
    winRate: stats.winRate,
    avgScanToQuoteHours:
      stats.avgScanToQuoteMs == null
        ? null
        : Math.round((stats.avgScanToQuoteMs / (1000 * 60 * 60)) * 10) / 10,
    source: 'supabase',
  };
}

export function formatScanToQuote(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
