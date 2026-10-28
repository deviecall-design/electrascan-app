// Vesh quotes. Allocates EST-YYMM-XXXX and writes with the service role.

import {
  adminRequest,
  firstRow,
  insertVesh,
  missingColumn,
  readBody,
  readVesh,
  requireBeta,
  sendResult,
  VESH_TENANT_ID,
} from "../_lib/veshAdmin.js";

const MAX_ATTEMPTS = 5;

function currentPrefix(now = new Date()) {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `EST-${yy}${mm}-`;
}

function nextReference(prefix, latest) {
  if (!latest) return `${prefix}0001`;
  const n = parseInt(String(latest).slice(prefix.length), 10);
  if (Number.isNaN(n)) return `${prefix}0001`;
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

function highest(rows, prefix) {
  let best = null;
  let n = -1;
  for (const row of rows || []) {
    for (const value of [row.reference, row.ref]) {
      if (typeof value !== "string" || !value.startsWith(prefix)) continue;
      const parsed = parseInt(value.slice(prefix.length), 10);
      if (!Number.isNaN(parsed) && parsed > n) {
        n = parsed;
        best = value;
      }
    }
  }
  return best;
}

async function latestReference(prefix) {
  const like = `${prefix}*`;
  const scoped = await adminRequest(
    `estimates?select=reference,ref&reference=like.${encodeURIComponent(like)}&or=(tenant_id.eq.${VESH_TENANT_ID},tenant_id.is.null)&order=reference.desc&limit=20`,
  );
  if (scoped.ok) return scoped;
  if (missingColumn(scoped, "tenant_id") || missingColumn(scoped, "reference")) {
    const plain = await adminRequest(
      `estimates?select=reference,ref&or=(reference.like.${encodeURIComponent(like)},ref.like.${encodeURIComponent(like)})&limit=40`,
    );
    if (plain.ok || !missingColumn(plain, "reference")) return plain;
    return adminRequest(
      `estimates?select=ref&ref=like.${encodeURIComponent(like)}&order=ref.desc&limit=20`,
    );
  }
  return scoped;
}

function quotePayload(body) {
  const status = body.status === "sent" ? "sent" : "draft";
  const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
  if (JSON.stringify(lineItems).length > 1_500_000) {
    return { error: "This quote is too large to save." };
  }
  return {
    row: {
      client: String(body.client || "Client not set").trim().slice(0, 200) || "Client not set",
      project_name: body.project_name ? String(body.project_name).slice(0, 200) : null,
      drawing_file: body.drawing_file ? String(body.drawing_file).slice(0, 500) : null,
      status,
      line_items: lineItems,
      days_since_sent: 0,
      subtotal: Number(body.subtotal) || 0,
      margin_pct: Number(body.margin_pct) || 0,
      value: Number(body.value) || 0,
    },
  };
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;

  if (req.method === "GET") {
    const result = await readVesh("estimates", {
      order: "created_at.desc",
      limit: 100,
    });
    sendResult(res, result, { data: Array.isArray(result.data) ? result.data : [] });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = quotePayload(readBody(req));
  if (parsed.error) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const prefix = currentPrefix();
  let lastError = "Could not save this quote.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const lookup = await latestReference(prefix);
    if (!lookup.ok) {
      sendResult(res, lookup, { data: null });
      return;
    }
    const reference = nextReference(prefix, highest(lookup.data, prefix));
    const saved = await insertVesh("estimates", {
      ...parsed.row,
      reference,
      ref: reference,
    });
    if (saved.ok) {
      const row = firstRow(saved);
      res.status(200).json({ reference, estimate: row, data: row });
      return;
    }
    const conflict = saved.status === 409 || String(saved.bodyText || saved.error || "").includes("23505");
    if (conflict) {
      lastError = "Reference allocation conflict. Retry.";
      continue;
    }
    sendResult(res, saved, { data: null });
    return;
  }

  res.status(409).json({ error: lastError });
}
