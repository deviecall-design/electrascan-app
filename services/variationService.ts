import { supabase } from './supabaseClient';

// Structure pushed to Supabase when a variation report is exported.
// TODO(supabase-schema): Persistence requires a `variations` table with columns:
//   id uuid primary key default gen_random_uuid(),
//   project_name text,
//   from_estimate text, to_estimate text,
//   base_total numeric, revised_total numeric,
//   net_delta numeric, pct_change numeric,
//   added_count int, removed_count int, changed_count int,
//   rows jsonb, risk_flags jsonb, notes jsonb,
//   created_at timestamptz default now()
// and an RLS policy allowing anon insert (or an authed role the app will run under).
// Until that exists the save call will fail gracefully and the UI will continue.

export interface VariationSavePayload {
  project_name: string;
  from_estimate: string;
  to_estimate: string;
  base_total: number;
  revised_total: number;
  net_delta: number;
  pct_change: number;
  added_count: number;
  removed_count: number;
  changed_count: number;
  rows: unknown[];
  risk_flags: unknown[];
  notes: Record<string, string>;
}

export async function saveVariationReport(payload: VariationSavePayload) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: 'Not signed in.' };
    }
    const { data, error } = await supabase
      .from('variations')
      .insert([{ ...payload, owner_id: userData.user.id }])
      .select()
      .single();

    if (error) {
      console.warn('[variationService] Supabase save skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, data };
  } catch (e) {
    console.warn('[variationService] Supabase unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}
