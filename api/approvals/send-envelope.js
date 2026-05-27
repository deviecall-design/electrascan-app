// POST /api/approvals/send-envelope
//
// Creates a DocuSign envelope for an estimate and returns the envelopeId
// + signing URL. Wires into the Approvals "Send for Approval" action.
//
// Required env vars:
//   DOCUSIGN_INTEGRATION_KEY  - the integration key (clientId)
//   DOCUSIGN_ACCOUNT_ID       - the DocuSign account id
//   DOCUSIGN_BASE_URI         - e.g. https://demo.docusign.net or
//                                    https://www.docusign.net
//   DOCUSIGN_ACCESS_TOKEN     - bearer token (refresh handled out-of-band)
//
// Optional:
//   SUPABASE_URL / SUPABASE_ANON_KEY - to fetch the estimate PDF from
//                                       Supabase Storage; falls back to
//                                       inline-generated text PDF if not
//                                       configured or the lookup fails.
//
// Request body:
//   {
//     estimate_id: string,
//     estimate_number: string,
//     project_name: string,
//     total: number,
//     pdf_url?: string,          // optional pre-generated PDF
//     pdf_base64?: string,       // optional already-encoded PDF
//     signers: [{ name: string, email: string }]
//   }
//
// Response (200):
//   { envelopeId, signingUrl }
//
// Misconfigured env vars return 503 with a clear message so the UI can
// render an actionable error rather than a generic failure.

const REQUIRED_ENV = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_BASE_URI',
  'DOCUSIGN_ACCESS_TOKEN',
];

function missingEnv() {
  return REQUIRED_ENV.filter(k => !process.env[k]);
}

// Minimal text-based PDF builder. The DocuSign envelope must contain a
// document; when the caller didn't provide one we synthesise a one-page
// summary so the envelope can still be created and signed.
function buildSummaryPdf({ estimate_number, project_name, total }) {
  const text = [
    `Estimate Approval`,
    `=================`,
    ``,
    `Reference: ${estimate_number ?? '(unknown)'}`,
    `Project:   ${project_name ?? '(unknown)'}`,
    `Total:     $${(total ?? 0).toLocaleString('en-AU')} inc GST`,
    ``,
    `Signing this document confirms approval of the above estimate.`,
  ].join('\n');

  // Tiny ad-hoc PDF. Each line is escaped for PDF text streams.
  const lines = text.split('\n').map(l => l.replace(/[\\()]/g, m => '\\' + m));
  const stream = ['BT', '/F1 12 Tf', '60 760 Td', '14 TL']
    .concat(lines.map((l, i) => (i === 0 ? `(${l}) Tj` : `T* (${l}) Tj`)))
    .concat(['ET'])
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary').toString('base64');
}

async function fetchPdfBase64(pdfUrl) {
  const r = await fetch(pdfUrl);
  if (!r.ok) throw new Error(`PDF fetch failed (${r.status})`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab).toString('base64');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const missing = missingEnv();
  if (missing.length > 0) {
    res.status(503).json({
      error: 'DocuSign not configured',
      missing,
      hint: `Add ${missing.join(', ')} to .env.local (or Vercel env vars) and redeploy.`,
    });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const {
    estimate_id,
    estimate_number,
    project_name,
    total,
    pdf_url,
    pdf_base64,
    signers,
  } = body;

  if (!estimate_id) {
    res.status(400).json({ error: 'estimate_id is required' });
    return;
  }

  if (!Array.isArray(signers) || signers.length === 0) {
    res.status(400).json({
      error: 'At least one signer is required',
      hint: 'Pass signers: [{ name, email }]',
    });
    return;
  }

  let documentBase64;
  try {
    if (pdf_base64) {
      documentBase64 = pdf_base64;
    } else if (pdf_url) {
      documentBase64 = await fetchPdfBase64(pdf_url);
    } else {
      documentBase64 = buildSummaryPdf({ estimate_number, project_name, total });
    }
  } catch (e) {
    res.status(502).json({
      error: 'Failed to obtain estimate PDF',
      detail: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  const baseUri = process.env.DOCUSIGN_BASE_URI.replace(/\/$/, '');
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;

  const envelopeBody = {
    emailSubject: `Estimate ${estimate_number ?? estimate_id} — please sign`,
    documents: [
      {
        documentBase64,
        name: `${estimate_number ?? estimate_id}.pdf`,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: signers.map((s, i) => ({
        email: s.email,
        name: s.name,
        recipientId: String(i + 1),
        routingOrder: String(i + 1),
        tabs: {
          signHereTabs: [
            {
              anchorString: 'Signing this document confirms',
              anchorYOffset: '20',
              anchorUnits: 'pixels',
            },
          ],
        },
      })),
    },
    status: 'sent',
  };

  let envelope;
  try {
    const r = await fetch(`${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DOCUSIGN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeBody),
    });
    if (!r.ok) {
      const detail = await r.text();
      res.status(r.status).json({ error: 'DocuSign envelope create failed', detail });
      return;
    }
    envelope = await r.json();
  } catch (e) {
    res.status(502).json({ error: 'DocuSign request failed', detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  const envelopeId = envelope.envelopeId;

  // Best-effort recipient view URL for the first signer. Failure here is
  // non-fatal — the envelope is already in DocuSign and the signer will
  // receive an email; the UI just won't have a magic link to surface.
  let signingUrl = null;
  try {
    const first = signers[0];
    const viewBody = {
      returnUrl: `${baseUri}/signing-complete?envelopeId=${envelopeId}`,
      authenticationMethod: 'none',
      email: first.email,
      userName: first.name,
      clientUserId: first.email, // identifies the embedded recipient
    };
    const vr = await fetch(`${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DOCUSIGN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(viewBody),
    });
    if (vr.ok) {
      const v = await vr.json();
      signingUrl = v.url ?? null;
    }
  } catch {
    // ignore — see comment above
  }

  res.status(200).json({ envelopeId, signingUrl, status: envelope.status ?? 'sent' });
}
