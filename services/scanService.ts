import { supabase } from './supabaseClient';

// Scan persistence.
//
// TODO(supabase-schema): Requires a `scans` table with an RLS policy that
// limits select/insert to rows where owner_id = auth.uid():
//   id uuid primary key default gen_random_uuid(),
//   owner_id uuid not null references auth.users(id),
//   file_name text,
//   drawing_version text,
//   scale_detected text,
//   page_count int,
//   legend_found boolean,
//   estimate_subtotal numeric,
//   component_count int,
//   created_at timestamptz default now()
//
// Until the table exists the service degrades gracefully so the scan flow
// keeps working in-memory.

export interface SaveScanInput {
  file_name: string;
  drawing_version: string;
  scale_detected: string;
  page_count: number;
  legend_found: boolean;
  estimate_subtotal: number;
  component_count: number;
}

export async function saveScan(input: SaveScanInput) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: 'Not signed in.' };
    }
    const { data, error } = await supabase
      .from('scans')
      .insert([{ ...input, owner_id: userData.user.id }])
      .select()
      .single();
    if (error) {
      console.warn('[scanService] insert skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, scan: data };
  } catch (e) {
    console.warn('[scanService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}
