import { supabase } from './supabaseClient';

const N8N_WEBHOOK_URL = 'https://damienc13.app.n8n.cloud/webhook/electrascan-estimate';

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

// TODO: Supabase schema for variation_reports table:
//   id: uuid (PK)
//   project_name: text
//   base_estimate_number: text
//   base_total: numeric
//   new_total: numeric
//   delta: numeric
//   pct_change: numeric
//   variation_items: jsonb (array of {description, prevQty, newQty, unitPrice, change})
//   risks: jsonb (array of {level, title, description})
//   created_at: timestamptz
//   status: text (default 'draft')
// RLS: insert/select for authenticated users only
export async function saveVariationReport(reportData: {
  project_name: string;
  base_estimate_number: string;
  base_total: number;
  new_total: number;
  delta: number;
  pct_change: number;
  variation_items: any[];
  risks: any[];
}) {
  const { data, error } = await supabase
    .from('variation_reports')
    .insert([{ ...reportData, status: 'draft' }])
    .select()
    .single();

  if (error) {
    console.error('Supabase variation save failed:', error);
    throw error;
  }

  // Trigger n8n webhook for variation report notifications
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'variation_report',
        variationId: data.id,
        project_name: data.project_name,
        base_estimate_number: data.base_estimate_number,
        delta: data.delta,
        pct_change: data.pct_change,
        createdAt: data.created_at,
      })
    });
  } catch (webhookError) {
    console.error('n8n webhook failed:', webhookError);
  }

  return data;
}
