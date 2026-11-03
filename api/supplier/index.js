// Vesh creates a one-job supplier link. This does not email anyone.

import { firstRow, insertVesh, readBody, requireBeta, sendResult } from "../_lib/veshAdmin.js";

function cleanLines(value) {
  if (!Array.isArray(value)) return [];
  return value.map(line => ({
    product: String(line?.product || "").slice(0, 200),
    qty: Math.max(0, Number(line?.qty) || 0),
    unit: String(line?.unit || "ea").slice(0, 20),
  })).filter(line => line.product && line.qty > 0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!requireBeta(res)) return;
  const body = readBody(req);
  const token = String(body.token || "");
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    res.status(400).json({ error: "The supplier link token is not valid." });
    return;
  }
  const requestId = typeof body.materials_request_id === "string" && /^[0-9a-f-]{36}$/i.test(body.materials_request_id)
    ? body.materials_request_id
    : null;
  const saved = await insertVesh("supplier_price_links", {
    token,
    materials_request_id: requestId,
    estimate_ref: body.estimate_ref ? String(body.estimate_ref).slice(0, 40) : null,
    job_name: String(body.job_name || "").slice(0, 200),
    supplier_name: String(body.supplier_name || "Lawrence & Hanson").slice(0, 120),
    lines: cleanLines(body.lines),
    status: "sent",
  });
  if (!saved.ok && /does not exist|PGRST205|42P01/i.test(`${saved.error} ${saved.bodyText}`)) {
    res.status(503).json({
      error: "Apply migration 20261103140000_assemblies_reviews_supplier_invoices_jobs.sql before creating a supplier link.",
    });
    return;
  }
  const row = firstRow(saved);
  if (!saved.ok || !row) {
    sendResult(res, saved.ok ? { ok: false, status: 502, error: "The supplier link was not saved." } : saved, { data: null });
    return;
  }
  sendResult(res, saved, { data: { id: row.id, token, path: `/supplier/${token}` } });
}
