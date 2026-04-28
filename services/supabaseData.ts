/**
 * Supabase data service — typed fetch/insert functions for all ElectraScan
 * tables. Each function returns `{ data, error }` following the Supabase
 * convention; callers should fall back to mock data when `error` is truthy.
 *
 * Tables must be created via migrations/001_create_tables.sql before these
 * functions return real data. Until then, every fetch returns an error and
 * the screens show their hardcoded fallback arrays.
 */

import { supabase } from "./supabaseClient";

// ─── Row types (mirror the SQL schema) ──────────────────────────────────
export interface EstimateRow {
  id: string;
  ref: string;
  reference: string | null;
  client: string;
  value: number;
  status: "draft" | "sent" | "viewed" | "approved";
  days_since_sent: number;
  project_name: string | null;
  drawing_file: string | null;
  margin_pct: number;
  subtotal: number;
  line_items: any[];
  created_at: string;
}

export interface ScanRow {
  id: string;
  file_name: string;
  client: string | null;
  stage: string;
  items_detected: number;
  progress: number;
  estimate_ref: string | null;
  detected_items: any[];
  risk_flags: any[];
  started_at: string;
  completed_at: string | null;
}

export interface RateRow {
  id: string;
  code: string;
  category: string;
  description: string;
  unit: string;
  rate: number;
  labour: number;
  is_custom: boolean;
  synced_at: string;
}

// ─── Fetch functions ────────────────────────────────────────────────────

export async function fetchEstimates() {
  return supabase
    .from("estimates")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function fetchScans() {
  return supabase
    .from("scans")
    .select("*")
    .order("started_at", { ascending: false });
}

export async function fetchRateLibrary() {
  return supabase
    .from("rate_library")
    .select("*")
    .order("code", { ascending: true });
}

// ─── Insert functions ───────────────────────────────────────────────────

export async function insertEstimate(row: Omit<EstimateRow, "id" | "created_at">) {
  return supabase.from("estimates").insert([row]).select().single();
}

export async function insertScan(row: Pick<ScanRow, "file_name" | "client">) {
  return supabase.from("scans").insert([row]).select().single();
}

export async function updateScan(id: string, updates: Partial<ScanRow>) {
  return supabase.from("scans").update(updates).eq("id", id).select().single();
}

export async function upsertRate(row: Omit<RateRow, "id" | "synced_at">) {
  return supabase
    .from("rate_library")
    .upsert([row], { onConflict: "code,owner_id" })
    .select()
    .single();
}

// ─── Dashboard KPI queries ──────────────────────────────────────────────
//
// Each KPI returns `{ value: T | null, error: any }`. A null value (rather
// than 0) signals the caller to render "—" instead of a falsy number, so
// fresh tenants don't see misleading zeroes.
//
// The schema uses status values: 'draft' | 'sent' | 'viewed' | 'approved'.
// Mapping for win-rate: "won" = approved, "lost" = future 'rejected' status
// (not yet in schema — handled gracefully via IN clause). Until rejected
// rows exist, win rate is approved / (approved + sent + viewed) over the
// last 90 days, treating "pending decision" estimates as not-yet-decided.

export interface KpiResult<T> {
  value: T | null;
  error: any;
}

export async function fetchEstimatesThisMonth(): Promise<KpiResult<number>> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("estimates")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  return { value: error ? null : (count ?? 0), error };
}

export async function fetchPendingValue(): Promise<KpiResult<number>> {
  const { data, error } = await supabase
    .from("estimates")
    .select("value")
    .in("status", ["sent", "viewed"]);
  if (error || !data) return { value: null, error };
  const total = data.reduce((s, r: any) => s + Number(r.value ?? 0), 0);
  return { value: total, error: null };
}

export async function fetchWinRate(): Promise<KpiResult<number>> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const { data, error } = await supabase
    .from("estimates")
    .select("status")
    .gte("created_at", since.toISOString())
    .in("status", ["approved", "sent", "viewed", "rejected"]);
  if (error || !data || data.length === 0) return { value: null, error };
  const won = data.filter((r: any) => r.status === "approved").length;
  const decided = data.length;
  if (decided === 0) return { value: null, error: null };
  return { value: Math.round((won / decided) * 100), error: null };
}

export async function fetchAvgScanToQuote(): Promise<KpiResult<number>> {
  // Returns the average time in milliseconds between a scan starting and
  // the linked estimate being created. Scans link to estimates via
  // scans.estimate_ref → estimates.ref.
  const { data: scans, error: scansErr } = await supabase
    .from("scans")
    .select("estimate_ref, started_at")
    .not("estimate_ref", "is", null);
  if (scansErr || !scans || scans.length === 0) return { value: null, error: scansErr };

  const refs = Array.from(new Set(scans.map((s: any) => s.estimate_ref).filter(Boolean)));
  if (refs.length === 0) return { value: null, error: null };

  const { data: estimates, error: estErr } = await supabase
    .from("estimates")
    .select("ref, created_at")
    .in("ref", refs);
  if (estErr || !estimates || estimates.length === 0) return { value: null, error: estErr };

  const refToEstCreated = new Map<string, string>();
  estimates.forEach((e: any) => {
    if (e.ref && e.created_at) refToEstCreated.set(e.ref, e.created_at);
  });

  const deltas: number[] = [];
  scans.forEach((s: any) => {
    const estCreated = refToEstCreated.get(s.estimate_ref);
    if (estCreated && s.started_at) {
      const delta = new Date(estCreated).getTime() - new Date(s.started_at).getTime();
      if (delta > 0) deltas.push(delta);
    }
  });

  if (deltas.length === 0) return { value: null, error: null };
  const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return { value: avgMs, error: null };
}

/**
 * Format an avg-scan-to-quote duration (ms) as "Xh" or "Xd".
 * Returns "—" for null/invalid input so callers can pass through.
 */
export function formatScanToQuote(ms: number | null): string {
  if (ms == null || !isFinite(ms) || ms <= 0) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  const days = hours / 24;
  return `${Math.max(1, Math.round(days))}d`;
}
