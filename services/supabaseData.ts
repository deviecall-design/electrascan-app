/**
 * Supabase data service — typed fetch/insert functions for ElectraScan tables.
 * Each function returns `{ data, error }`. Screens show an empty state when
 * the list is empty or the query fails. They do not invent sample jobs.
 */

import { supabase } from "./supabaseClient";
import { getCurrentTenantId, rememberTenantId } from "../lib/tenants";
import {
  quotedTotalIncGst,
  WIN_RATE_LOOKBACK_DAYS,
} from "../lib/estimateMoney";

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

export interface CompanyProfileRow {
  id: string;
  owner_id: string;
  company_name: string;
  abn: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Fetch functions ────────────────────────────────────────────────────

export async function fetchEstimates() {
  return supabase
    .from("estimates")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
}

export async function fetchScans() {
  return supabase
    .from("scans")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);
}

export async function fetchScanById(id: string) {
  return supabase
    .from("scans")
    .select("*")
    .eq("id", id)
    .single();
}

export async function fetchEstimateByRef(ref: string) {
  return supabase
    .from("estimates")
    .select("*")
    .eq("reference", ref)
    .single();
}

export async function fetchMilestoneClaimsForProject(projectId: string) {
  return supabase
    .from("milestone_claims")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
}

export async function fetchRateLibrary() {
  return supabase
    .from("rate_library")
    .select("*")
    .order("code", { ascending: true })
    .limit(500);
}

// ─── Insert functions ───────────────────────────────────────────────────

export async function insertEstimate(row: Omit<EstimateRow, "id" | "created_at">) {
  const tenantId = await tenantForWrite();
  if (!tenantId) return { data: null, error: NO_WORKSPACE };
  return supabase
    .from("estimates")
    .insert([{ ...row, tenant_id: tenantId }])
    .select()
    .single();
}

const NO_WORKSPACE = { message: "Sign in to open a workspace before saving." };

/**
 * Join an invited tenant, or open a private showcase workspace.
 * Does not attach the caller to Vesh unless their email is on tenant_invites.
 */
export async function provisionWorkspace() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false as const, error: "Not signed in" };
  const { data, error } = await supabase.rpc("provision_workspace");
  if (error) return { ok: false as const, error: error.message };
  const tenantId = (data as string | null) ?? null;
  rememberTenantId(tenantId);
  return { ok: true as const, tenantId };
}

async function tenantForWrite(): Promise<string | null> {
  const existing = await getCurrentTenantId();
  if (existing) return existing;
  const provisioned = await provisionWorkspace();
  if (provisioned.ok && provisioned.tenantId) return provisioned.tenantId;
  return getCurrentTenantId();
}

export async function insertScan(row: Partial<ScanRow> & Pick<ScanRow, "file_name">) {
  const tenantId = await tenantForWrite();
  if (!tenantId) return { data: null, error: NO_WORKSPACE };
  return supabase
    .from("scans")
    .insert([{
      file_name: row.file_name,
      client: row.client ?? null,
      stage: row.stage ?? "review",
      items_detected: row.items_detected ?? 0,
      progress: row.progress ?? 0,
      detected_items: row.detected_items ?? [],
      risk_flags: row.risk_flags ?? [],
      estimate_ref: row.estimate_ref ?? null,
      tenant_id: tenantId,
    }])
    .select()
    .single();
}

export async function updateScan(id: string, updates: Partial<ScanRow>) {
  return supabase.from("scans").update(updates).eq("id", id).select().single();
}

export async function upsertRate(row: Omit<RateRow, "id" | "synced_at">) {
  const tenantId = await tenantForWrite();
  if (!tenantId) return { data: null, error: NO_WORKSPACE };
  return supabase
    .from("rate_library")
    .upsert([{ ...row, tenant_id: tenantId }], { onConflict: "code,owner_id" })
    .select()
    .single();
}

