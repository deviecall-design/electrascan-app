import { supabase } from './supabaseClient';

const N8N_WEBHOOK_URL = 'https://damienc13.app.n8n.cloud/webhook/electrascan-estimate';

export interface EstimateRow {
  id: string;
  reference: string;       // synthesized — DB has no reference column today
  client: string;          // project_name (or contractor as fallback)
  value: number;           // total
  status: string;
  daysAgo: number;
  createdAt: string;
}

// Fetch the signed-in user's estimates. RLS scopes the read to owner_id =
// auth.uid(); we still require an authenticated session here so callers
// don't accidentally render shared-anon data if RLS were ever loosened.
export async function fetchEstimates(): Promise<
  { ok: true; estimates: EstimateRow[] } | { ok: false; error: string }
> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { ok: false, error: 'Not signed in.' };

    const { data, error } = await supabase
      .from('estimates')
      .select('id, project_name, contractor, total, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('[estimateService] fetch skipped:', error.message);
      return { ok: false, error: error.message };
    }

    const now = Date.now();
    const estimates: EstimateRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      const createdAt = String(r.created_at ?? new Date().toISOString());
      const daysAgo = Math.max(
        0,
        Math.floor((now - new Date(createdAt).getTime()) / 86_400_000),
      );
      const idStr = String(r.id ?? '');
      const idShort = idStr.replace(/-/g, '').slice(0, 4).toUpperCase();
      const yymm = createdAt.slice(2, 4) + createdAt.slice(5, 7);
      return {
        id: idStr,
        reference: `EST-${yymm}-${idShort}`,
        client: String(r.project_name ?? r.contractor ?? 'Unnamed'),
        value: Number(r.total ?? 0),
        status: String(r.status ?? 'draft'),
        daysAgo,
        createdAt,
      };
    });
    return { ok: true, estimates };
  } catch (e) {
    console.warn('[estimateService] unreachable:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function saveEstimate(estimateData: {
  project_name: string;
  contractor: string;
  total: number;
  items: any[];
  status?: string;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Not signed in — cannot save estimate.');
  }

  // 1. Save to Supabase
  const { data, error } = await supabase
    .from('estimates')
    .insert([{
      ...estimateData,
      status: estimateData.status ?? 'draft',
      owner_id: userData.user.id,
    }])
    .select()
    .single();

  if (error) {
    console.error('Supabase save failed:', error);
    throw error;
  }

  // 2. Trigger n8n webhook
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estimateId: data.id,
        project_name: data.project_name,
        contractor: data.contractor,
        total: data.total,
        createdAt: data.created_at
      })
    });
  } catch (webhookError) {
    // Don't block the save if webhook fails
    console.error('n8n webhook failed:', webhookError);
  }

  return data;
}
