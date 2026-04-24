import { supabase } from './supabaseClient';
import { VESH_CATALOGUE } from '../vesh_catalogue';

// Rate Library persistence.
//
// TODO(supabase-schema): Requires two tables — both with an RLS policy that
// permits the anon (or signed-in contractor) role to select/insert/update/
// delete rows scoped to the current tenant. Until they exist, the service
// degrades gracefully and the UI falls back to in-memory state.
//
// Table 1 — rate_library (the contractor's priced catalogue):
//   id uuid primary key default gen_random_uuid(),
//   product_id text unique,     -- stable wholesaler SKU (e.g. "GPO_DOUBLE_STANDARD")
//   code text,                  -- short SKU shown in table (e.g. "2025WE")
//   name text,
//   brand text,
//   category text,              -- one of RATE_CATEGORIES below
//   trade numeric,              -- wholesaler trade price ex GST
//   rrp numeric,                -- wholesaler RRP
//   unit text,                  -- 'EA' | 'LM' | 'COIL'
//   my_rate numeric,            -- contractor's applied rate (drives estimates)
//   catalogue_id text,          -- join key from vesh_catalogue.ts (e.g. "GPO_DOUBLE_STANDARD")
//   updated_at timestamptz default now()
//
// Table 2 — rate_library_sync_log (audit of sync events):
//   id uuid primary key default gen_random_uuid(),
//   ts timestamptz default now(),
//   source text,                -- e.g. 'TLE Electrical'
//   products_count int,
//   status text,                -- 'success' | 'error'
//   note text

export type RateCategory =
  | 'Power Points' | 'Lighting' | 'Switchboard' | 'Cabling' | 'Data & Communications';

export const RATE_CATEGORIES: RateCategory[] = [
  'Power Points', 'Lighting', 'Switchboard', 'Cabling', 'Data & Communications',
];

export interface WholesalerProduct {
  productId: string;
  code: string;
  name: string;
  brand: string;
  category: RateCategory;
  trade: number;
  rrp: number;
  unit: 'EA' | 'LM' | 'COIL';
}

export interface LibraryItem extends WholesalerProduct {
  myRate: number;
}

export interface SyncLogEntry {
  id: string;
  ts: string;
  source: string;
  productsCount: number;
  status: 'success' | 'error';
  note: string;
}

// ─── Library CRUD ────────────────────────────────
export async function fetchLibrary(): Promise<
  { ok: true; items: LibraryItem[] } | { ok: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('rate_library')
      .select('*');
    if (error) {
      console.warn('[rateLibraryService] fetch skipped:', error.message);
      return { ok: false, error: error.message };
    }
    const items: LibraryItem[] = (data ?? []).map((r: Record<string, unknown>) => ({
      productId: String(r.product_id ?? ''),
      code: String(r.code ?? ''),
      name: String(r.name ?? ''),
      brand: String(r.brand ?? ''),
      category: (r.category as RateCategory) ?? 'Power Points',
      trade: Number(r.trade ?? 0),
      rrp: Number(r.rrp ?? 0),
      unit: ((r.unit as LibraryItem['unit']) ?? 'EA'),
      myRate: Number(r.my_rate ?? 0),
    }));
    return { ok: true, items };
  } catch (e) {
    console.warn('[rateLibraryService] unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function upsertLibraryItem(item: LibraryItem) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: 'Not signed in.' };
    }
    const { error } = await supabase.from('rate_library').upsert({
      product_id: item.productId,
      code: item.code,
      name: item.name,
      brand: item.brand,
      category: item.category,
      trade: item.trade,
      rrp: item.rrp,
      unit: item.unit,
      my_rate: item.myRate,
      owner_id: userData.user.id,
    }, { onConflict: 'product_id' });
    if (error) {
      console.warn('[rateLibraryService] upsert skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[rateLibraryService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function removeLibraryItem(productId: string) {
  try {
    const { error } = await supabase
      .from('rate_library')
      .delete()
      .eq('product_id', productId);
    if (error) {
      console.warn('[rateLibraryService] remove skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[rateLibraryService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ─── Sync log ────────────────────────────────────
export async function fetchSyncLog(): Promise<
  { ok: true; entries: SyncLogEntry[] } | { ok: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('rate_library_sync_log')
      .select('*')
      .order('ts', { ascending: false })
      .limit(20);
    if (error) {
      console.warn('[rateLibraryService] log fetch skipped:', error.message);
      return { ok: false, error: error.message };
    }
    const entries: SyncLogEntry[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      ts: String(r.ts ?? new Date().toISOString()),
      source: String(r.source ?? 'TLE Electrical'),
      productsCount: Number(r.products_count ?? 0),
      status: ((r.status as SyncLogEntry['status']) ?? 'success'),
      note: String(r.note ?? ''),
    }));
    return { ok: true, entries };
  } catch (e) {
    console.warn('[rateLibraryService] unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function appendSyncLog(entry: Omit<SyncLogEntry, 'id' | 'ts'> & { ts?: string }) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return { ok: false as const, error: 'Not signed in.' };
    }
    const { error } = await supabase.from('rate_library_sync_log').insert([{
      ts: entry.ts ?? new Date().toISOString(),
      source: entry.source,
      products_count: entry.productsCount,
      status: entry.status,
      note: entry.note,
      owner_id: userData.user.id,
    }]);
    if (error) {
      console.warn('[rateLibraryService] log append skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[rateLibraryService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ─── Detection price-of-record lookup ────────────────
// Returns a { catalogue_id → my_rate } map for the signed-in user. The
// detection engine uses this to override the static vesh_catalogue.ts price
// with the contractor's current `my_rate` on each match. Empty map means
// either the user hasn't seeded yet or no rows have a catalogue_id — in
// either case the static price stands.
export async function fetchPriceMap(): Promise<Map<string, number>> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return new Map();
    const { data, error } = await supabase
      .from('rate_library')
      .select('catalogue_id, my_rate')
      .not('catalogue_id', 'is', null);
    if (error) {
      console.warn('[rateLibraryService] price map fetch skipped:', error.message);
      return new Map();
    }
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const id = row.catalogue_id as string | null;
      const rate = Number(row.my_rate);
      if (id && Number.isFinite(rate) && rate > 0) map.set(id, rate);
    }
    return map;
  } catch (e) {
    console.warn('[rateLibraryService] price map unreachable:', e);
    return new Map();
  }
}

// ─── Seed from vesh_catalogue.ts ─────────────────────
// One-shot upsert of the static Vesh catalogue into rate_library, keyed
// by product_id = catalogue_id. Idempotent — running twice does no harm.
// my_rate defaults to the static `price`; the contractor edits it via the
// Rate Library UI afterwards. RLS scopes everything to the signed-in user.
export async function seedRateLibraryFromVeshCatalogue(): Promise<
  { ok: true; inserted: number } | { ok: false; error: string }
> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: 'Not signed in.' };

    const rows = VESH_CATALOGUE.map(item => ({
      product_id: item.id,
      catalogue_id: item.id,
      code: item.id,
      name: item.name,
      brand: 'Vesh',
      category: item.category,
      trade: item.price,
      rrp: item.offFormPrice ?? item.price,
      unit: item.unit,
      my_rate: item.price,
      owner_id: userData.user.id,
    }));

    const { error } = await supabase
      .from('rate_library')
      .upsert(rows, { onConflict: 'product_id' });

    if (error) {
      console.warn('[rateLibraryService] seed failed:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, inserted: rows.length };
  } catch (e) {
    console.warn('[rateLibraryService] seed unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
