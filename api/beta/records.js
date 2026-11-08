// Workspace rows for assemblies, corrections, invoices, and jobs.
// Service role only. Missing tables return an empty list or a migration hint.

import { firstRow, insertVesh, readBody, readVesh, requireBeta, sendResult } from "../_lib/veshAdmin.js";

const TABLES = {
  assemblies: "assemblies",
  corrections: "detection_corrections",
  invoices: "draft_invoices",
  jobs: "job_records",
  prices: "contractor_price_lists",
  labour: "labour_rate_cards",
  actuals: "job_actuals",
  schedules: "job_schedules",
};

function kindOf(req) {
  const url = new URL(req.url || "/", "http://localhost");
  return url.searchParams.get("kind") || "";
}

function missingTable(result) {
  return /does not exist|PGRST205|42P01/i.test(`${result.error || ""} ${result.bodyText || ""}`);
}

function migrationFor(kind) {
  if (kind === "actuals" || kind === "schedules") return "20261104040000_job_actuals.sql";
  if (kind === "prices") return "20261105090000_contractor_price_list_and_scope.sql";
  if (kind === "labour") return "20261108010000_labour_rate_cards.sql";
  return "20261103140000_assemblies_reviews_supplier_invoices_jobs.sql";
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;
  const table = TABLES[kindOf(req)];
  if (!table) {
    res.status(400).json({ error: "Choose assemblies, corrections, invoices, jobs, prices, labour, actuals, or schedules." });
    return;
  }

  if (req.method === "GET") {
    const result = await readVesh(table, { order: "updated_at.desc", limit: 100 });
    const fallback = await (result.ok ? result : readVesh(table, { limit: 100 }));
    if (!fallback.ok && missingTable(fallback)) {
      res.status(200).json({ data: [], migration: migrationFor(kindOf(req)) });
      return;
    }
    sendResult(res, fallback.ok ? fallback : result, { data: Array.isArray((fallback.ok ? fallback : result).data) ? (fallback.ok ? fallback : result).data : [] });
    return;
  }

  if (req.method === "POST") {
    const saved = await insertVesh(table, readBody(req));
    if (!saved.ok && missingTable(saved)) {
      res.status(503).json({
        error: `Apply migration ${migrationFor(kindOf(req))} in the Supabase SQL editor. This browser copy is still kept locally.`,
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
