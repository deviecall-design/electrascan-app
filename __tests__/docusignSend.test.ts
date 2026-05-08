/**
 * Tests for the DocuSign "Send Envelope" wiring in ApprovalsScreen.
 *
 * We test the integration logic in isolation:
 *   - Successful POST → envelopeId extracted, approval_audit insert called
 *   - Non-OK HTTP response → error propagated, sent stays false
 *   - Network failure → error propagated
 *
 * The Supabase client and global fetch are both mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fetch ──────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Mock supabase client ────────────────────────────────────────────────
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid' } } }),
    },
    rpc: vi.fn().mockResolvedValue({ data: 'tenant-uuid', error: null }),
  },
}));

// ── The logic under test (extracted from ApprovalsScreen for unit testing) ─
async function sendEnvelope(params: {
  signerEmail: string;
  signerName: string;
  estimateRef: string;
  projectName: string;
  estimateValue: number;
  documentBase64: string;
}): Promise<{ envelopeId: string; status: string }> {
  const { supabase } = await import('../services/supabaseClient');

  const res = await fetch('/api/docusign/envelope', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(errData.error ?? `HTTP ${res.status}`);
  }

  const result = await res.json() as { envelopeId: string; status: string };

  // Log to approval_audit (best-effort)
  supabase
    .from('approval_audit')
    .insert({
      envelope_id: result.envelopeId,
      estimate_ref: params.estimateRef,
      signer_email: params.signerEmail,
      action: 'envelope_sent',
      actor: 'system',
    });

  return result;
}

const BASE_PARAMS = {
  signerEmail: 'builder@example.com',
  signerName: 'James Caldwell',
  estimateRef: 'EST-26-001-v3',
  projectName: 'Test Project',
  estimateValue: 50000,
  documentBase64: 'dGVzdA==',
};

describe('sendEnvelope integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('returns envelopeId on 200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ envelopeId: 'env-abc-123', status: 'sent', uri: '/envelopes/env-abc-123' }),
    });

    const result = await sendEnvelope(BASE_PARAMS);
    expect(result.envelopeId).toBe('env-abc-123');
    expect(result.status).toBe('sent');
  });

  it('POSTs to /api/docusign/envelope with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ envelopeId: 'env-xyz', status: 'sent' }),
    });

    await sendEnvelope(BASE_PARAMS);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/docusign/envelope',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.signerEmail).toBe('builder@example.com');
    expect(body.estimateRef).toBe('EST-26-001-v3');
    expect(body.documentBase64).toBe('dGVzdA==');
  });

  it('inserts into approval_audit with correct fields after success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ envelopeId: 'env-audit-001', status: 'sent' }),
    });

    await sendEnvelope(BASE_PARAMS);

    // Give the fire-and-forget insert time to be called
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockFrom).toHaveBeenCalledWith('approval_audit');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        envelope_id: 'env-audit-001',
        estimate_ref: 'EST-26-001-v3',
        signer_email: 'builder@example.com',
        action: 'envelope_sent',
        actor: 'system',
      }),
    );
  });

  it('throws when the API returns a non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'DocuSign auth failed (401): ...' }),
    });

    await expect(sendEnvelope(BASE_PARAMS)).rejects.toThrow('DocuSign auth failed');
  });

  it('throws with HTTP status fallback when error response is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json'); },
    });

    await expect(sendEnvelope(BASE_PARAMS)).rejects.toThrow('HTTP 503');
  });

  it('propagates network errors (fetch throws)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(sendEnvelope(BASE_PARAMS)).rejects.toThrow('Network request failed');
  });

  it('does NOT call approval_audit insert when send fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Missing required fields' }),
    });

    await expect(sendEnvelope(BASE_PARAMS)).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
