import { supabase } from './supabaseClient';
import type { CableRun, EstimateLineItem } from '../contexts/ProjectContext';
import { buildTleBom } from './tleMatcher';

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
  line_items: Array<Pick<EstimateLineItem, 'description' | 'category' | 'qty' | 'unit'> & { unit_price: number; line_total: number }>;
  // TLE-matched BOM — only items TLE can supply, with SKU attached
  tle_matched_bom?: Array<{
    description: string; category: string; qty: number; unit_price: number;
    line_total: number; tle_sku: string; tle_product: string;
    match_status: string; confidence: number;
  }>;
  tle_sourced_elsewhere?: string[]; // descriptions of items not at TLE
  notes: string;
  tenant: string;
  sent_at: string;
}

// Sends a TLE-specific quote request with fuzzy-matched BOM.
// Items not stocked at TLE (ZETR etc.) are excluded from tle_matched_bom
// and listed in tle_sourced_elsewhere so the electrician knows to source them elsewhere.
export async function sendTleQuoteRequest(
  payload: Omit<WholesalerQuoteRequestPayload, 'tle_matched_bom' | 'tle_sourced_elsewhere'>,
  lineItemUnitPrices: Record<string, number>,
  allLineItems: EstimateLineItem[],
): Promise<{ ok: true; matched: number; excluded: number } | { ok: false; error: string }> {
  try {
    const tleBom = await buildTleBom(allLineItems, lineItemUnitPrices);
    const matchedIds = new Set(tleBom.map(b => b.description));
    const sourceElsewhere = allLineItems
      .filter(i => !matchedIds.has(i.description))
      .map(i => i.description);

    const enrichedPayload: WholesalerQuoteRequestPayload = {
      ...payload,
      wholesaler: 'TLE Brookvale',
      wholesaler_email: payload.wholesaler_email || 'brookvale@tle.mmem.com.au',
      tle_matched_bom: tleBom,
      tle_sourced_elsewhere: sourceElsewhere,
    };

    const result = await sendWholesalerQuoteRequest(enrichedPayload);
    if (!result.ok) return { ok: false, error: (result as { ok: false; error: string }).error };
    return { ok: true, matched: tleBom.length, excluded: sourceElsewhere.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
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
  const { data: userData } = await supabase.auth.getUser();
  const ownerId = userData?.user?.id ?? null;

  // 1. Save to Supabase
  const { data, error } = await supabase
    .from('estimates')
    .insert([{
      ...estimateData,
      status: estimateData.status ?? 'draft',
      ...(ownerId ? { owner_id: ownerId } : {}),
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
