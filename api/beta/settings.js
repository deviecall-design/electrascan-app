// Workspace settings for the Vesh beta: verified-takeoff gate and supplier contact.
// The gate is off when min_verified_pct is null. Nothing here emails anyone.

import {
  adminRequest,
  firstRow,
  missingColumn,
  readBody,
  requireBeta,
  VESH_TENANT_ID,
} from "../_lib/veshAdmin.js";

const DEFAULTS = {
  minVerifiedPct: null,
  supplierName: "Lawrence & Hanson",
  supplierEmail: "",
  defaultMarginPct: null,
  marginStored: false,
};

function clampMargin(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

function present(row, marginStored = false) {
  if (!row) return { ...DEFAULTS, marginStored };
  const pct = row.min_verified_pct;
  const margin = row.default_margin_pct;
  return {
    minVerifiedPct: pct == null || pct === "" ? null : Math.max(0, Math.min(100, Number(pct))),
    supplierName: row.supplier_name || DEFAULTS.supplierName,
    supplierEmail: row.supplier_email || "",
    defaultMarginPct: margin == null || margin === "" ? null : clampMargin(margin),
    marginStored,
  };
}

const FULL_SELECT = "id,min_verified_pct,supplier_name,supplier_email,default_margin_pct";
const BASE_SELECT = "id,min_verified_pct,supplier_name,supplier_email";

async function readSettings() {
  const scoped = await adminRequest(
    `workspace_settings?select=${FULL_SELECT}&or=(tenant_id.eq.${VESH_TENANT_ID},tenant_id.is.null)&limit=1`,
  );
  if (scoped.ok) return { ...scoped, marginStored: true };
  if (missingColumn(scoped, "default_margin_pct")) {
    const without = await adminRequest(
      `workspace_settings?select=${BASE_SELECT}&or=(tenant_id.eq.${VESH_TENANT_ID},tenant_id.is.null)&limit=1`,
    );
    return { ...without, marginStored: false };
  }
  if (missingColumn(scoped, "tenant_id")) {
    const plain = await adminRequest(`workspace_settings?select=${FULL_SELECT}&limit=1`);
    if (plain.ok) return { ...plain, marginStored: true };
    if (missingColumn(plain, "default_margin_pct")) {
      const base = await adminRequest(`workspace_settings?select=${BASE_SELECT}&limit=1`);
      return { ...base, marginStored: false };
    }
    return { ...plain, marginStored: false };
  }
  return { ...scoped, marginStored: false };
}

export default async function handler(req, res) {
  if (!requireBeta(res)) return;

  if (req.method === "GET") {
    const result = await readSettings();
    if (!result.ok) {
      if (result.status === 404 || /workspace_settings|PGRST205|does not exist/i.test(result.error || "")) {
        res.status(200).json(DEFAULTS);
        return;
      }
      res.status(result.status === 503 ? 503 : 200).json(result.status === 503 ? { error: result.error } : DEFAULTS);
      return;
    }
    res.status(200).json(present(firstRow(result), Boolean(result.marginStored)));
    return;
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = readBody(req);
  const min = body.minVerifiedPct;
  const margin = clampMargin(body.defaultMarginPct);
  const row = {
    tenant_id: VESH_TENANT_ID,
    min_verified_pct: min == null || min === "" ? null : Math.max(0, Math.min(100, Math.round(Number(min)))),
    supplier_name: String(body.supplierName || DEFAULTS.supplierName).slice(0, 120),
    supplier_email: String(body.supplierEmail || "").slice(0, 200),
    ...(margin == null ? {} : { default_margin_pct: margin }),
    updated_at: new Date().toISOString(),
  };

  const existing = await readSettings();
  if (!existing.ok && /does not exist|PGRST205|workspace_settings/i.test(`${existing.error} ${existing.bodyText}`)) {
    res.status(503).json({
      error: "Apply migration 20261028120000_takeoff_and_materials.sql before saving workspace settings.",
    });
    return;
  }
  const current = firstRow(existing);
  const saved = current?.id
    ? await adminRequest(`workspace_settings?id=eq.${current.id}`, {
        method: "PATCH",
        body: row,
        prefer: "return=representation",
      })
    : await adminRequest("workspace_settings", {
        method: "POST",
        body: row,
        prefer: "return=representation",
      });
  if (!saved.ok && missingColumn(saved, "tenant_id")) {
    const rest = { ...row };
    delete rest.tenant_id;
    const retry = current?.id
      ? await adminRequest(`workspace_settings?id=eq.${current.id}`, { method: "PATCH", body: rest, prefer: "return=representation" })
      : await adminRequest("workspace_settings", { method: "POST", body: rest, prefer: "return=representation" });
    if (!retry.ok && missingColumn(retry, "default_margin_pct")) {
      delete rest.default_margin_pct;
      const again = current?.id
        ? await adminRequest(`workspace_settings?id=eq.${current.id}`, { method: "PATCH", body: rest, prefer: "return=representation" })
        : await adminRequest("workspace_settings", { method: "POST", body: rest, prefer: "return=representation" });
      if (!again.ok) {
        res.status(503).json({ error: again.error || "Could not save workspace settings." });
        return;
      }
      res.status(200).json({ ...present(firstRow(again), false), defaultMarginPct: margin, marginStored: false });
      return;
    }
    if (!retry.ok) {
      res.status(503).json({ error: retry.error || "Could not save workspace settings." });
      return;
    }
    res.status(200).json(present(firstRow(retry), margin != null));
    return;
  }
  if (!saved.ok && missingColumn(saved, "default_margin_pct")) {
    const rest = { ...row };
    delete rest.default_margin_pct;
    const retry = current?.id
      ? await adminRequest(`workspace_settings?id=eq.${current.id}`, { method: "PATCH", body: rest, prefer: "return=representation" })
      : await adminRequest("workspace_settings", { method: "POST", body: rest, prefer: "return=representation" });
    if (!retry.ok) {
      res.status(503).json({ error: retry.error || "Could not save workspace settings." });
      return;
    }
    res.status(200).json({ ...present(firstRow(retry), false), defaultMarginPct: margin, marginStored: false });
    return;
  }
  if (!saved.ok) {
    res.status(saved.status === 503 ? 503 : 400).json({ error: saved.error || "Could not save workspace settings." });
    return;
  }
  res.status(200).json(present(firstRow(saved), margin != null));
}
