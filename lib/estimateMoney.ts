/**
 * Canonical money for the live Dashboard / Estimates list.
 *
 * Production (electrascan-app.vercel.app) mounts DesktopApp → screens/*,
 * not AppShell's estimateTotals(). Those screens read `estimates.value`.
 *
 * Write contract (Quote persist + /api/estimates/create):
 *   subtotal   = sum of line totals, ex GST
 *   margin_pct = markup applied on that subtotal
 *   value      = GST-inclusive quoted total
 *              = computeQuoteTotals(subtotal, margin_pct).total
 *
 * Read contract:
 *   estimateTotal prefers priced takeoff lines, then the saved subtotal,
 *   then a stored GST-inclusive value. Margin is the estimate's own margin.
 *
 * Pending pipeline = status in {sent, viewed} (Dashboard KPI label).
 * Win rate = approved / (approved + rejected|lost) over the lookback.
 * Sent/viewed jobs are still open — they are not losses.
 */

import {
  computeQuoteTotals,
  DEFAULT_MARGIN_PCT,
  roundCents,
} from "./quoteTotals";
import { estimateTotal } from "./estimateTotal";
import { readDetectedItems } from "./scanRecord";

export const PENDING_STATUSES = ["sent", "viewed"] as const;
export const WON_STATUS = "approved";
export const LOST_STATUSES = ["rejected", "lost"] as const;
export const WIN_RATE_LOOKBACK_DAYS = 90;

export interface EstimateMoneyRow {
  value?: number | null;
  subtotal?: number | null;
  margin_pct?: number | null;
  status?: string | null;
  created_at?: string | null;
  days_since_sent?: number | null;
  ref?: string | null;
  reference?: string | null;
  estimate_ref?: string | null;
}

export interface ScanQuoteLinkRow {
  estimate_ref?: string | null;
  started_at?: string | null;
  detected_items?: unknown;
}

/** GST-inclusive quoted total. Lines and subtotal beat a stale saved value. */
export function quotedTotalIncGst(row: EstimateMoneyRow & { items?: Array<{ qty?: number; unitPrice?: number; status?: string }> | null }): number {
  return estimateTotal({
    items: row.items,
    subtotal: row.subtotal,
    marginPct: row.margin_pct,
    value: row.value,
  }).incGst;
}

export function isPendingStatus(status?: string | null): boolean {
  return status === "sent" || status === "viewed";
}

export function isWonStatus(status?: string | null): boolean {
  return status === "approved";
}

export function isLostStatus(status?: string | null): boolean {
  return status === "rejected" || status === "lost";
}

export function isClosedStatus(status?: string | null): boolean {
  return isWonStatus(status) || isLostStatus(status);
}

export function sumPendingQuotedValue(rows: EstimateMoneyRow[]): number {
  return roundCents(
    rows
      .filter(r => isPendingStatus(r.status))
      .reduce((s, r) => s + quotedTotalIncGst(r), 0),
  );
}

export function sumWonQuotedValue(rows: EstimateMoneyRow[]): number {
  return roundCents(
    rows
      .filter(r => isWonStatus(r.status))
      .reduce((s, r) => s + quotedTotalIncGst(r), 0),
  );
}

export function countEstimatesThisMonth(
  rows: EstimateMoneyRow[],
  now: Date = new Date(),
): number {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  return rows.filter(r => {
    if (!r.created_at) return false;
    const t = new Date(r.created_at).getTime();
    return Number.isFinite(t) && t >= startMs;
  }).length;
}

/**
 * Win rate of closed jobs only. Pending sent/viewed are not counted as
 * losses — that was inflating a "loss" rate on the live Dashboard.
 */
export function winRatePct(
  rows: EstimateMoneyRow[],
  opts?: { lookbackDays?: number; now?: Date },
): number | null {
  const now = opts?.now ?? new Date();
  const lookback = opts?.lookbackDays ?? WIN_RATE_LOOKBACK_DAYS;
  const since = now.getTime() - lookback * 24 * 60 * 60 * 1000;
  const closed = rows.filter(r => {
    if (!isClosedStatus(r.status)) return false;
    if (!r.created_at) return true;
    const t = new Date(r.created_at).getTime();
    return Number.isFinite(t) && t >= since;
  });
  if (closed.length === 0) return null;
  const won = closed.filter(r => isWonStatus(r.status)).length;
  return Math.round((won / closed.length) * 100);
}

