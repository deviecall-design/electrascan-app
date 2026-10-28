// Vesh quotes. Allocates EST-YYMM-XXXX and writes with the service role.

import {
  adminRequest,
  firstRow,
  insertVesh,
  isUuid,
  missingColumn,
  readBody,
  readVesh,
  requireBeta,
  sendResult,
  updateVesh,
  VESH_TENANT_ID,
} from "../_lib/veshAdmin.js";

const APPROVAL_TO_STATUS = {
  ready_for_approval: "draft",
  sent_for_signature: "sent",
  approved: "approved",
  materials_sent: "approved",
};

async function insertQuote(row) {
  let payload = { ...row };
  let saved = await insertVesh("estimates", payload);
  for (const column of ["verified_pct", "approval_status"]) {
    if (!saved.ok && missingColumn(saved, column)) {
      delete payload[column];
      payload = { ...payload };
      saved = await insertVesh("estimates", payload);
    }
  }
  return saved;
}

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
  const approval = APPROVAL_TO_STATUS[body.approval_status] ? body.approval_status : "ready_for_approval";
  const status = body.status === "sent" || body.status === "approved" || body.status === "viewed"
    ? body.status
    : APPROVAL_TO_STATUS[approval];
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
      approval_status: approval,
      line_items: lineItems,
      days_since_sent: 0,
      subtotal: Number(body.subtotal) || 0,
      margin_pct: Number(body.margin_pct) || 0,
      value: Number(body.value) || 0,
      ...(body.verified_pct == null || body.verified_pct === ""
        ? {}
        : { verified_pct: Math.max(0, Math.min(100, Math.round(Number(body.verified_pct)))) }),
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

  if (req.method === "PATCH") {
    const body = readBody(req);
    const approval = body.approval_status;
    if (!APPROVAL_TO_STATUS[approval]) {
      res.status(400).json({ error: "Choose a valid approval status." });
      return;
    }
    const reference = new URL(req.url || "/", "http://localhost").searchParams.get("reference") || body.reference;
    const idParam = new URL(req.url || "/", "http://localhost").searchParams.get("id") || req.query?.id;
    let id = isUuid(idParam) ? idParam : "";
    if (!id && reference) {
      const found = await adminRequest(
        `estimates?select=id&or=(reference.eq.${encodeURIComponent(reference)},ref.eq.${encodeURIComponent(reference)})&limit=1`,
      );
      id = firstRow(found)?.id || "";
    }
    if (!isUuid(id)) {
      res.status(404).json({ error: "That quote was not found." });
      return;
    }
    const patch = { approval_status: approval, status: APPROVAL_TO_STATUS[approval] };
    let saved = await updateVesh("estimates", id, patch);
    if (!saved.ok && missingColumn(saved, "approval_status")) {
      saved = await updateVesh("estimates", id, { status: APPROVAL_TO_STATUS[approval] });
    }
    const row = firstRow(saved);
    if (!saved.ok || !row) {
      sendResult(res, saved.ok ? { ok: false, status: 404, error: "That quote was not found." } : saved, { data: null });
      return;
    }
    res.status(200).json({ data: row, approval_status: approval });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, PATCH");
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
    const saved = await insertQuote({
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
