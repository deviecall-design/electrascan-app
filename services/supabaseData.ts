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
