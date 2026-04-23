// GET /api/sessions/handoff/:token
// Validates the token, returns the stored session state, and invalidates
// the token (single-use per §7).

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

async function kvConsume(token) {
  if (kv) {
    try {
      const payload = await kv.get(`handoff:${token}`);
      if (payload) {
        await kv.del(`handoff:${token}`);
        return payload;
      }
    } catch (e) {
      console.warn('KV get failed, falling back to memory', e?.message);
    }
  }
  const entry = memoryStore.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(token);
    return null;
  }
  memoryStore.delete(token);
  return entry.payload;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { token } = req.query || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const payload = await kvConsume(token);
    if (!payload) {
      res.status(404).json({ error: 'Token expired or already used' });
      return;
    }
    res.status(200).json({ ok: true, session: payload });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read handoff token', detail: String(err?.message || err) });
  }
}
