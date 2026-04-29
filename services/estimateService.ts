import { supabase } from './supabaseClient';

const N8N_WEBHOOK_URL = 'https://damienc13.app.n8n.cloud/webhook/electrascan-estimate';

export interface EstimateRow {
  id: string;
  project_name?: string | null;
  contractor?: string | null;
  total?: number | null;
  status?: string | null;
  items?: any;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function listEstimates(limit = 50): Promise<EstimateRow[]> {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listEstimates failed:', error);
    return [];
  }
  return (data ?? []) as EstimateRow[];
}

export interface DashboardKPIs {
  estimatesThisMonth: number;
  pendingValue: number;
  winRatePct: number | null;
  avgScanToQuoteSec: number | null;
}

export async function getDashboardKPIs(): Promise<DashboardKPIs | null> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [thisMonth, pending, winRows] = await Promise.all([
      supabase
        .from('estimates')
        .select('id, created_at, updated_at', { count: 'exact' })
        .gte('created_at', monthStart),
      supabase
        .from('estimates')
        .select('total, status')
        .in('status', ['draft', 'sent', 'viewed']),
      supabase
        .from('estimates')
        .select('status, created_at')
        .gte('created_at', thirtyDaysAgo)
        .in('status', ['approved', 'rejected']),
    ]);

    const estimatesThisMonth = thisMonth.count ?? thisMonth.data?.length ?? 0;

    const pendingValue = (pending.data ?? []).reduce(
      (sum: number, r: any) => sum + Number(r.total ?? 0),
      0
    );

    let winRatePct: number | null = null;
    const winData = winRows.data ?? [];
    const approved = winData.filter((r: any) => r.status === 'approved').length;
    const decided = winData.length;
    if (decided > 0) winRatePct = Math.round((approved / decided) * 100);

    let avgScanToQuoteSec: number | null = null;
    const monthData = thisMonth.data ?? [];
    const completed = monthData.filter(
      (r: any) => r.created_at && r.updated_at && r.created_at !== r.updated_at
    );
    if (completed.length > 0) {
      const totalSec = completed.reduce((sum: number, r: any) => {
        const c = new Date(r.created_at).getTime();
        const u = new Date(r.updated_at).getTime();
        return sum + Math.max(0, (u - c) / 1000);
      }, 0);
      avgScanToQuoteSec = Math.round(totalSec / completed.length);
    }

    return { estimatesThisMonth, pendingValue, winRatePct, avgScanToQuoteSec };
  } catch (err) {
    console.error('getDashboardKPIs failed:', err);
    return null;
  }
}

export async function saveEstimate(estimateData: {
  project_name: string;
  contractor: string;
  total: number;
  items: any[];
  status?: string;
}) {
  // 1. Save to Supabase
  const { data, error } = await supabase
    .from('estimates')
    .insert([{ ...estimateData, status: estimateData.status ?? 'draft' }])
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
