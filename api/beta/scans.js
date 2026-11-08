// Vesh scans. Create, list, fetch, and update without a user JWT.
//
// The beta is open, so this route checks the plan type and the payload size,
// answers failures with JSON, and limits bursts per IP. Query strings are
// read with the WHATWG URL API only. Touching req.query makes the Vercel
// Node runtime call url.parse(), which Node 24 logs as DEP0169 at error
// level on every scan list request.

import {
  firstRow,
  insertVesh,
  isUuid,
  missingColumn,
  readVesh,
  requireBeta,
  sendResult,
  updateVesh,
} from "../_lib/veshAdmin.js";
import { clientIp, rateLimit } from "../_lib/rateLimit.js";

const MAX_BODY = 1_500_000;
const ALLOWED_EXT = new Set(["pdf", "png"]);
const STAGES = new Set(["upload", "detecting", "review", "quote", "sign", "complete"]);
const FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "multipart/form-data",
]);
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 10_000;

function headerValue(req, name) {
  const headers = req.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] ?? "");
  return value == null ? "" : String(value);
}

function requestUrl(req) {
  try {
    return new URL(req.url || "/", "http://localhost");
  } catch {
    return null;
  }
}

function scanId(req) {
  const url = requestUrl(req);
  if (!url) return { error: "That request URL is not valid." };
  return { id: url.searchParams.get("id") || "" };
}

function jsonList(value, label) {
  if (!Array.isArray(value)) return { error: `${label} must be a list.` };
  let encoded = "";
  try {
    encoded = JSON.stringify(value);
  } catch {
    return { error: `${label} could not be saved.` };
  }
  if (encoded.length > MAX_BODY) return { error: "This scan is too large to save." };
  return { value };
}

function planFileName(value) {
  const trimmed = String(value || "").trim().replace(/\\/g, "/");
  const base = trimmed.split("/").pop() || "";
  if (!base) return { error: "A file name is required." };
  if (base.length > 500) return { error: "File name is too long." };
  if (/[\u0000-\u001f]/.test(base)) return { error: "File name has invalid characters." };
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1).toLowerCase() : "";
  if (!ALLOWED_EXT.has(ext)) return { error: "Upload a PDF or PNG floor plan." };
  return { value: base };
}

function scanPayload(body, { requireName }) {
  const row = {};
  if (requireName || body.file_name != null) {
    const fileName = planFileName(body.file_name);
    if (fileName.error) return fileName;
    row.file_name = fileName.value;
  }
  if (body.client !== undefined) {
    row.client = body.client == null || body.client === "" ? null : String(body.client).slice(0, 200);
  }
  if (body.stage !== undefined) {
    const stage = String(body.stage || "").trim().toLowerCase();
    if (!STAGES.has(stage)) return { error: "Choose a scan stage of upload, detecting, review, quote, sign, or complete." };
    row.stage = stage;
  }
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
  if (body.display_label !== undefined) {
    row.display_label = String(body.display_label || "").trim().slice(0, 200) || null;
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

function readScanBody(req) {
  const declared = Number(headerValue(req, "content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return { error: "This scan is too large to save.", status: 413 };
  }
  const type = headerValue(req, "content-type").split(";")[0].trim().toLowerCase();
  if (FILE_TYPES.has(type)) {
    return { error: "Send the scan as JSON. PDF and PNG plans stay in the browser.", status: 415 };
  }
  if (req.body && typeof req.body === "object") {
    if (Array.isArray(req.body)) return { error: "Send scan details as JSON.", status: 400 };
    let encoded = "";
    try {
      encoded = JSON.stringify(req.body);
    } catch {
      return { error: "Send scan details as JSON.", status: 400 };
    }
    if (encoded.length > MAX_BODY) return { error: "This scan is too large to save.", status: 413 };
    return { body: req.body };
  }
  if (typeof req.body === "string" && req.body.trim()) {
    if (req.body.length > MAX_BODY) return { error: "This scan is too large to save.", status: 413 };
    try {
      const body = JSON.parse(req.body);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Send scan details as JSON.", status: 400 };
      }
      return { body };
    } catch {
      return { error: "Send scan details as JSON.", status: 400 };
    }
  }
  return { body: {} };
}

function fail(res, status, error) {
  res.status(status).json({ error });
}

async function handle(req, res) {
  if (!requireBeta(res)) return;

  const limit = rateLimit(clientIp(req), { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    fail(res, 429, "Too many scan requests. Wait a moment and try again.");
    return;
  }

  if (req.method === "GET") {
    const id = scanId(req);
    if (id.error) {
      fail(res, 400, id.error);
      return;
    }
    if (id.id) {
      if (!isUuid(id.id)) {
        fail(res, 400, "That scan id is not valid.");
        return;
      }
      const result = await readVesh("scans", { filters: { id: `eq.${id.id}` }, limit: 1 });
      const row = firstRow(result);
      if (!result.ok) {
        sendResult(res, result, { data: null });
        return;
      }
      if (!row) {
        fail(res, 404, "Scan not found.");
        return;
      }
      res.status(200).json({ data: row });
      return;
    }
    const result = await readVesh("scans", { order: "started_at.desc", limit: 50 });
    sendResult(res, result, { data: Array.isArray(result.data) ? result.data : [] });
    return;
  }

  if (req.method === "POST" || req.method === "PATCH") {
    const parsedBody = readScanBody(req);
    if (parsedBody.error) {
      fail(res, parsedBody.status || 400, parsedBody.error);
      return;
    }

    if (req.method === "POST") {
      const parsed = scanPayload(parsedBody.body, { requireName: true });
      if (parsed.error) {
        fail(res, 400, parsed.error);
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

    const id = scanId(req);
    if (id.error) {
      fail(res, 400, id.error);
      return;
    }
    if (!isUuid(id.id)) {
      fail(res, 400, "A scan id is required.");
      return;
    }
    const parsed = scanPayload(parsedBody.body, { requireName: false });
    if (parsed.error) {
      fail(res, 400, parsed.error);
      return;
    }
    let saved = await updateVesh("scans", id.id, parsed.row);
    if (!saved.ok && missingColumn(saved, "display_label")) {
      const retry = { ...parsed.row };
      delete retry.display_label;
      if (Object.keys(retry).length === 0) {
        res.status(200).json({ data: null, stored: "browser" });
        return;
      }
      saved = await updateVesh("scans", id.id, retry);
    }
    const row = firstRow(saved);
    if (!saved.ok) {
      sendResult(res, saved, { data: null });
      return;
    }
    if (!row) {
      fail(res, 404, "Scan not found.");
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  fail(res, 405, "Method not allowed");
}

export default async function handler(req, res) {
  try {
    await handle(req, res);
  } catch (err) {
    console.error("[ElectraScan] scans failed", err && err.message);
    if (res.headersSent || res.writableEnded) return;
    fail(res, 500, "The scan request failed. Try again.");
  }
}
