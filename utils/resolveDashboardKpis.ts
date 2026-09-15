import { formatScanToQuote, type DashboardKpis } from "../services/dashboardKpiService";

export interface LocalKpiStats {
  estimatesThisMonth: number;
  pendingValue: number;
  winRate: number | null;
  avgDays: number | null;
}

export type KpiDisplaySource = "loading" | "supabase" | "local" | "empty" | "error";

export interface DisplayKpis {
  estimatesThisMonth: number;
  pendingValue: number;
  winRate: number | null;
  avgScanToQuote: string;
  source: KpiDisplaySource;
}

function localHasSignal(local: LocalKpiStats): boolean {
  return (
    local.estimatesThisMonth > 0 ||
    local.pendingValue > 0 ||
    local.winRate !== null ||
    local.avgDays !== null
  );
}

function fromLocal(local: LocalKpiStats, source: KpiDisplaySource): DisplayKpis {
  return {
    estimatesThisMonth: local.estimatesThisMonth,
    pendingValue: local.pendingValue,
    winRate: local.winRate,
    avgScanToQuote: local.avgDays === null ? "—" : `${local.avgDays}d`,
    source,
  };
}

function fromLive(live: DashboardKpis, source: KpiDisplaySource): DisplayKpis {
  return {
    estimatesThisMonth: live.estimatesThisMonth,
    pendingValue: live.pendingValue,
    winRate: live.winRate,
    avgScanToQuote: formatScanToQuote(live.avgScanToQuoteHours),
    source,
  };
}

/**
 * Prefer live Supabase rows when they exist. An empty cloud table must not
 * wipe non-empty local drafts. Loading never exposes placeholder numbers.
 */
export function resolveDashboardKpis(
  kpiState: "loading" | "ready" | "error",
  live: DashboardKpis | null,
  local: LocalKpiStats,
): DisplayKpis {
  if (kpiState === "loading") {
    return fromLocal(local, "loading");
  }

  if (kpiState === "error" || live === null) {
    return fromLocal(local, localHasSignal(local) ? "error" : "empty");
  }

  if (live.source === "supabase") {
    return fromLive(live, "supabase");
  }

  // live.source === 'empty'
  if (localHasSignal(local)) {
    return fromLocal(local, "local");
  }

  return fromLive(live, "empty");
}
