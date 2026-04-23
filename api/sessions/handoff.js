// POST /api/sessions/handoff
// Creates a handoff token and stores the session payload in Vercel KV
// (with a 600s TTL per §7). If @vercel/kv isn't configured at runtime,
// falls back to an in-memory store so local dev + preview builds work.

// KV is available only when env vars are set; every other path falls back to
// an in-memory store so dev, preview, and the static prototype all work.
const KV_CONFIGURED = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
let kv = null;
if (KV_CONFIGURED) {
  try {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  } catch (_) {
    kv = null;
  }
}

const memoryStore = globalThis.__handoffMemoryStore__ || new Map();
globalThis.__handoffMemoryStore__ = memoryStore;

const TTL_SECONDS = 600;

function generateSessionId() {
  const r = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ESC-${r()}-${r()}`;
}

async function kvSet(token, payload) {
  if (kv) {
    try {
      await kv.set(`handoff:${token}`, payload, { ex: TTL_SECONDS });
      return 'vercel-kv';
    } catch (e) {
      // Fall through to memory on any runtime KV failure.
      console.warn('KV set failed, falling back to memory', e?.message);
    }
  }
  const expiresAt = Date.now() + TTL_SECONDS * 1000;
  memoryStore.set(token, { payload, expiresAt });
  const t = setTimeout(() => memoryStore.delete(token), TTL_SECONDS * 1000);
  if (typeof t.unref === 'function') t.unref();
  return 'memory';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { route, projectId, estimateId, tabState } = body;

  if (!route) {
    res.status(400).json({ error: 'route is required' });
    return;
  }

  const token = generateSessionId();
  const payload = {
    route,
    projectId: projectId ?? null,
    estimateId: estimateId ?? null,
    tabState: tabState ?? null,
    snapshotAt: new Date().toISOString(),
  };

  let backend;
  try {
    backend = await kvSet(token, payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to persist handoff token', detail: String(err?.message || err) });
    return;
  }

  res.status(200).json({
    token,
    expiresInSeconds: TTL_SECONDS,
    snapshotAt: payload.snapshotAt,
    qrPayload: `/handoff?token=${encodeURIComponent(token)}`,
    backend,
  });
}
