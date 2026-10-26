import { createPrivateKey } from 'crypto';
import { SignJWT } from 'jose';
import type { IncomingMessage, ServerResponse } from 'http';
import { envelopeSendBlockReason } from '../../lib/docusignSendGuard';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxeznkuodpseijkvjwxa.supabase.co';

const INTEGRATION_KEY = '9862c9dd-5aef-4595-afbe-3f5a8927eac1';
const ACCOUNT_ID = '4c745d31-2517-4815-9e8a-5e10fdda309c';
const USER_ID = '699ccba2-a16c-4e70-8f68-a353b7363609';
const DOCUSIGN_BASE = 'https://demo.docusign.net';
const DOCUSIGN_AUTH = 'account-d.docusign.com';

async function getAccessToken(): Promise<string> {
  const pem = process.env.DOCUSIGN_PRIVATE_KEY;
  if (!pem) throw new Error('DOCUSIGN_PRIVATE_KEY env var not set');

  const key = createPrivateKey(pem);

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(INTEGRATION_KEY)
    .setSubject(USER_ID)
    .setAudience(DOCUSIGN_AUTH)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const res = await fetch(`https://${DOCUSIGN_AUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DocuSign auth failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function authHeader(req: IncomingMessage): string {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

async function verifyCaller(auth: string, anon: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anon },
  });
  if (!res.ok) return false;
  const user = await res.json() as { id?: string };
  return Boolean(user?.id);
}

async function callerOwnsEstimate(auth: string, anon: string, reference: string): Promise<boolean> {
  const ref = reference.trim();
  if (!ref) return false;
  const url = `${SUPABASE_URL}/rest/v1/estimates?reference=eq.${encodeURIComponent(ref)}&select=id&limit=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: auth,
      apikey: anon,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return false;
  const rows = await res.json() as unknown;
  return Array.isArray(rows) && rows.length > 0;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  const auth = authHeader(req);
  if (!auth.startsWith('Bearer ')) {
    json(res, 401, { error: 'Sign in before sending a DocuSign envelope.' });
    return;
  }

  const anon = process.env.SUPABASE_ANON_KEY;
  if (!anon) {
    json(res, 503, { error: 'Sign-in check is not configured on the server.' });
    return;
  }

  try {
    const callerOk = await verifyCaller(auth, anon);
    if (!callerOk) {
      json(res, 401, { error: 'Session expired or invalid. Sign in again.' });
      return;
    }

    const body = await readBody(req);
    const { signerEmail, signerName, estimateRef, projectName, estimateValue, documentBase64, sample } =
      JSON.parse(body) as {
        signerEmail: string;
        signerName: string;
        estimateRef: string;
        projectName: string;
        estimateValue: number;
        documentBase64: string;
        sample?: boolean;
      };

    if (!signerEmail || !signerName || !documentBase64) {
      json(res, 400, { error: 'Missing required fields: signerEmail, signerName, documentBase64' });
      return;
    }

    const blockReason = envelopeSendBlockReason({
      signedIn: true,
      sample,
      estimateRef,
      documentBase64,
    });
    if (blockReason) {
      json(res, 403, { error: blockReason });
      return;
    }

    const owned = await callerOwnsEstimate(auth, anon, estimateRef ?? '');
    if (!owned) {
      json(res, 403, { error: 'DocuSign send is only available for a saved estimate on this account.' });
      return;
    }

    const accessToken = await getAccessToken();

    const envelope = {
      emailSubject: `Please sign: ${estimateRef} — ${projectName}`,
      documents: [
        {
          documentBase64,
          name: `${estimateRef} — ${projectName} Estimate`,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: signerEmail,
            name: signerName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  anchorString: '/sig1/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  // Fallback position if anchor not found
                  pageNumber: '1',
                  xPosition: '100',
                  yPosition: '700',
                },
              ],
              dateSignedTabs: [
                {
                  anchorString: '/date1/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  pageNumber: '1',
                  xPosition: '300',
                  yPosition: '700',
                },
              ],
            },
          },
        ],
      },
      status: 'sent',
    };

    const envelopeRes = await fetch(
      `${DOCUSIGN_BASE}/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelope),
      },
    );

    if (!envelopeRes.ok) {
      const err = await envelopeRes.text();
      throw new Error(`Envelope creation failed (${envelopeRes.status}): ${err}`);
    }

    const result = await envelopeRes.json() as {
      envelopeId: string;
      status: string;
      uri: string;
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      envelopeId: result.envelopeId,
      status: result.status,
      uri: result.uri,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[docusign/envelope]', message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}
