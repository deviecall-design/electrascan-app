/**
 * Materials list for the supplier. Built from confirmed and manually added
 * counts only. No prices and no discounts — the supplier prices it.
 * The email is a mailto draft. Nothing in this module sends mail.
 */

import type { StoredDetectedItem } from "./scanRecord";
import { groupForItem, GROUP_LABEL, type TakeoffGroupId } from "./takeoff";

export const MATERIAL_STATUSES = ["draft", "sent", "priced", "ordered", "delivered"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const DEFAULT_SUPPLIER_NAME = "Lawrence & Hanson";

export interface MaterialLine {
  product: string;
  qty: number;
  brand: string;
  unit: string;
  notes: string;
}

export interface MaterialsDraft {
  jobName: string;
  siteAddress: string;
  requiredBy: string;
  supplierName: string;
  supplierEmail: string;
  notes: string;
  lines: MaterialLine[];
  status: MaterialStatus;
}

export function materialsFromTakeoff(items: StoredDetectedItem[]): MaterialLine[] {
  const buckets = new Map<string, MaterialLine>();
  for (const item of items) {
    if (item.status !== "confirmed" && item.status !== "added") continue;
    if (item.qty <= 0) continue;
    const group = groupForItem(item);
    const product = item.desc?.trim() || GROUP_LABEL[group as TakeoffGroupId] || "Material";
    const key = product.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      buckets.set(key, {
        product,
        qty: item.qty,
        brand: "",
        unit: "ea",
        notes: "",
      });
    }
  }
  return [...buckets.values()];
}

export function materialsCsv(draft: Pick<MaterialsDraft, "jobName" | "siteAddress" | "requiredBy" | "lines">): string {
  const rows = [
    ["Job", draft.jobName],
    ["Site address", draft.siteAddress],
    ["Required by", draft.requiredBy],
    [],
    ["Product", "Qty", "Brand", "Unit", "Notes"],
    ...draft.lines.map(line => [line.product, String(line.qty), line.brand, line.unit, line.notes]),
  ];
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function materialsMailto(draft: MaterialsDraft): string | null {
  const email = draft.supplierEmail.trim();
  if (!email) return null;
  const subject = `Materials request — ${draft.jobName || "Electrical job"}`;
  const lines = draft.lines
    .map(line => `${line.qty} ${line.unit}  ${line.product}${line.brand ? ` (${line.brand})` : ""}`)
    .join("\n");
  const body = [
    `Please price this materials list on our trade terms.`,
    ``,
    `Job: ${draft.jobName || "—"}`,
    `Site: ${draft.siteAddress || "—"}`,
    `Required by: ${draft.requiredBy || "—"}`,
    ``,
    lines || "No confirmed materials.",
    ``,
    draft.notes.trim(),
  ].filter(Boolean).join("\n");
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function stripSupplierPrices<T extends Record<string, unknown>>(line: T): MaterialLine {
  return {
    product: String(line.product || "").slice(0, 200),
    qty: Math.max(0, Number(line.qty) || 0),
    brand: String(line.brand || "").slice(0, 80),
    unit: String(line.unit || "ea").slice(0, 20),
    notes: String(line.notes || "").slice(0, 500),
  };
}
