// Workspace rows for assemblies, corrections, invoices, and jobs.
// Service role only. Missing tables return an empty list or a migration hint.

import { firstRow, insertVesh, readBody, readVesh, requireBeta, sendResult } from "../_lib/veshAdmin.js";

const TABLES = {
  assemblies: "assemblies",
  corrections: "detection_corrections",
  invoices: "draft_invoices",
  jobs: "job_records",
};

function kindOf(req) {
  const url = new URL(req.url || "/", "http://localhost");
  return url.searchParams.get("kind") || "";
}

function missingTable(result) {
  return /does not exist|PGRST205|42P01/i.test(`${result.error || ""} ${result.bodyText || ""}`);
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;
  const table = TABLES[kindOf(req)];
  if (!table) {
    res.status(400).json({ error: "Choose assemblies, corrections, invoices, or jobs." });
    return;
  }

  if (req.method === "GET") {
    const result = await readVesh(table, { order: "updated_at.desc", limit: 100 });
    const fallback = await (result.ok ? result : readVesh(table, { limit: 100 }));
    if (!fallback.ok && missingTable(fallback)) {
      res.status(200).json({ data: [], migration: "20261103140000_assemblies_reviews_supplier_invoices_jobs.sql" });
      return;
    }
    sendResult(res, fallback.ok ? fallback : result, { data: Array.isArray((fallback.ok ? fallback : result).data) ? (fallback.ok ? fallback : result).data : [] });
    return;
  }

  if (req.method === "POST") {
    const saved = await insertVesh(table, readBody(req));
    if (!saved.ok && missingTable(saved)) {
      res.status(503).json({
        error: "Apply migration 20261103140000_assemblies_reviews_supplier_invoices_jobs.sql in the Supabase SQL editor. This browser copy is still kept locally.",
      });
      return;
    }
    const row = firstRow(saved);
    if (!saved.ok || !row) {
      sendResult(res, saved.ok ? { ok: false, status: 502, error: "That row was not saved." } : saved, { data: null });
      return;
    }
    sendResult(res, saved, { data: row });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed" });
}
