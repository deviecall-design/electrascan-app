import { supabase } from './supabaseClient';

// Approval audit-trail persistence.
//
// TODO(supabase-schema): Requires an `approval_audit` table with columns:
//   id uuid primary key default gen_random_uuid(),
//   project_name text,
//   estimate_id text,
//   actor text,
//   role text,           -- 'Electrician' | 'Builder' | 'Architect'
//   action text,         -- 'created' | 'submitted' | 'reviewed' | 'issued'
//                        --  | 'requested' | 'pending' | 'approved' | 'rejected'
//   label text,
//   note text,
//   doc text,
//   signature text,      -- SHA-256-style signature id; null while pending
//   immutable boolean default true,
//   hash_algo text default 'SHA-256',
//   ts timestamptz default now()
// and an RLS policy allowing anon select + insert (no update / delete — entries
// are immutable by design, §9 of the requirements doc).
// Until the table exists the service degrades gracefully — callers get
// `{ ok: false }` and the UI surfaces a local-only badge without blocking the
// workflow.

export type ApprovalActionType =
  | 'created'
  | 'submitted'
  | 'reviewed'
  | 'issued'
  | 'requested'
  | 'pending'
  | 'approved'
  | 'rejected';

export type ApprovalRole = 'Electrician' | 'Builder' | 'Architect';

export interface ApprovalAuditEntry {
  id: string;
  ts: string;          // ISO timestamp
  actor: string;
  role: ApprovalRole;
  action: ApprovalActionType;
  label: string;
  note: string;
  doc?: string;
  signature: string | null;
}

export interface ApprovalAuditInsert {
  project_name: string;
  estimate_id: string;
  actor: string;
  role: ApprovalRole;
  action: ApprovalActionType;
  label: string;
  note: string;
  doc?: string;
  signature: string | null;
}

export async function appendApprovalAudit(
  entry: ApprovalAuditInsert,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('approval_audit')
      .insert([entry])
      .select()
      .single();

    if (error) {
      console.warn('[approvalService] Supabase append skipped:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (e) {
    console.warn('[approvalService] Supabase unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function fetchApprovalAudit(
  estimateId: string,
): Promise<{ ok: true; entries: ApprovalAuditEntry[] } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('approval_audit')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('ts', { ascending: true });

    if (error) {
      console.warn('[approvalService] Supabase fetch skipped:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, entries: (data ?? []) as ApprovalAuditEntry[] };
  } catch (e) {
    console.warn('[approvalService] Supabase unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

// Signature format per §9 of the requirements doc.
// - Approval:       {INITIALS}-{YYYYMMDD}-APPROVED
// - Other actions:  {INITIALS}-{YYYY-MMDD}-{HHMM}
export function generateSignature(actorName: string, action: ApprovalActionType, when: Date = new Date()): string {
  const initials = actorName
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3) || 'XX';
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  const hh = String(when.getUTCHours()).padStart(2, '0');
  const mm = String(when.getUTCMinutes()).padStart(2, '0');
  if (action === 'approved') return `${initials}-${y}${m}${d}-APPROVED`;
  if (action === 'rejected') return `${initials}-${y}${m}${d}-RETURNED`;
  return `${initials}-${y}-${m}${d}-${hh}${mm}`;
}
