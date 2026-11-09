import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RECORD_LIST_ORDER } from "../api/_lib/recordOrder.js";

/**
 * Columns read from information_schema.columns on project zxeznkuodpseijkvjwxa
 * on 9 Nov 2026. Some tables were created outside supabase/migrations
 * (incoming_emails, rate_library_sync_log, user_prefs, approved_users) or
 * already existed when a later CREATE TABLE IF NOT EXISTS ran (approval_audit
 * has estimate_id live, and estimate_ref only in the migration). A list
 * column is valid when either source has it.
 */
const LIVE_COLUMNS: Record<string, string[]> = {
  approval_audit: ["id", "project_name", "estimate_id", "actor", "role", "action", "signature", "notes", "created_at", "owner_id"],
  approved_users: ["user_id", "approved_at", "approved_by"],
  assemblies: ["id", "tenant_id", "assembly_key", "name", "keywords", "materials", "labour_hours", "sell_price", "is_default", "updated_at"],
  company_profile: ["id", "owner_id", "company_name", "abn", "logo_url", "address", "phone", "email", "created_at", "updated_at"],
  contractor_price_lists: ["id", "tenant_id", "name", "source_label", "lines", "updated_at"],
  detection_corrections: ["id", "tenant_id", "scan_id", "item_id", "symbol", "original_desc", "original_qty", "corrected_desc", "corrected_qty", "action", "created_at"],
  draft_invoices: ["id", "tenant_id", "source", "source_ref", "job_name", "client_name", "amount", "tax", "status", "lines", "created_at"],
  estimates: ["id", "ref", "client", "value", "status", "days_since_sent", "project_name", "drawing_file", "margin_pct", "subtotal", "line_items", "owner_id", "created_at", "updated_at", "reference", "tenant_id", "verified_pct", "approval_status", "scope_of_works"],
  incoming_emails: ["id", "tenant_email", "from_email", "subject", "file_name", "file_kind", "pages", "received_at", "status", "linked_project", "estimate_id", "owner_id"],
  job_actuals: ["id", "tenant_id", "job_id", "spent_on", "materials", "labour_hours", "labour_cost", "note", "created_at"],
  job_costs: ["id", "tenant_id", "job_ref", "kind", "spent_on", "hours", "role_name", "amount", "supplier", "reference", "note", "created_at"],
  job_records: ["id", "tenant_id", "job_key", "name", "stage", "quoted_sell", "actual_materials", "actual_hours", "labour_rate", "updated_at"],
  job_schedules: ["id", "tenant_id", "job_id", "start_on", "end_on", "updated_at"],
  labour_rate_cards: ["id", "tenant_id", "roles", "updated_at"],
  materials_requests: ["id", "tenant_id", "scan_id", "estimate_ref", "job_name", "site_address", "required_by", "supplier_name", "supplier_email", "notes", "lines", "status", "created_at", "updated_at"],
  milestone_claims: ["id", "project_name", "milestone", "amount", "claimed_at", "status", "owner_id", "tenant_id", "project_id", "milestone_id", "milestone_label", "inv_ref", "created_at"],
  rate_library: ["id", "code", "category", "description", "unit", "rate", "labour", "is_custom", "owner_id", "synced_at", "catalogue_id", "tenant_id"],
  rate_library_sync_log: ["id", "ts", "source", "products_count", "status", "note", "owner_id"],
  scans: ["id", "file_name", "client", "stage", "items_detected", "progress", "estimate_ref", "detected_items", "risk_flags", "raw_response", "owner_id", "started_at", "completed_at", "tenant_id"],
  supplier_price_links: ["id", "tenant_id", "token", "materials_request_id", "estimate_ref", "job_name", "supplier_name", "lines", "status", "created_at", "submitted_at"],
  tenant_memberships: ["id", "tenant_id", "user_id", "role", "created_at"],
  timesheets: ["id", "project_name", "week", "planned", "actual", "labour", "materials", "submitted_at", "owner_id", "tenant_id"],
  user_prefs: ["user_email", "auto_scan", "owner_id", "updated_at", "tenant_profile"],
  variation_reports: ["id", "tenant_id", "owner_id", "project_name", "base_estimate_number", "base_total", "new_total", "delta", "pct_change", "variation_items", "risks", "status", "created_at", "updated_at"],
  variations: ["id", "project_id", "estimate_id_v1", "estimate_id_v2", "net_delta", "added_count", "removed_count", "changed_count", "risk_flags", "notes", "created_by", "created_at", "updated_at", "owner_id", "tenant_id"],
  workspace_settings: ["id", "tenant_id", "min_verified_pct", "supplier_name", "supplier_email", "updated_at", "default_margin_pct"],
};

