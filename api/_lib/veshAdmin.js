/**
 * Service-role access for the Vesh beta. This module is imported only by
 * /api routes. The key must be SUPABASE_SERVICE_ROLE_KEY (never VITE_).
 *
 * Production does not have a tenant_id column yet. Reads and writes try
 * the Vesh-or-null filter first and, only when Postgres says that column
 * is missing, retry without it. Once the column exists, other tenants
 * are not returned.
 */

import { isAuthDisabled } from "./authMode.js";

export const VESH_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function requireBeta(res) {
  if (isAuthDisabled()) return true;
  res.status(401).json({ error: "Sign in is required." });
  return false;
}

export function adminConfig() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://zxeznkuodpseijkvjwxa.supabase.co";
  return { key, url: url.replace(/\/$/, "") };
}

function scrub(text, key) {
  const value = String(text || "");
  if (!key) return value;
  return value.split(key).join("[redacted]");
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

export function missingColumn(result, column) {
  const text = `${result.bodyText || ""} ${result.error || ""}`;
  return (
    result.status === 400 &&
    text.includes(column) &&
    /42703|does not exist/i.test(text)
  );
}

export async function adminRequest(path, { method = "GET", body, prefer } = {}) {
  const cfg = adminConfig();
  if (!cfg) {
    return {
      ok: false,
      status: 503,
      error:
        "Saved data needs SUPABASE_SERVICE_ROLE_KEY on the server. In Supabase open Project Settings, then API, and copy the service_role secret into Vercel.",
      data: null,
      bodyText: "",
    };
  }

  let res;
  try {
    res = await fetch(`${cfg.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Could not reach saved data.",
      data: null,
      bodyText: "",
    };
  }

  const bodyText = scrub(await res.text(), cfg.key);
  let data = null;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && (data.message || data.error || data.hint)) ||
      bodyText.slice(0, 300) ||
      `Request failed (${res.status})`;
    return {
      ok: false,
      status: res.status,
      error: scrub(message, cfg.key).slice(0, 400),
      data,
      bodyText,
    };
  }
  return { ok: true, status: res.status, error: null, data, bodyText };
}

function scopedParams(options, withTenant) {
  const params = new URLSearchParams();
  params.set("select", options.select || "*");
  if (options.order) params.set("order", options.order);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      params.set(key, value);
    }
  }
  if (withTenant) {
    params.set("or", `(tenant_id.eq.${VESH_TENANT_ID},tenant_id.is.null)`);
  }
  return params;
}

export async function readVesh(table, options = {}) {
  const scoped = await adminRequest(`${table}?${scopedParams(options, true)}`);
  if (missingColumn(scoped, "tenant_id")) {
    return adminRequest(`${table}?${scopedParams(options, false)}`);
  }
  return scoped;
}

export async function insertVesh(table, row) {
  const withTenant = { ...row, tenant_id: VESH_TENANT_ID };
  const first = await adminRequest(table, {
    method: "POST",
    body: withTenant,
    prefer: "return=representation",
  });
  if (missingColumn(first, "tenant_id")) {
    const rest = { ...row };
    delete rest.tenant_id;
    return adminRequest(table, {
      method: "POST",
      body: rest,
      prefer: "return=representation",
    });
  }
  return first;
}

export async function updateVesh(table, id, row) {
  const payload = { ...row };
  delete payload.tenant_id;
  delete payload.id;
  delete payload.owner_id;
  const prefer = "return=representation";
  const scoped = await adminRequest(
    `${table}?${scopedParams({ filters: { id: `eq.${id}` }, select: "*" }, true)}`,
    { method: "PATCH", body: payload, prefer },
  );
  if (missingColumn(scoped, "tenant_id")) {
    return adminRequest(`${table}?id=eq.${id}`, {
      method: "PATCH",
      body: payload,
      prefer,
    });
  }
  return scoped;
}

export async function deleteVesh(table, id) {
  const prefer = "return=representation";
  const scoped = await adminRequest(
    `${table}?${scopedParams({ filters: { id: `eq.${id}` }, select: "id" }, true)}`,
    { method: "DELETE", prefer },
  );
  if (missingColumn(scoped, "tenant_id")) {
    return adminRequest(`${table}?id=eq.${id}`, { method: "DELETE", prefer });
  }
  return scoped;
}

export function firstRow(result) {
  if (!result || !result.ok) return null;
  if (Array.isArray(result.data)) return result.data[0] ?? null;
  return result.data ?? null;
}

export function sendResult(res, result, body) {
  if (!result.ok) {
    const status =
      result.status === 503
        ? 503
        : result.status >= 400 && result.status < 500
          ? 400
          : 502;
    res.status(status).json({ error: result.error || "Could not reach saved data." });
    return false;
  }
  res.status(200).json(body);
  return true;
}
