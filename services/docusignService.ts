// Client-side wrapper around /api/approvals/send-envelope.

export interface DocuSignSigner {
  name: string;
  email: string;
}

export interface SendEnvelopePayload {
  estimate_id: string;
  estimate_number?: string;
  project_name?: string;
  total?: number;
  pdf_url?: string;
  pdf_base64?: string;
  signers: DocuSignSigner[];
}

export interface SendEnvelopeResult {
  envelopeId: string;
  signingUrl: string | null;
  status: string;
}

export interface NotConfiguredError {
  reason: 'not_configured';
  missing: string[];
  hint: string;
}

export type SendEnvelopeResponse =
  | { ok: true; data: SendEnvelopeResult }
  | { ok: false; reason: 'not_configured'; missing: string[]; hint: string }
  | { ok: false; reason: 'error'; error: string };

export async function sendEnvelope(payload: SendEnvelopePayload): Promise<SendEnvelopeResponse> {
  let res: Response;
  try {
    res = await fetch('/api/approvals/send-envelope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, reason: 'error', error: e instanceof Error ? e.message : 'Network error' };
  }

  if (res.status === 503) {
    const detail = await res.json().catch(() => ({}));
    return {
      ok: false,
      reason: 'not_configured',
      missing: detail.missing ?? [],
      hint: detail.hint ?? 'Set DOCUSIGN_* env vars and redeploy.',
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, reason: 'error', error: detail || `HTTP ${res.status}` };
  }

  const data = (await res.json()) as SendEnvelopeResult;
  return { ok: true, data };
}
