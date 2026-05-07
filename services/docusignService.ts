export interface DocuSignEnvelopeRequest {
  signerEmail: string;
  signerName: string;
  estimateRef: string;
  projectName: string;
  estimateValue: number;
  documentBase64: string;
}

export type DocuSignEnvelopeResult =
  | { ok: true; envelopeId: string; status: string }
  | { ok: false; error: string };

export async function sendEstimateForSigning(
  req: DocuSignEnvelopeRequest,
): Promise<DocuSignEnvelopeResult> {
  try {
    const res = await fetch('/api/docusign/envelope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON response
    }

    if (!res.ok) {
      const errorMsg =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : `DocuSign request failed (${res.status})`;
      return { ok: false, error: errorMsg };
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'envelopeId' in payload &&
      'status' in payload
    ) {
      const p = payload as { envelopeId: string; status: string };
      return { ok: true, envelopeId: p.envelopeId, status: p.status };
    }

    return { ok: false, error: 'Malformed response from API' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
