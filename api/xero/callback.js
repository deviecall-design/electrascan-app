// GET /api/xero/callback
//
// Handles the redirect from Xero after user authorisation. Steps:
//   1. Validate state cookie to prevent CSRF.
//   2. Exchange the authorisation code for tokens using PKCE verifier.
//   3. Call GET /connections to discover the active Xero tenant(s).
//   4. Upsert into xero_tokens (one row per org_id / xero_tenant_id pair).
//   5. Redirect the browser back to the app settings page.
//
// Required env vars:
//   XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI
//
// Optional:
//   NEXT_PUBLIC_APP_URL — used to build the post-connect redirect. Falls
//   back to deriving the origin from the incoming request Host header.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxeznkuodpseijkvjwxa.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

const VERIFIER_COOKIE = 'xero_pkce_verifier';
const STATE_COOKIE = 'xero_oauth_state';

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    }),
  );
}

function clearCookies() {
  const expired = 'HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/';
  return [
    `${VERIFIER_COOKIE}=; ${expired}`,
    `${STATE_COOKIE}=; ${expired}`,
  ];
}

function appOrigin(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

async function exchangeCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    client_id: process.env.XERO_CLIENT_ID,
    client_secret: process.env.XERO_CLIENT_SECRET,
    code_verifier: verifier,
  });

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${detail}`);
  }

  return res.json();
  // Returns: { access_token, refresh_token, expires_in, token_type, scope }
}

async function fetchConnections(accessToken) {
  // Xero returns an array of tenants the user has authorised this app for.
  // In a newly-connected org there is typically one entry.
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Connections fetch failed (${res.status})`);
  return res.json();
  // Returns: [{ id, tenantId, tenantType, tenantName, ... }]
}

async function upsertTokens({ org_id, access_token, refresh_token, expires_in, xero_tenant_id, xero_tenant_name }) {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot write tokens.');
  }

  // token_expiry = now + expires_in seconds (Xero access tokens live 30 min = 1800s)
  const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/xero_tokens`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      // ON CONFLICT (org_id, xero_tenant_id) DO UPDATE — handled by upsert preference.
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      org_id,
      xero_tenant_id,
      xero_tenant_name,
      access_token,
      refresh_token,
      token_expiry,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${detail}`);
  }

  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const storedState = cookies[STATE_COOKIE];
  const verifier = cookies[VERIFIER_COOKIE];

  const { code, state, error: xeroError, error_description } = req.query;

  // Always clear PKCE cookies regardless of outcome.
  res.setHeader('Set-Cookie', clearCookies());

  // Xero may redirect here with an error (e.g. user declined access).
  if (xeroError) {
    const origin = appOrigin(req);
    res.redirect(302, `${origin}/settings?xero=error&reason=${encodeURIComponent(error_description || xeroError)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state from Xero redirect' });
    return;
  }

  // CSRF guard: state must match what we put in the cookie.
  if (!storedState || state !== storedState) {
    res.status(400).json({ error: 'State mismatch — possible CSRF. Restart the connection flow.' });
    return;
  }

  if (!verifier) {
    res.status(400).json({ error: 'PKCE verifier cookie missing. Restart the connection flow.' });
    return;
  }

  // org_id was encoded as the segment after the dot in the state value.
  // Format: <random_nonce>.<org_id>
  const org_id = state.split('.').slice(1).join('.');
  if (!org_id) {
    res.status(400).json({ error: 'Could not extract org_id from state' });
    return;
  }

  let tokens;
  try {
    tokens = await exchangeCode(code, verifier);
  } catch (err) {
    res.status(502).json({ error: 'Token exchange failed', detail: err.message });
    return;
  }

  let connections;
  try {
    connections = await fetchConnections(tokens.access_token);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch Xero tenant list', detail: err.message });
    return;
  }

  if (!Array.isArray(connections) || connections.length === 0) {
    res.status(502).json({ error: 'No Xero organisations returned from /connections' });
    return;
  }

  // Upsert a token row for each authorised tenant. In practice, contractors
  // will have exactly one org, but we handle multiple gracefully.
  try {
    await Promise.all(
      connections.map(conn =>
        upsertTokens({
          org_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          xero_tenant_id: conn.tenantId,
          xero_tenant_name: conn.tenantName ?? null,
        }),
      ),
    );
  } catch (err) {
    res.status(500).json({ error: 'Failed to store Xero tokens', detail: err.message });
    return;
  }

  const origin = appOrigin(req);
  res.redirect(302, `${origin}/settings?xero=connected`);
}
