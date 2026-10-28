// Materials requests for Vesh. The user exports or opens a mailto draft.
// This route never sends email and never stores a supplier price.

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

function stripSupplierPrices(line) {
  return {
    product: String(line.product || "").slice(0, 200),
    qty: Math.max(0, Number(line.qty) || 0),
    brand: String(line.brand || "").slice(0, 80),
    unit: String(line.unit || "ea").slice(0, 20),
    notes: String(line.notes || "").slice(0, 500),
  };
}

const STATUSES = new Set(["draft", "sent", "priced", "ordered", "delivered"]);

function cleanLines(value) {
  if (!Array.isArray(value)) return [];
  return value.map(line => stripSupplierPrices(line && typeof line === "object" ? line : {}));
}

function payload(body) {
  const status = STATUSES.has(body.status) ? body.status : "draft";
  return {
    estimate_ref: body.estimate_ref ? String(body.estimate_ref).slice(0, 40) : null,
    scan_id: isUuid(body.scan_id) ? body.scan_id : null,
    job_name: String(body.job_name || "").slice(0, 200),
    site_address: String(body.site_address || "").slice(0, 300),
    required_by: body.required_by ? String(body.required_by).slice(0, 40) : null,
    supplier_name: String(body.supplier_name || "Lawrence & Hanson").slice(0, 120),
    supplier_email: String(body.supplier_email || "").slice(0, 200),
    notes: String(body.notes || "").slice(0, 2000),
    lines: cleanLines(body.lines),
    status,
  };
}

function queryValue(req, key) {
  if (req.query && req.query[key]) return String(req.query[key]);
  return new URL(req.url || "/", "http://localhost").searchParams.get(key) || "";
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;

  if (req.method === "GET") {
    const estimateRef = queryValue(req, "estimate_ref");
    const result = await readVesh("materials_requests", {
      ...(estimateRef ? { filters: { estimate_ref: `eq.${estimateRef}` } } : {}),
      order: "created_at.desc",
      limit: 50,
    });
    if (!result.ok && /does not exist|PGRST205|materials_requests/i.test(`${result.error} ${result.bodyText}`)) {
      res.status(200).json({ data: [] });
      return;
    }
    sendResult(res, result, { data: Array.isArray(result.data) ? result.data : [] });
    return;
  }

  if (req.method === "POST") {
    const saved = await insertVesh("materials_requests", payload(readBody(req)));
    if (!saved.ok && /does not exist|PGRST205|materials_requests/i.test(`${saved.error} ${saved.bodyText}`)) {
      res.status(503).json({
        error: "Apply migration 20261028120000_takeoff_and_materials.sql before saving a materials request. You can still export the PDF, CSV, and email draft.",
      });
      return;
    }
    const row = firstRow(saved);
    if (!saved.ok || !row) {
      sendResult(res, saved.ok ? { ok: false, status: 502, error: "Materials request was not saved." } : saved, { data: null });
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  if (req.method === "PATCH") {
    const id = queryValue(req, "id");
    if (!isUuid(id)) {
      res.status(400).json({ error: "A materials request id is required." });
      return;
    }
    const saved = await updateVesh("materials_requests", id, payload(readBody(req)));
    const row = firstRow(saved);
    if (!saved.ok) {
      sendResult(res, saved, { data: null });
      return;
    }
    if (!row) {
      res.status(404).json({ error: "Materials request not found." });
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  res.status(405).json({ error: "Method not allowed" });
}
