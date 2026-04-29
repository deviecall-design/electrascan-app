import { createPrivateKey } from 'crypto';
import { SignJWT } from 'jose';
import type { IncomingMessage, ServerResponse } from 'http';

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
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readBody(req);
    const { signerEmail, signerName, estimateRef, projectName, estimateValue, documentBase64 } =
      JSON.parse(body) as {
        signerEmail: string;
        signerName: string;
        estimateRef: string;
        projectName: string;
        estimateValue: number;
        documentBase64: string;
      };

    if (!signerEmail || !signerName || !documentBase64) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required fields: signerEmail, signerName, documentBase64' }));
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
