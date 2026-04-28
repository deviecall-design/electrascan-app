// POST /api/estimates/create
//
// Inserts a new row into the `estimates` table and stamps a
// EST-YYMM-XXXX reference. The sequence is per-owner per-month and
// is computed at insert time:
//
//   1. Build prefix from current UTC date: EST-YYMM-
//   2. Query the largest existing reference under that prefix, for
//      the calling owner, take the trailing 4 digits, increment.
//   3. Insert with the new reference. On 23505 (unique conflict) we
//      retry up to 5 times — that handles the race where two clients
//      pick the same number.
//
// Auth: forwards the caller's `Authorization: Bearer <jwt>` to the
// Supabase REST API so RLS sees the right `auth.uid()`. Without a
// JWT the endpoint returns 401 to prevent cross-tenant writes.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxeznkuodpseijkvjwxa.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_G18eiBCQd7apcIbTx4275Q_Kkbx8nFk';

const MAX_ATTEMPTS = 5;

function currentPrefix(now = new Date()) {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `EST-${yy}${mm}-`;
}

function nextReference(prefix, latest) {
  if (!latest) return `${prefix}0001`;
  const tail = latest.slice(prefix.length);
  const n = parseInt(tail, 10);
  if (Number.isNaN(n)) return `${prefix}0001`;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function supabaseFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing Authorization bearer token. Sign in before creating estimates.',
    });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  const prefix = currentPrefix();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Find the highest existing reference under this prefix for the caller.
    // PostgREST: reference=like.EST-2604-* ordered desc, limit 1.
    const lookup = await supabaseFetch(
      `estimates?select=reference&reference=like.${encodeURIComponent(prefix + '%')}&order=reference.desc&limit=1`,
      { headers: { Authorization: auth } },
    );
    if (!lookup.ok) {
      const errText = await lookup.text();
      res.status(502).json({ error: 'Failed to resolve reference sequence', detail: errText });
      return;
    }
    const lookupRows = await lookup.json();
    const latest = Array.isArray(lookupRows) && lookupRows[0] ? lookupRows[0].reference : null;
    const reference = nextReference(prefix, latest);

    const insert = await supabaseFetch('estimates', {
      method: 'POST',
      body: { ...body, reference },
      headers: {
        Authorization: auth,
        Prefer: 'return=representation',
      },
    });

    if (insert.ok) {
      const rows = await insert.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      res.status(200).json({ reference, estimate: row });
      return;
    }

    // 23505 = unique_violation. Another client claimed the same reference;
    // recompute and retry. Anything else is a hard failure.
    const detail = await insert.text();
    if (insert.status === 409 || detail.includes('23505')) {
      continue;
    }
    res.status(insert.status).json({ error: 'Failed to insert estimate', detail });
    return;
  }

  res.status(409).json({
    error: 'Reference allocation conflict — too many concurrent inserts. Retry.',
  });
}
