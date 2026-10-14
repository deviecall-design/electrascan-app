// POST /api/detect
//
// Server-side proxy for the two Claude Vision detection passes.
//
// The browser used to call Anthropic directly. That inlined the key into the
// public JS bundle. The key now lives only in the server environment as
// ANTHROPIC_API_KEY. This route must never read VITE_ or NEXT_PUBLIC_ names:
// Vite ships every VITE_ variable to the client.
//
// Env (set in Vercel, not in the repo):
//   ANTHROPIC_API_KEY   required, server-only
//   SUPABASE_URL        optional, defaults to the project URL below
//   SUPABASE_ANON_KEY   optional, defaults to the publishable key below
//   KV_REST_API_URL     optional, shared rate-limit counter when present
//   KV_REST_API_TOKEN   optional, pair for the URL above

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxeznkuodpseijkvjwxa.supabase.co';
// Publishable (anon) key — safe in source, same default as api/estimates/create.js.
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_G18eiBCQd7apcIbTx4275Q_Kkbx8nFk';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Only models this app is meant to spend on. A stolen session cannot be used
// to run arbitrary jobs on the account.
const ALLOWED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5']);
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const LIMITS = {
  maxBodyBytes: 4_200_000,
  maxTokens: 16000,
  maxImages: 48,
  maxMessages: 2,
  maxSystemChars: 80_000,
  maxTextChars: 20_000,
  maxTextBlocks: 8,
  maxImageChars: 3_800_000,
  maxTotalImageChars: 3_600_000,
  rateWindowMs: 10 * 60 * 1000,
  rateMax: 30,
  maxAuthHeader: 8192,
};

const KV_CONFIGURED = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
let kv = null;
if (KV_CONFIGURED) {
  try {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  } catch {
    kv = null;
  }
}

function fail(status, error) {
  return { ok: false, status, error };
}

function header(req, name) {
  const headers = req.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()] ?? '';
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

/** Strip anything that looks like an Anthropic key before it can reach the client. */
export function redactSecrets(text) {
  return String(text ?? '').replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]');
}

export function resetDetectRateLimit() {
  globalThis.__electrascanDetectRate__ = new Map();
}

export function takeRateLimitSlot(userId, now = Date.now()) {
  const store = globalThis.__electrascanDetectRate__ || (globalThis.__electrascanDetectRate__ = new Map());
  const recent = (store.get(userId) || []).filter((t) => now - t < LIMITS.rateWindowMs);
  if (recent.length >= LIMITS.rateMax) {
    const retryAfter = Math.max(1, Math.ceil((LIMITS.rateWindowMs - (now - recent[0])) / 1000));
    return { ok: false, retryAfter };
  }
  recent.push(now);
  store.set(userId, recent);
  if (store.size > 5000) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  return { ok: true };
}

async function takeSharedRateLimit(userId) {
  if (!kv) return { ok: true };
  const key = `detect-rl:${userId}`;
  try {
    const n = await kv.incr(key);
    if (n === 1) await kv.expire(key, Math.ceil(LIMITS.rateWindowMs / 1000));
    if (n > LIMITS.rateMax) {
      return { ok: false, retryAfter: Math.ceil(LIMITS.rateWindowMs / 1000) };
    }
    return { ok: true };
  } catch {
    // KV blips must not take scanning down. The in-memory slot still applies.
    return { ok: true };
  }
}

