// Workspace rows for assemblies, corrections, invoices, and jobs.
// Service role only. Missing tables return an empty list or a migration hint.

import { orderForTable } from "../_lib/recordOrder.js";
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
  costs: "job_costs",
  claims: "milestone_claims",
};

function kindOf(req) {
  const url = new URL(req.url || "/", "http://localhost");
  return url.searchParams.get("kind") || "";
}

function missingTable(result) {
  const text = `${result.error || ""} ${result.bodyText || ""}`;
  // A missing column ("column draft_invoices.updated_at does not exist", 42703)
  // is not a missing table. Treating it as one hid the 400 behind an empty list.
  if (/42703|column\s+\S+\s+does not exist/i.test(text)) return false;
  return /PGRST205|42P01|relation\s+\S+\s+does not exist|Could not find the table/i.test(text);
}

function migrationFor(kind) {
  if (kind === "actuals" || kind === "schedules") return "20261104040000_job_actuals.sql";
  if (kind === "prices") return "20261105090000_contractor_price_list_and_scope.sql";
  if (kind === "labour") return "20261108010000_labour_rate_cards.sql";
  if (kind === "costs") return "20261108050000_job_costs.sql";
  if (kind === "claims") return "20261108040000_milestone_claims_project_id.sql";
  return "20261103140000_assemblies_reviews_supplier_invoices_jobs.sql";
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;
  const table = TABLES[kindOf(req)];
  if (!table) {
    res.status(400).json({ error: "Choose assemblies, corrections, invoices, jobs, prices, labour, actuals, schedules, costs, or claims." });
    return;
  }

  if (req.method === "GET") {
    const kind = kindOf(req);
    const result = await readVesh(table, { order: orderForTable(table), limit: 100 });
    if (!result.ok && missingTable(result)) {
      res.status(200).json({ data: [], migration: migrationFor(kind) });
      return;
    }
    if (!result.ok) {
      console.error("[ElectraScan] record list failed", { kind, table, status: result.status, error: result.error });
      const safe = result.status === 503 ? result : { ...result, error: "Could not load this list." };
      sendResult(res, safe);
      return;
    }
    const rows = Array.isArray(result.data) ? result.data : [];
    if (kind === "claims" && rows.length > 0 && rows.every(row => row.project_id == null)) {
      res.status(200).json({ data: [], migration: migrationFor("claims") });
      return;
    }
    const project = new URL(req.url || "/", "http://localhost").searchParams.get("project");
    const filtered = kind === "claims" && project ? rows.filter(row => row.project_id === project) : rows;
    sendResult(res, result, { data: filtered });
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
