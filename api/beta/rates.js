// Vesh rate library. Service role, scoped to Vesh or to rows with no tenant.
// Not available while sign-in is turned back on.

import {
  deleteVesh,
  firstRow,
  insertVesh,
  isUuid,
  readBody,
  readVesh,
  requireBeta,
  sendResult,
  updateVesh,
} from "../_lib/veshAdmin.js";

function ratePayload(body) {
  const code = String(body.code || "").trim();
  if (!code || code.length > 80 || /[,()*]/.test(code)) return null;
  const description = String(body.description || "").trim();
  if (!description) return null;
  return {
    code,
    category: String(body.category || "General").slice(0, 80),
    description: description.slice(0, 500),
    unit: String(body.unit || "ea").slice(0, 20),
    rate: Number(body.rate) || 0,
    labour: Number(body.labour) || 0,
    is_custom: Boolean(body.is_custom),
  };
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;

  if (req.method === "GET") {
    const result = await readVesh("rate_library", {
      order: "code.asc",
      limit: 500,
    });
    sendResult(res, result, { data: Array.isArray(result.data) ? result.data : [] });
    return;
  }

  if (req.method === "POST") {
    const payload = ratePayload(readBody(req));
    if (!payload) {
      res.status(400).json({ error: "Code and description are required." });
      return;
    }
    const existing = await readVesh("rate_library", {
      filters: { code: `eq.${payload.code}` },
      limit: 1,
    });
    if (!existing.ok) {
      sendResult(res, existing, { data: null });
      return;
    }
    const current = firstRow(existing);
    const saved = current?.id
      ? await updateVesh("rate_library", current.id, payload)
      : await insertVesh("rate_library", payload);
    const row = firstRow(saved);
    if (!saved.ok || !row) {
      sendResult(res, saved.ok ? { ...saved, ok: false, status: 502, error: "Rate was not saved." } : saved, { data: null });
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url || "/", "http://localhost").searchParams.get("id") || req.query?.id;
    if (!isUuid(id)) {
      res.status(400).json({ error: "A rate id is required." });
      return;
    }
    const result = await deleteVesh("rate_library", id);
    const row = firstRow(result);
    if (result.ok && !row) {
      res.status(404).json({ error: "That rate is not in this workspace." });
      return;
    }
    sendResult(res, result, { data: row });
    return;
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).json({ error: "Method not allowed" });
}