export async function deleteRate(id: string) {
  return supabase.from("rate_library").delete().eq("id", id);
}

// ─── Company profile ────────────────────────────────────────────────────

export type CompanyProfileInput = Pick<
  CompanyProfileRow,
  "company_name" | "abn" | "logo_url" | "address" | "phone" | "email"
>;

export async function fetchCompanyProfile() {
  // RLS scopes the row to the signed-in user; maybeSingle() returns null
  // (rather than an error) when no profile exists yet for fresh tenants.
  return supabase.from("company_profile").select("*").maybeSingle();
}

export async function upsertCompanyProfile(input: CompanyProfileInput) {
  const { data: userResult } = await supabase.auth.getUser();
  const ownerId = userResult?.user?.id;
  const row = ownerId ? { owner_id: ownerId, ...input } : input;
  return supabase
    .from("company_profile")
    .upsert([row], { onConflict: "owner_id" })
    .select()
    .single();
}

// ─── Dashboard KPI queries ──────────────────────────────────────────────
//
// Each KPI returns `{ value: T | null, error: any }`. A null value (rather
// than 0) signals the caller to render "—" instead of a falsy number, so
// fresh tenants don't see misleading zeroes.
//
// Auth filtering: all KPI queries filter by the signed-in user's uid
// (owner_id = auth.uid()). This is necessary for RLS enforcement and is
// the correct filter for the beta single-tenant phase — tenant_id may not
// be populated for all rows yet. If no user session exists the query
// resolves to null (renders "—") rather than erroring.
//
// The schema uses status values: 'draft' | 'sent' | 'viewed' | 'approved'.
// Win rate is approved / (approved + rejected + lost) over the last 90 days.
// Sent and viewed jobs are still pending — they are not counted as losses.

export interface KpiResult<T> {
  value: T | null;
  error: any;
}

/** Returns the current authenticated user's id, or null if not signed in. */
async function getAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function fetchEstimatesThisMonth(): Promise<KpiResult<number>> {
  const uid = await getAuthUserId();
  if (!uid) return { value: null, error: "not_authenticated" };
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("estimates")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid)
    .gte("created_at", start.toISOString());
  return { value: error ? null : (count ?? 0), error };
}

export async function fetchPendingValue(): Promise<KpiResult<number>> {
  const uid = await getAuthUserId();
  if (!uid) return { value: null, error: "not_authenticated" };
  const { data, error } = await supabase
    .from("estimates")
    .select("value, subtotal, margin_pct, status")
    .eq("owner_id", uid)
    .in("status", ["sent", "viewed"]);
  if (error || !data) return { value: null, error };
  const total = data.reduce((s, r: any) => s + quotedTotalIncGst(r), 0);
  return { value: total, error: null };
}

