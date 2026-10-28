// Vesh scans. Create, list, fetch, and update without a user JWT.

import {
  firstRow,
  insertVesh,
  isUuid,
  readBody,
  readVesh,
  requireBeta,
  sendResult,
  updateVesh,
} from "../_lib/veshAdmin.js";

const MAX_JSON = 1_500_000;

function jsonList(value, label) {
  if (!Array.isArray(value)) return { error: `${label} must be a list.` };
  if (JSON.stringify(value).length > MAX_JSON) return { error: "This scan is too large to save." };
  return { value };
}

function scanPayload(body, { requireName }) {
  const row = {};
  if (requireName || body.file_name != null) {
    const fileName = String(body.file_name || "").trim();
    if (!fileName) return { error: "A file name is required." };
    if (fileName.length > 500) return { error: "File name is too long." };
    row.file_name = fileName;
  }
  if (body.client !== undefined) {
    row.client = body.client == null || body.client === "" ? null : String(body.client).slice(0, 200);
  }
  if (body.stage !== undefined) row.stage = String(body.stage || "review").slice(0, 40);
  if (body.detected_items !== undefined) {
    const parsed = jsonList(body.detected_items, "Detected items");
    if (parsed.error) return parsed;
    row.detected_items = parsed.value;
  }
  if (body.risk_flags !== undefined) {
    const parsed = jsonList(body.risk_flags, "Risk flags");
    if (parsed.error) return parsed;
    row.risk_flags = parsed.value;
  }
  if (body.items_detected !== undefined) {
    row.items_detected = Math.max(0, Math.round(Number(body.items_detected) || 0));
  } else if (requireName) {
    row.items_detected = Array.isArray(row.detected_items) ? row.detected_items.length : 0;
  }
  if (body.progress !== undefined) {
    row.progress = Math.min(100, Math.max(0, Number(body.progress) || 0));
  } else if (requireName) {
    row.progress = 0;
  }
  if (body.estimate_ref !== undefined) {
    row.estimate_ref = body.estimate_ref ? String(body.estimate_ref).slice(0, 40) : null;
  }
  if (requireName) {
    if (row.stage == null) row.stage = "review";
    if (row.detected_items == null) row.detected_items = [];
    if (row.risk_flags == null) row.risk_flags = [];
    if (row.client === undefined) row.client = null;
  }
  if (!requireName && Object.keys(row).length === 0) return { error: "Nothing to update." };
  return { row };
}

function queryId(req) {
  const fromQuery = req.query && (req.query.id || req.query.id === "");
  if (fromQuery) return String(req.query.id);
  return new URL(req.url || "/", "http://localhost").searchParams.get("id") || "";
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;

  if (req.method === "GET") {
    const id = queryId(req);
    if (id) {
      if (!isUuid(id)) {
        res.status(400).json({ error: "That scan id is not valid." });
        return;
      }
      const result = await readVesh("scans", { filters: { id: `eq.${id}` }, limit: 1 });
      const row = firstRow(result);
      if (!result.ok) {
        sendResult(res, result, { data: null });
        return;
      }
      if (!row) {
        res.status(404).json({ error: "Scan not found." });
        return;
      }
      res.status(200).json({ data: row });
      return;
    }
    const result = await readVesh("scans", { order: "started_at.desc", limit: 50 });
    sendResult(res, result, { data: Array.isArray(result.data) ? result.data : [] });
    return;
  }

  if (req.method === "POST") {
    const parsed = scanPayload(readBody(req), { requireName: true });
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const saved = await insertVesh("scans", parsed.row);
    const row = firstRow(saved);
    if (!saved.ok || !row) {
      sendResult(res, saved.ok ? { ok: false, status: 502, error: "Scan was not saved." } : saved, { data: null });
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  if (req.method === "PATCH") {
    const id = queryId(req);
    if (!isUuid(id)) {
      res.status(400).json({ error: "A scan id is required." });
      return;
    }
    const parsed = scanPayload(readBody(req), { requireName: false });
    if (parsed.error) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const saved = await updateVesh("scans", id, parsed.row);
    const row = firstRow(saved);
    if (!saved.ok) {
      sendResult(res, saved, { data: null });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Scan not found." });
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  res.status(405).json({ error: "Method not allowed" });
}
