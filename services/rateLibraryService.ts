import { supabase } from './supabaseClient';

// Rate Library persistence.
//
// TODO(supabase-schema): Requires two tables — both with an RLS policy that
// permits the anon (or signed-in contractor) role to select/insert/update/
// delete rows scoped to the current tenant. Until they exist, the service
// degrades gracefully and the UI falls back to in-memory state.
//
// Table 1 — rate_library_items (the contractor's priced catalogue):
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
//   suppliers text[] default '{}', -- wholesalers that stock this item e.g. {"TLE","Reece"}
//   supplier_skus jsonb default '{}', -- per-supplier SKUs e.g. {"TLE":"CLI3025VW"}
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
  suppliers: string[];                  // e.g. ["TLE", "Reece"]
  supplierSkus: Record<string, string>; // e.g. { TLE: "CLI3025VW" }
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
      .from('rate_library_items')
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
      suppliers: (r.suppliers as string[]) ?? [],
      supplierSkus: (r.supplier_skus as Record<string, string>) ?? {},
    }));
    return { ok: true, items };
  } catch (e) {
    console.warn('[rateLibraryService] unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function upsertLibraryItem(item: LibraryItem) {
  try {
    const { error } = await supabase.from('rate_library_items').upsert({
      product_id: item.productId,
      code: item.code,
      name: item.name,
      brand: item.brand,
      category: item.category,
      trade: item.trade,
      rrp: item.rrp,
      unit: item.unit,
      my_rate: item.myRate,
      suppliers: item.suppliers ?? [],
      supplier_skus: item.supplierSkus ?? {},
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
      .from('rate_library_items')
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

// ─── Supplier queries ─────────────────────────────

// Returns only items tagged for a specific supplier — used to build the BOM.
// SQL: WHERE 'TLE' = ANY(suppliers)
export async function fetchLibraryBySupplier(supplier: string): Promise<
  { ok: true; items: LibraryItem[] } | { ok: false; error: string }
> {
  try {
    const { data, error } = await supabase
      .from('rate_library_items')
      .select('*')
      .contains('suppliers', [supplier]);
    if (error) return { ok: false, error: error.message };
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
      suppliers: (r.suppliers as string[]) ?? [],
      supplierSkus: (r.supplier_skus as Record<string, string>) ?? {},
    }));
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// Tag a library item with a supplier and their specific SKU.
// Merges into existing suppliers/supplier_skus — does not overwrite other suppliers.
export async function tagSupplier(
  productId: string,
  supplier: string,
  supplierSku: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Fetch current tags first so we can merge
    const { data, error: fetchErr } = await supabase
      .from('rate_library_items')
      .select('suppliers, supplier_skus')
      .eq('product_id', productId)
      .single();
    if (fetchErr) return { ok: false, error: fetchErr.message };

    const existing: string[] = (data?.suppliers as string[]) ?? [];
    const existingSkus: Record<string, string> = (data?.supplier_skus as Record<string, string>) ?? {};

    const updatedSuppliers = existing.includes(supplier) ? existing : [...existing, supplier];
    const updatedSkus = { ...existingSkus, [supplier]: supplierSku };

    const { error } = await supabase
      .from('rate_library_items')
      .update({ suppliers: updatedSuppliers, supplier_skus: updatedSkus })
      .eq('product_id', productId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
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
    const { error } = await supabase.from('rate_library_sync_log').insert([{
      ts: entry.ts ?? new Date().toISOString(),
      source: entry.source,
      products_count: entry.productsCount,
      status: entry.status,
      note: entry.note,
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