/** Tables the app queries that have no CREATE TABLE in the repo and are absent live. */
const TABLES_WITHOUT_SCHEMA = new Set(["rate_library_items", "templates"]);

const ROOTS = ["api", "services", "hooks", "lib", "components", "screens", "contexts", "supabase/functions"];
const SKIP_DIR = new Set(["node_modules", "dist", "__tests__"]);

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function balanced(sql: string, openAt: number): string {
  let depth = 0;
  for (let i = openAt; i < sql.length; i++) {
    if (sql[i] === "(") depth += 1;
    else if (sql[i] === ")") {
      depth -= 1;
      if (depth === 0) return sql.slice(openAt + 1, i);
    }
  }
  return "";
}

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") depth += 1;
    else if (body[i] === ")") depth -= 1;
    else if (body[i] === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

function columnName(part: string): string | null {
  const token = part.trim().match(/^["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/);
  if (!token) return null;
  const name = token[1].toLowerCase();
  if (["constraint", "primary", "unique", "check", "foreign", "exclude", "like"].includes(name)) return null;
  return name;
}

function migrationSchema(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const ensure = (name: string) => {
    const key = name.toLowerCase();
    if (!tables.has(key)) tables.set(key, new Set());
    return tables.get(key)!;
  };
  const files = ["supabase/migrations", "migrations"].flatMap(dir =>
    readdirSync(dir).filter(file => file.endsWith(".sql")).map(file => path.join(dir, file)),
  );
  for (const file of files) {
    const sql = stripSqlComments(readFileSync(file, "utf8"));
    const create = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s*\(/gi;
    let match: RegExpExecArray | null;
    while ((match = create.exec(sql))) {
      const body = balanced(sql, match.index + match[0].length - 1);
      const columns = ensure(match[1]);
      for (const part of splitTopLevel(body)) {
        const name = columnName(part);
        if (name) columns.add(name);
      }
    }
    const add = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s+add\s+column\s+(?:if\s+not\s+exists\s+)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi;
    while ((match = add.exec(sql))) ensure(match[1]).add(match[2].toLowerCase());
  }
  return tables;
}

function knownColumns(): Map<string, Set<string>> {
  const tables = migrationSchema();
  for (const [table, columns] of Object.entries(LIVE_COLUMNS)) {
    const set = tables.get(table) ?? new Set<string>();
    for (const column of columns) set.add(column);
    tables.set(table, set);
  }
  return tables;
}

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
}

function sourceFiles(): string[] {
  const files: string[] = [];
  for (const root of ROOTS) walk(root, files);
  return files;
}

function windowAfter(source: string, start: number): string {
  const nextFrom = source.slice(start + 1).search(/\.from\s*\(|readVesh\s*\(|adminRequest\s*\(\s*[`'"]/);
  const end = nextFrom === -1 ? start + 1600 : Math.min(start + 1 + nextFrom, start + 1600);
  return source.slice(start, end);
}

interface QueryUse {
  file: string;
  table: string;
  column: string;
  kind: "order" | "filter" | "select";
}

function collectUses(): QueryUse[] {
  const uses: QueryUse[] = [];
  for (const file of sourceFiles()) {
    const source = readFileSync(file, "utf8");
    const constants = new Map<string, string[]>();
    for (const match of source.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*['"]([a-z0-9_,\s]+)['"]/g)) {
      constants.set(match[1], match[2].split(",").map(part => part.trim()).filter(Boolean));
    }
    const anchors = [
      ...source.matchAll(/\.from\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\)/g),
      ...source.matchAll(/readVesh\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g),
      ...source.matchAll(/adminRequest\(\s*[`'"]([a-zA-Z_][a-zA-Z0-9_]*)\?/g),
    ];
    for (const anchor of anchors) {
      const table = anchor[1].toLowerCase();
      const slice = windowAfter(source, anchor.index ?? 0);
      for (const order of slice.matchAll(/\.order\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g)) {
        uses.push({ file, table, column: order[1].toLowerCase(), kind: "order" });
      }
      for (const order of slice.matchAll(/order:\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)\./g)) {
        uses.push({ file, table, column: order[1].toLowerCase(), kind: "order" });
      }
      for (const order of slice.matchAll(/[?&]order=([a-zA-Z_][a-zA-Z0-9_]*)\./g)) {
        uses.push({ file, table, column: order[1].toLowerCase(), kind: "order" });
      }
      for (const filter of slice.matchAll(/\.(?:eq|gte|lte|gt|lt|neq|in|ilike|like|contains|overlaps)\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g)) {
        uses.push({ file, table, column: filter[1].toLowerCase(), kind: "filter" });
      }
      for (const filter of slice.matchAll(/filters:\s*\{[^}]*?([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) {
        uses.push({ file, table, column: filter[1].toLowerCase(), kind: "filter" });
      }
      for (const filter of slice.matchAll(/[?&]([a-zA-Z_][a-zA-Z0-9_]*)=(?:eq|gte|lte|like|ilike|in|is|not)\./g)) {
        const column = filter[1].toLowerCase();
        if (!["select", "order", "limit", "or", "and"].includes(column)) {
          uses.push({ file, table, column, kind: "filter" });
        }
      }
      const selected = slice.match(/\.select\(\s*['"]([^'"]+)['"]/);
      if (selected && selected[1] !== "*") {
        for (const column of selected[1].split(",").map(part => part.trim().toLowerCase()).filter(part => part && part !== "*")) {
          uses.push({ file, table, column, kind: "select" });
        }
      }
      const selectedName = slice.match(/\.select\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,)]/);
      if (selectedName && constants.has(selectedName[1])) {
        for (const column of constants.get(selectedName[1])!) {
          uses.push({ file, table, column: column.toLowerCase(), kind: "select" });
        }
      }
      for (const selectedUrl of slice.matchAll(/select=([a-zA-Z0-9_,]+)/g)) {
        for (const column of selectedUrl[1].split(",").filter(part => part && part !== "*")) {
          uses.push({ file, table, column: column.toLowerCase(), kind: "select" });
        }
      }
      for (const selectedName of slice.matchAll(/select=\$\{([A-Z0-9_]+)\}/g)) {
        for (const column of constants.get(selectedName[1]) ?? []) {
          uses.push({ file, table, column: column.toLowerCase(), kind: "select" });
        }
      }
    }
  }
  return uses;
}

describe("list order and filter columns", () => {
  const schema = knownColumns();

  it("orders the four broken lists by columns present in both migrations and the live schema", () => {
    const expected: Record<string, string> = {
      draft_invoices: "created_at",
      job_actuals: "spent_on",
      job_costs: "spent_on",
      milestone_claims: "created_at",
      detection_corrections: "created_at",
    };
    for (const [table, column] of Object.entries(expected)) {
      expect(RECORD_LIST_ORDER[table as keyof typeof RECORD_LIST_ORDER].startsWith(`${column}.`)).toBe(true);
      expect(schema.get(table)?.has(column)).toBe(true);
      expect(LIVE_COLUMNS[table]).toContain(column);
      expect(LIVE_COLUMNS[table]).not.toContain("updated_at");
    }
  });

  it("does not order or filter a known table by a column it lacks", () => {
    const missing: string[] = [];
    const unknown: string[] = [];
    for (const use of collectUses()) {
      if (TABLES_WITHOUT_SCHEMA.has(use.table)) {
        unknown.push(`${use.kind} ${use.table}.${use.column} (${use.file})`);
        continue;
      }
      const columns = schema.get(use.table);
      if (!columns) {
        unknown.push(`no schema for ${use.kind} ${use.table}.${use.column} (${use.file})`);
        continue;
      }
      if (!columns.has(use.column)) missing.push(`${use.kind} ${use.table}.${use.column} (${use.file})`);
    }
    expect(missing).toEqual([]);
    expect(unknown.filter(line => !/rate_library_items|templates/.test(line))).toEqual([]);
  });

  it("does not depend on the unapplied display_label column from PR 33", () => {
    for (const use of collectUses()) {
      expect(use.column).not.toBe("display_label");
    }
    for (const order of Object.values(RECORD_LIST_ORDER)) {
      expect(order).not.toContain("display_label");
    }
  });
});