function isBase64(value) {
  return typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/**
 * Accept only the detection payload the scanner sends, and return a cleaned
 * body. Extra fields (tools, metadata, custom URLs) are dropped so they never
 * reach Anthropic.
 */
export function validateDetectRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'Request body must be a JSON object.');
  }
  if (typeof body.model !== 'string' || !ALLOWED_MODELS.has(body.model)) {
    return fail(400, 'Model not permitted.');
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > LIMITS.maxMessages) {
    return fail(400, 'messages must be a non-empty array.');
  }

  let system;
  if (body.system != null) {
    if (typeof body.system !== 'string') return fail(400, 'system must be a string.');
    if (body.system.length > LIMITS.maxSystemChars) return fail(400, 'system prompt is too long.');
    system = body.system;
  }

  let maxTokens = 4096;
  if (body.max_tokens != null) {
    const requested = Number(body.max_tokens);
    if (!Number.isFinite(requested)) return fail(400, 'max_tokens must be a number.');
    maxTokens = Math.min(LIMITS.maxTokens, Math.max(1, Math.floor(requested)));
  }

  const messages = [];
  let imageCount = 0;
  let totalImageChars = 0;

  for (const message of body.messages) {
    if (!message || typeof message !== 'object' || message.role !== 'user') {
      return fail(400, 'Only user messages are accepted.');
    }
    if (!Array.isArray(message.content) || message.content.length === 0) {
      return fail(400, 'Each message needs a content array.');
    }
    if (message.content.length > LIMITS.maxImages + LIMITS.maxTextBlocks) {
      return fail(400, 'Too many content blocks in one message.');
    }

    const content = [];
    let textBlocks = 0;
    for (const block of message.content) {
      if (!block || typeof block !== 'object') return fail(400, 'Invalid content block.');
      if (block.type === 'text') {
        textBlocks += 1;
        if (textBlocks > LIMITS.maxTextBlocks) return fail(400, 'Too many text blocks.');
        if (typeof block.text !== 'string' || block.text.length === 0) {
          return fail(400, 'Text blocks must be non-empty strings.');
        }
        if (block.text.length > LIMITS.maxTextChars) return fail(400, 'A text block is too long.');
        content.push({ type: 'text', text: block.text });
        continue;
      }
      if (block.type === 'image') {
        const source = block.source;
        if (!source || source.type !== 'base64' || !ALLOWED_MEDIA.has(source.media_type)) {
          return fail(400, 'Images must be base64 JPEG, PNG, GIF, or WebP.');
        }
        if (!isBase64(source.data)) return fail(400, 'Image data must be base64.');
        if (source.data.length > LIMITS.maxImageChars) return fail(413, 'An image is too large to scan.');
        imageCount += 1;
        totalImageChars += source.data.length;
        if (imageCount > LIMITS.maxImages) {
          return fail(
            413,
            `Drawing has too many pages for one scan (${imageCount}; limit ${LIMITS.maxImages}). Split the PDF and scan in parts.`,
          );
        }
        if (totalImageChars > LIMITS.maxTotalImageChars) {
          return fail(413, 'Drawing is too large to scan in one request. Split the PDF and scan in parts.');
        }
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: source.media_type, data: source.data },
        });
        continue;
      }
      return fail(400, 'Only text and image content are accepted.');
    }
    messages.push({ role: 'user', content });
  }

  return {
    ok: true,
    payload: {
      model: body.model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    },
  };
}

function readBody(req) {
  const declared = Number(header(req, 'content-length') || 0);
  if (Number.isFinite(declared) && declared > LIMITS.maxBodyBytes) {
    return { ok: false, status: 413, error: 'Request body is too large.' };
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const measured = typeof req.body === 'string' ? req.body.length : JSON.stringify(body).length;
    if (measured > LIMITS.maxBodyBytes) {
      return { ok: false, status: 413, error: 'Request body is too large.' };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, status: 400, error: 'Request body must be JSON.' };
  }
}

async function verifyCaller(auth) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

function send(res, status, payload, extraHeaders) {
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  }
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  const parsed = readBody(req);
  if (!parsed.ok) {
    send(res, parsed.status, { error: parsed.error });
    return;
  }

  const auth = header(req, 'authorization');
  if (!auth.startsWith('Bearer ') || auth.length > LIMITS.maxAuthHeader) {
    send(res, 401, { error: 'Sign in before running a scan.' });
    return;
  }

  const caller = await verifyCaller(auth);
  if (!caller) {
    send(res, 401, { error: 'Session expired or invalid. Sign in again.' });
    return;
  }

  const validated = validateDetectRequest(parsed.body);
  if (!validated.ok) {
    send(res, validated.status, { error: validated.error });
    return;
  }

  // Server-only. Do not fall back to VITE_ / NEXT_PUBLIC_ names.
  // Checked before the rate limit so a missing key does not burn the user's quota.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    send(res, 500, {
      error: 'Detection is not configured: ANTHROPIC_API_KEY is not set on the server.',
    });
    return;
  }

  const localSlot = takeRateLimitSlot(caller.id);
  if (!localSlot.ok) {
    send(res, 429, { error: 'Too many detection requests. Wait a moment and try again.' }, {
      'Retry-After': String(localSlot.retryAfter),
    });
    return;
  }
  const sharedSlot = await takeSharedRateLimit(caller.id);
  if (!sharedSlot.ok) {
    send(res, 429, { error: 'Too many detection requests. Wait a moment and try again.' }, {
      'Retry-After': String(sharedSlot.retryAfter),
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
      body: JSON.stringify(validated.payload),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      send(res, upstream.status, {
        error: 'Detection request failed upstream.',
        status: upstream.status,
        detail: redactSecrets(text).slice(0, 1000),
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch {
    send(res, 502, { error: 'Could not reach the detection service.' });
  }
}
