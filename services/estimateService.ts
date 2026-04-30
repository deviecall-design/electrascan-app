import { supabase } from './supabaseClient';
import type { CableRun, EstimateLineItem } from '../contexts/ProjectContext';

const N8N_WEBHOOK_URL = 'https://damienc13.app.n8n.cloud/webhook/electrascan-estimate';

export interface WholesalerQuoteRequestPayload {
  estimate_id: string;
  estimate_ref: string;
  project_name: string;
  wholesaler: string;
  wholesaler_email: string;
  cable_runs: Array<
    Pick<CableRun, 'cableType' | 'lengthMeters' | 'wasteFactorPct' | 'totalLength'> & {
      unit_price: number;
      line_total: number;
    }
  >;
  line_items: Array<Pick<EstimateLineItem, 'description' | 'category' | 'qty' | 'unit'>>;
  notes: string;
  tenant: string;
  sent_at: string;
}

export async function sendWholesalerQuoteRequest(
  payload: WholesalerQuoteRequestPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'wholesaler_quote_request', ...payload }),
    });
    if (!res.ok) return { ok: false, error: `Webhook returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function saveEstimate(estimateData: {
  project_name: string;
  contractor: string;
  value: number;
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
        value: data.value,
        createdAt: data.created_at
      })
    });
  } catch (webhookError) {
    // Don't block the save if webhook fails
    console.error('n8n webhook failed:', webhookError);
  }

  return data;
}
