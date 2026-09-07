// POST /api/detect
//
// Server-side proxy for the two Claude Vision detection passes.
//
// Why this exists: analyze_pdf.ts used to construct an Anthropic client in the
// browser with `dangerouslyAllowBrowser: true`, reading the key from
// VITE_ANTHROPIC_API_KEY. Vite inlines every VITE_-prefixed variable into the
// public bundle, so the key was downloadable by anyone who opened the app and
// had to be rotated repeatedly. The key now lives only here, as
// ANTHROPIC_API_KEY (no VITE_ prefix), and never reaches the client.
//
// Auth: requires the caller's Supabase `Authorization: Bearer <jwt>`, verified
// against Supabase before any upstream call. Without this the endpoint would be
// an open, unmetered Claude proxy for anyone who found the URL.
//
// Env:
//   ANTHROPIC_API_KEY  (required) — server-side only, must NOT be VITE_-prefixed
//   SUPABASE_URL       (optional) — defaults to the project URL below

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxeznkuodpseijkvjwxa.supabase.co';
// Publishable (anon) key — safe in source, same default as api/estimates/create.js.
// Defaulting it here means ANTHROPIC_API_KEY is the only variable that must be
// configured for detection to work.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_G18eiBCQd7apcIbTx4275Q_Kkbx8nFk';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Only models this app is meant to spend on. Keeps a stolen JWT from being used
// to run arbitrary jobs on the account.
const ALLOWED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5']);
const MAX_TOKENS_CAP = 16000;
const MAX_IMAGES = 12;

async function verifyCaller(auth) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Explicit rather than a confusing 401 from upstream. If this fires, the
    // env var is missing in Vercel for this environment.
    res.status(500).json({
      error: 'Detection is not configured: ANTHROPIC_API_KEY is not set on the server.',
    });
    return;
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in before running a scan.' });
    return;
  }

  const caller = await verifyCaller(auth);
  if (!caller) {
    res.status(401).json({ error: 'Session expired or invalid. Sign in again.' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { model, max_tokens: maxTokens, system, messages } = body;

  if (!ALLOWED_MODELS.has(model)) {
    res.status(400).json({ error: `Model not permitted: ${model}` });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array' });
    return;
  }

  // Cap the image count so one request cannot fan out into a huge vision bill.
  const imageCount = messages.reduce((n, m) => {
    const content = Array.isArray(m.content) ? m.content : [];
    return n + content.filter(b => b && b.type === 'image').length;
  }, 0);
  if (imageCount > MAX_IMAGES) {
    res.status(413).json({
      error: `Drawing has too many pages for one scan (${imageCount}; limit ${MAX_IMAGES}). Split the PDF and scan in parts.`,
    });
    return;
  }

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(Number(maxTokens) || 4096, MAX_TOKENS_CAP),
        ...(system ? { system } : {}),
        messages,
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      // Pass the upstream status and message through so the client can show a
      // real reason. A retired model id, for example, arrives here as a 404
      // with not_found_error — which previously surfaced only as "0 components".
      res.status(upstream.status).json({
        error: 'Detection request failed upstream.',
        status: upstream.status,
        detail: text.slice(0, 1000),
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (err) {
    res.status(502).json({ error: 'Could not reach the detection service.', detail: String(err && err.message) });
  }
}
