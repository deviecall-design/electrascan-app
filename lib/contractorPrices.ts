/**
 * The workspace's own price list, loaded from a supplier file the contractor uploaded.
 * Local copy first. Supabase is used when the migration has been applied.
 */

import type { StoredContractorPrice } from "./priceFile";

const KEY = "es-contractor-prices-v1";
export const PRICE_LIST_MIGRATION = "20261105090000_contractor_price_list_and_scope.sql";

function valid(row: unknown): row is StoredContractorPrice {
  if (!row || typeof row !== "object") return false;
  const record = row as Partial<StoredContractorPrice>;
  return typeof record.cost === "number" && record.cost > 0 && (typeof record.description === "string" || typeof record.code === "string");
}

export function loadPriceList(): StoredContractorPrice[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(valid).map(row => ({
      code: row.code || "",
      description: row.description || row.code || "",
      unit: row.unit || "ea",
      cost: row.cost,
      assemblyId: row.assemblyId ?? null,
    }));
  } catch {
    return [];
  }
}

export function savePriceList(rows: StoredContractorPrice[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event("es-price-list"));
}

export async function fetchPriceList(): Promise<{ rows: StoredContractorPrice[]; remote: boolean; migration: boolean }> {
  try {
    const res = await fetch("/api/beta/records?kind=prices");
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.migration) return { rows: loadPriceList(), remote: false, migration: Boolean(json.migration) || !res.ok };
    const latest = Array.isArray(json.data) ? json.data[0] : null;
    const lines = latest && Array.isArray(latest.lines) ? latest.lines.filter(valid) : [];
    if (lines.length > 0) {
      const rows = lines.map(row => ({
        code: row.code || "",
        description: row.description || row.code || "",
        unit: row.unit || "ea",
        cost: row.cost,
        assemblyId: row.assemblyId ?? null,
      }));
      savePriceList(rows);
      return { rows, remote: true, migration: false };
    }
  } catch {
    /* keep the browser copy */
  }
  return { rows: loadPriceList(), remote: false, migration: false };
}

export async function storePriceList(rows: StoredContractorPrice[], sourceLabel: string): Promise<{ stored: "remote" | "local"; message: string }> {
  savePriceList(rows);
  try {
    const res = await fetch("/api/beta/records?kind=prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Workspace price list",
        source_label: sourceLabel.slice(0, 200),
        lines: rows,
        updated_at: new Date().toISOString(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        stored: "local",
        message: json.error || `Saved in this browser. Apply ${PRICE_LIST_MIGRATION} to share it.`,
      };
    }
    return { stored: "remote", message: "Price list saved for this workspace." };
  } catch {
    return { stored: "local", message: "Saved in this browser. The price list will be used on this device." };
  }
}
