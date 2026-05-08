// DocuSign envelope creation via JWT Bearer Grant.
//
// Sandbox/demo only. The RSA private key must be supplied via the
// DOCUSIGN_PRIVATE_KEY secret (Supabase Dashboard > Edge Functions > Secrets) —
// never bake it into source.

import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v5.2.2/index.ts";

const INTEGRATION_KEY = "9862c9dd-5aef-4595-afbe-3f5a8927eac1";
const ACCOUNT_ID = "4c745d31-2517-4815-9e8a-5e10fdda309c";
const USER_ID = "699ccba2-a16c-4e70-8f68-a353b7363609";

const AUTH_HOST = "https://account-d.docusign.com";
const API_BASE = "https://demo.docusign.net/restapi/v2.1";
const JWT_SCOPE = "signature impersonation";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

interface EnvelopeRequest {
  signerEmail: string;
  signerName: string;
  estimateRef: string;
  projectName: string;
  estimateValue: number;
  documentBase64: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const pem = Deno.env.get("DOCUSIGN_PRIVATE_KEY");
  if (!pem) {
    throw new Error("DOCUSIGN_PRIVATE_KEY env var is not set");
  }

  // jose's importPKCS8 expects the PKCS#8 PEM. The DocuSign downloaded key is
  // in PKCS#8 form (BEGIN PRIVATE KEY). Normalise CRLF/escaped newlines.
  const normalisedPem = pem.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  const privateKey = await importPKCS8(normalisedPem, "RS256");

  const issuedAt = Math.floor(now / 1000);
  const jwt = await new SignJWT({ scope: JWT_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(INTEGRATION_KEY)
    .setSubject(USER_ID)
    .setAudience("account-d.docusign.com")
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(privateKey);

  const tokenRes = await fetch(`${AUTH_HOST}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(
      `DocuSign token exchange failed (${tokenRes.status}): ${text}`,
    );
  }

  const tokenJson = await tokenRes.json() as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: tokenJson.access_token,
    expiresAt: now + tokenJson.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

function validateRequest(body: unknown): EnvelopeRequest | string {
  if (!body || typeof body !== "object") return "Invalid JSON body";
  const b = body as Record<string, unknown>;
  const required: Array<keyof EnvelopeRequest> = [
    "signerEmail",
    "signerName",
    "estimateRef",
    "projectName",
    "documentBase64",
  ];
  for (const k of required) {
    if (typeof b[k] !== "string" || !(b[k] as string).length) {
      return `Missing or invalid field: ${k}`;
    }
  }
  if (typeof b.estimateValue !== "number") {
    return "Missing or invalid field: estimateValue";
  }
  return {
    signerEmail: b.signerEmail as string,
    signerName: b.signerName as string,
    estimateRef: b.estimateRef as string,
    projectName: b.projectName as string,
    estimateValue: b.estimateValue as number,
    documentBase64: b.documentBase64 as string,
  };
}

async function createEnvelope(
  accessToken: string,
  req: EnvelopeRequest,
): Promise<{ envelopeId: string; status: string; uri: string }> {
  const envelopeDefinition = {
    emailSubject: `Please sign: ${req.estimateRef} — ${req.projectName}`,
    documents: [
      {
        documentBase64: req.documentBase64,
        name: `${req.estimateRef}.pdf`,
        fileExtension: "pdf",
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: req.signerEmail,
          name: req.signerName,
          recipientId: "1",
          routingOrder: "1",
          tabs: {
            signHereTabs: [
              {
                anchorString: "/sig1/",
                anchorUnits: "pixels",
                anchorXOffset: "0",
                anchorYOffset: "0",
                documentId: "1",
                pageNumber: "1",
                xPosition: "100",
                yPosition: "700",
              },
            ],
          },
        },
      ],
    },
    status: "sent",
  };

  const res = await fetch(
    `${API_BASE}/accounts/${ACCOUNT_ID}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeDefinition),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `DocuSign envelope create failed (${res.status}): ${text}`,
    );
  }

  const json = await res.json() as {
    envelopeId: string;
    status: string;
    uri: string;
  };
  return json;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsed = validateRequest(body);
  if (typeof parsed === "string") {
    return jsonResponse({ error: parsed }, 400);
  }

  try {
    const token = await getAccessToken();
    const envelope = await createEnvelope(token, parsed);
    return jsonResponse({
      envelopeId: envelope.envelopeId,
      status: envelope.status,
      uri: envelope.uri,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
