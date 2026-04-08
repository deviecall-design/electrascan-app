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
