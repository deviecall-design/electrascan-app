// GET /api/xero/auth
//
// Initiates the Xero OAuth 2.0 PKCE flow. Generates a code_verifier,
// derives a code_challenge (S256), stores the verifier in a short-lived
// cookie, and redirects the browser to Xero's authorisation endpoint.
//
// Required env vars:
//   XERO_CLIENT_ID     - the Xero app's client ID
//   XERO_REDIRECT_URI  - must exactly match what's registered in Xero developer portal
//
// The state param encodes the calling org_id so the callback can associate
// the token with the right tenant row. Pass ?org_id=<uuid> when linking.

import crypto from 'crypto';

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';

// Scopes needed for invoice creation + contact reads.
const SCOPES = [
  'openid',
  'profile',
  'email',
  'accounting.transactions',
  'accounting.contacts',
  'offline_access', // required for Xero to issue a refresh token
].join(' ');

const VERIFIER_COOKIE = 'xero_pkce_verifier';
const STATE_COOKIE = 'xero_oauth_state';
// Cookies expire in 10 minutes — long enough for any interactive flow.
const COOKIE_MAX_AGE = 600;

function base64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateVerifier() {
  // 32 random bytes → 43-character base64url string, within the 43-128 char PKCE spec.
  return base64urlEncode(crypto.randomBytes(32));
}

function deriveChallenge(verifier) {
  // S256: SHA-256 of the ASCII verifier, base64url-encoded.
  return base64urlEncode(crypto.createHash('sha256').update(verifier, 'ascii').digest());
}

function missingEnv() {
  return ['XERO_CLIENT_ID', 'XERO_REDIRECT_URI'].filter(k => !process.env[k]);
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const missing = missingEnv();
  if (missing.length > 0) {
    res.status(503).json({
      error: 'Xero not configured',
      missing,
      hint: `Add ${missing.join(', ')} to Vercel env vars and redeploy.`,
    });
    return;
  }

  const { org_id } = req.query;
  if (!org_id) {
    res.status(400).json({ error: 'org_id query param is required' });
    return;
  }

  const verifier = generateVerifier();
  const challenge = deriveChallenge(verifier);
  // State is a random nonce + the org_id so the callback can validate
  // the round-trip and know which tenant to update.
  const state = `${base64urlEncode(crypto.randomBytes(16))}.${org_id}`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  // Store verifier + state in HttpOnly cookies. The callback reads them to
  // validate CSRF (state) and complete the PKCE exchange (verifier).
  const cookieOpts = `HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`;
  res.setHeader('Set-Cookie', [
    `${VERIFIER_COOKIE}=${verifier}; ${cookieOpts}`,
    `${STATE_COOKIE}=${state}; ${cookieOpts}`,
  ]);

  res.redirect(302, `${XERO_AUTH_URL}?${params.toString()}`);
}