export async function fetchWinRate(): Promise<KpiResult<number>> {
  const uid = await getAuthUserId();
  if (!uid) return { value: null, error: "not_authenticated" };
  const since = new Date();
  since.setDate(since.getDate() - WIN_RATE_LOOKBACK_DAYS);
  const { data, error } = await supabase
    .from("estimates")
    .select("status, created_at")
    .eq("owner_id", uid)
    .gte("created_at", since.toISOString())
    .in("status", ["approved", "rejected", "lost"]);
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
  const uid = await getAuthUserId();
  if (!uid) return { value: null, error: "not_authenticated" };

  const { data: scans, error: scansErr } = await supabase
    .from("scans")
    .select("estimate_ref, started_at")
    .eq("owner_id", uid)
    .not("estimate_ref", "is", null);
  if (scansErr || !scans || scans.length === 0) return { value: null, error: scansErr };

  const refs = Array.from(new Set(scans.map((s: any) => s.estimate_ref).filter(Boolean)));
  if (refs.length === 0) return { value: null, error: null };

  const { data: estimates, error: estErr } = await supabase
    .from("estimates")
    .select("ref, reference, created_at")
    .eq("owner_id", uid)
    .in("ref", refs);
  const { data: byReference } = await supabase
    .from("estimates")
    .select("ref, reference, created_at")
    .eq("owner_id", uid)
    .in("reference", refs);
  const rows = [...(estimates ?? []), ...(byReference ?? [])];
  if (estErr || rows.length === 0) return { value: null, error: estErr };

  const refToEstCreated = new Map<string, string>();
  rows.forEach((e: any) => {
    if (e.created_at && e.ref) refToEstCreated.set(e.ref, e.created_at);
    if (e.created_at && e.reference) refToEstCreated.set(e.reference, e.created_at);
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

// ─── Milestone claims ────────────────────────────────────────────────────
//
// milestone_claims records a Submit Claim only after the insert succeeds.
// Callers must leave the milestone unchanged when `ok` is false. A draft
// invoice reference is allocated only for a row that was actually written.
//
// Table schema (run via migrations):
//   id uuid PK, project_id text, milestone_id text,
//   amount numeric, inv_ref text, status text,
//   created_by uuid, created_at timestamptz,
//   tenant_id uuid, owner_id uuid

export interface MilestoneClaimRow {
  id?: string;
  project_id: string;
  milestone_id: string;
  milestone_label: string;
  amount: number;
  inv_ref: string;
  status: string;
  created_at?: string;
}

/**
 * Submit a milestone claim. Creates a draft record in milestone_claims
 * and returns the generated invoice reference.
 *
 * Does NOT auto-send to builder or approve the invoice. Status = "draft".
 * Finance team is notified in-app; they review and approve in MYOB.
 */
export async function submitMilestoneClaim(
  projectId: string,
  milestoneId: string,
  milestoneLabel: string,
  amount: number,
): Promise<{ ok: boolean; invRef: string | null; error: { message: string } | null }> {
  const { data: userResult } = await supabase.auth.getUser();
  const ownerId = userResult?.user?.id ?? null;
  if (!ownerId) {
    return { ok: false, invRef: null, error: { message: "Sign in before submitting a claim." } };
  }

  const tenantId = await tenantForWrite();
  if (!tenantId) {
    return { ok: false, invRef: null, error: { message: NO_WORKSPACE.message } };
  }

  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  const invRef = `INV-${year}-${seq}`;

  const row: MilestoneClaimRow = {
    project_id: projectId,
    milestone_id: milestoneId,
    milestone_label: milestoneLabel,
    amount,
    inv_ref: invRef,
    status: "draft",
  };

  const { error } = await supabase
    .from("milestone_claims")
    .insert([{
      ...row,
      owner_id: ownerId,
      tenant_id: tenantId,
    }]);

  if (error) {
    console.warn("[ElectraScan] milestone_claims insert failed:", error.message);
    return { ok: false, invRef: null, error: { message: error.message } };
  }

  return { ok: true, invRef, error: null };
}

export interface TenantInvite {
  id: string;
  email: string;
  role: "owner" | "member";
  created_at?: string;
}

/** Membership of the signed-in user. RLS limits this to their own rows. */
export async function fetchMyMembership() {
  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult?.user?.id;
  if (!userId) return { data: null, error: { message: "Not signed in" } };
  return supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

/** Invites for the caller's tenant. Only an owner can read this list. */
export async function fetchTenantInvites() {
  return supabase
    .from("tenant_invites")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });
}

export async function createTenantInvite(email: string, role: "owner" | "member") {
  const tenantId = await tenantForWrite();
  if (!tenantId) return { data: null, error: NO_WORKSPACE };
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return { data: null, error: { message: "Enter a full email address." } };
  }
  return supabase
    .from("tenant_invites")
    .insert([{ email: normalized, role, tenant_id: tenantId }])
    .select("id, email, role, created_at")
    .single();
}

export async function deleteTenantInvite(id: string) {
  return supabase.from("tenant_invites").delete().eq("id", id);
}
