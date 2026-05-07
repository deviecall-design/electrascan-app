import { supabase } from './supabaseClient';

// Email Upload persistence.
//
// TODO(supabase-schema): Requires two tables + an RLS policy that lets each
// tenant read/write only their own rows. Until they exist, the service
// degrades gracefully and the UI falls back to seeded mock inbox rows.
//
// Table 1 — incoming_emails (inbox ledger):
//   id uuid primary key default gen_random_uuid(),
//   tenant_email text,                 -- the inbox address this row landed in
//   from_email text,
//   subject text,
//   file_name text,
//   file_kind text,                    -- 'pdf' | 'image'
//   pages int,
//   received_at timestamptz default now(),
//   status text,                       -- 'queued' | 'scanning' | 'scanned' | 'error'
//   linked_project text,               -- 'Unassigned' when sender→project map fails
//   estimate_id text                   -- populated once AI scan produces an estimate
//
// Table 2 — user_prefs (per-user preferences; only `auto_scan` is used today):
//   user_email text primary key,
//   auto_scan boolean default true,
//   updated_at timestamptz default now()

export type EmailScanStatus = 'queued' | 'scanning' | 'scanned' | 'error';

export interface IncomingEmail {
  id: string;
  from: string;
  subject: string;
  file: string;
  fileKind: 'pdf' | 'image';
  pages: number;
  received: string;           // ISO timestamp
  status: EmailScanStatus;
  project: string;            // 'Unassigned' when mapping fails
  estimateId?: string;
}

// ─── Inbox CRUD ──────────────────────────────────
export async function fetchIncomingEmails(
  tenantEmail?: string,
): Promise<{ ok: true; emails: IncomingEmail[] } | { ok: false; error: string }> {
  try {
    let q = supabase
      .from('incoming_emails')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(50);
    if (tenantEmail) q = q.eq('tenant_email', tenantEmail);
    const { data, error } = await q;
    if (error) {
      console.warn('[emailUploadService] fetch skipped:', error.message);
      return { ok: false, error: error.message };
    }
    const emails: IncomingEmail[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      from: String(r.from_email ?? ''),
      subject: String(r.subject ?? ''),
      file: String(r.file_name ?? ''),
      fileKind: ((r.file_kind as IncomingEmail['fileKind']) ?? 'pdf'),
      pages: Number(r.pages ?? 1),
      received: String(r.received_at ?? new Date().toISOString()),
      status: ((r.status as EmailScanStatus) ?? 'queued'),
      project: String(r.linked_project ?? 'Unassigned'),
      estimateId: r.estimate_id ? String(r.estimate_id) : undefined,
    }));
    return { ok: true, emails };
  } catch (e) {
    console.warn('[emailUploadService] unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function updateIncomingEmailStatus(
  id: string,
  status: EmailScanStatus,
  estimateId?: string,
) {
  try {
    const patch: Record<string, unknown> = { status };
    if (estimateId) patch.estimate_id = estimateId;
    const { error } = await supabase
      .from('incoming_emails')
      .update(patch)
      .eq('id', id);
    if (error) {
      console.warn('[emailUploadService] status update skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[emailUploadService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// ─── User prefs (auto-scan toggle) ───────────────
export async function fetchAutoScanPref(
  userEmail: string,
): Promise<{ ok: true; autoScan: boolean } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('user_prefs')
      .select('auto_scan')
      .eq('user_email', userEmail)
      .maybeSingle();
    if (error) {
      console.warn('[emailUploadService] pref fetch skipped:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, autoScan: Boolean(data?.auto_scan ?? true) };
  } catch (e) {
    console.warn('[emailUploadService] unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function upsertAutoScanPref(userEmail: string, autoScan: boolean) {
  try {
    const { error } = await supabase
      .from('user_prefs')
      .upsert(
        { user_email: userEmail, auto_scan: autoScan, updated_at: new Date().toISOString() },
        { onConflict: 'user_email' },
      );
    if (error) {
      console.warn('[emailUploadService] pref upsert skipped:', error.message);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    console.warn('[emailUploadService] unreachable:', e);
    return { ok: false as const, error: e instanceof Error ? e.message : 'unknown' };
  }
}