export function estimateDisplayRef(row: EstimateMoneyRow): string {
  return row.reference || row.ref || "—";
}

export function daysSinceSent(
  row: EstimateMoneyRow,
  now: Date = new Date(),
): number | null {
  if (row.created_at) {
    const ms = now.getTime() - new Date(row.created_at).getTime();
    if (Number.isFinite(ms) && ms >= 0) {
      return Math.floor(ms / (24 * 60 * 60 * 1000));
    }
  }
  if (typeof row.days_since_sent === "number") return row.days_since_sent;
  return null;
}

/** Compact KPI money: $28k. Exact table money uses formatQuotedValue. */
export function formatPipelineKpi(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

export function formatQuotedValue(n: number): string {
  return `$${Math.round(n).toLocaleString("en-AU")}`;
}

/**
 * Fields written when a Quote is saved. `value` is always the GST-inclusive
 * total so Dashboard pending/win sums match the letterhead.
 */
export function quotePersistFields(subtotal: number, marginPct: number) {
  const totals = computeQuoteTotals(subtotal, marginPct);
  return {
    subtotal: totals.subtotal,
    margin_pct: totals.marginPct,
    value: totals.total,
  };
}

/**
 * Reverse of the AU quote formula, used only to stop demo rows from storing
 * the same number as both subtotal (ex GST) and value (inc GST).
 */
export function impliedSubtotalFromIncGst(
  totalIncGst: number,
  marginPct: number = DEFAULT_MARGIN_PCT,
): number {
  const divisor = (1 + Math.max(0, marginPct) / 100) * 1.1;
  if (!(divisor > 0)) return 0;
  return roundCents(Math.max(0, totalIncGst) / divisor);
}

export function avgScanToQuoteMs(
  scans: ScanQuoteLinkRow[],
  estimates: EstimateMoneyRow[],
): number | null {
  const createdByRef = new Map<string, string>();
  for (const e of estimates) {
    if (e.created_at && e.ref) createdByRef.set(e.ref, e.created_at);
    if (e.created_at && e.reference) createdByRef.set(e.reference, e.created_at);
  }
  const deltas: number[] = [];
  for (const s of scans) {
    if (!s.estimate_ref || !s.started_at) continue;
    const estCreated = createdByRef.get(s.estimate_ref);
    if (!estCreated) continue;
    const delta =
      new Date(estCreated).getTime() - new Date(s.started_at).getTime();
    if (delta > 0) deltas.push(delta);
  }
  if (deltas.length === 0) return null;
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

export interface DashboardMoneyStats {
  estimatesThisMonth: number;
  pendingValue: number;
  winRate: number | null;
  avgScanToQuoteMs: number | null;
  wonValue: number;
}

function withTakeoffLines(estimates: EstimateMoneyRow[], scans: ScanQuoteLinkRow[]) {
  return estimates.map(row => {
    const ref = row.reference || row.ref || "";
    const scan = scans.find(item => item.estimate_ref && item.estimate_ref === ref);
    if (!scan?.detected_items) return row;
    return { ...row, items: readDetectedItems(scan.detected_items) };
  });
}

export function computeDashboardMoneyStats(
  estimates: EstimateMoneyRow[],
  scans: ScanQuoteLinkRow[] = [],
  now: Date = new Date(),
): DashboardMoneyStats {
  const priced = withTakeoffLines(estimates, scans);
  return {
    estimatesThisMonth: countEstimatesThisMonth(estimates, now),
    pendingValue: sumPendingQuotedValue(priced),
    winRate: winRatePct(estimates, { now }),
    avgScanToQuoteMs: avgScanToQuoteMs(scans, estimates),
    wonValue: sumWonQuotedValue(priced),
  };
}
