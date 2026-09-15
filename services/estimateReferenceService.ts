import { supabase } from './supabaseClient';

// Allocate the next EST-YYMM-XXXX reference for the calling owner.
//
// The canonical path is the /api/estimates/create endpoint (which enforces
// the unique sequence inside Postgres). For purely client-side flows that
// don't go through the API yet, this module exposes a peek helper that
// asks Supabase directly for the largest existing reference under the
// current YYMM prefix and increments it. That path is best-effort: it
// races against concurrent inserts, so once the row is persisted server-
// side we re-read the reference written by the API.

export function currentReferencePrefix(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `EST-${yy}${mm}-`;
}

export function nextReference(prefix: string, latest: string | null | undefined): string {
  if (!latest) return `${prefix}0001`;
  const tail = latest.slice(prefix.length);
  const n = parseInt(tail, 10);
  if (Number.isNaN(n)) return `${prefix}0001`;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

/**
 * Canonical live format: EST-YYMM-XXXX (e.g. EST-2609-0001).
 * Rejects Bondi mock EST-2026-0142, AppShell EST-2026-497-001, and
 * Approvals theatre EST-26-001-v3.
 */
export function isCanonicalEstimateRef(ref: string): boolean {
  return /^EST-\d{2}(0[1-9]|1[0-2])-\d{4}$/.test(ref);
}

// Best-effort client-side allocation. Returns the next reference for
// display ahead of persistence. Callers that persist via /api/estimates/create
// should overwrite with the server-returned reference.
export async function peekNextReference(): Promise<string> {
  const prefix = currentReferencePrefix();
  try {
    const { data, error } = await supabase
      .from('estimates')
      .select('reference')
      .like('reference', `${prefix}%`)
      .order('reference', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return `${prefix}0001`;
    return nextReference(prefix, data?.reference ?? null);
  } catch {
    return `${prefix}0001`;
  }
}
