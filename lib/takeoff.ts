/**
 * Takeoff arithmetic for the scan and the quote.
 * Rejected detections stay on the plan and drop out of the totals.
 * Prices come from the rate library when a row matches; nothing here is a supplier price.
 */

import type { DetectionStatus, PlanMark, StoredDetectedItem } from "./scanRecord";
import { computeQuoteTotals, lineTotal, roundCents, type QuoteTotals } from "./quoteTotals";

export type TakeoffGroupId = "gpo" | "downlight" | "data" | "smoke" | "switchboard" | "other";

export const GROUP_ORDER: TakeoffGroupId[] = [
  "gpo",
  "downlight",
  "data",
  "smoke",
  "switchboard",
  "other",
];

export const GROUP_LABEL: Record<TakeoffGroupId, string> = {
  gpo: "GPOs",
  downlight: "Downlights",
  data: "Data points",
  smoke: "Smoke alarms",
  switchboard: "Switchboards",
  other: "Other",
};

export const STATUS_LABEL: Record<DetectionStatus, string> = {
  ai: "AI-detected",
  confirmed: "Confirmed",
  added: "Manually added",
  rejected: "Rejected",
};

export interface RateLike {
  code: string;
  description: string;
  rate: number;
  category?: string;
  unit?: string;
  labour?: number;
}

const GROUP_WORDS: Record<TakeoffGroupId, string[]> = {
  gpo: ["gpo", "power point", "socket", "outlet"],
  downlight: ["downlight", "down light", "light"],
  data: ["data", "cat6", "cat 6"],
  smoke: ["smoke"],
  switchboard: ["switchboard", "switch board", "distribution"],
  other: [],
};

export function groupForItem(item: {
  group?: string;
  symbol?: string;
  detectedType?: string;
  desc?: string;
  category?: string;
}): TakeoffGroupId {
  const explicit = (item.group || "").toLowerCase();
  if ((GROUP_ORDER as string[]).includes(explicit)) return explicit as TakeoffGroupId;
  const blob = `${item.detectedType || ""} ${item.symbol || ""} ${item.desc || ""} ${item.category || ""}`.toUpperCase();
  if (blob.includes("SMOKE")) return "smoke";
  if (blob.includes("SWITCHBOARD") || blob.includes(" DB") || item.symbol === "DB") return "switchboard";
  if (blob.includes("DATA") || blob.includes("CAT6") || item.symbol === "DC") return "data";
  if (blob.includes("GPO") || blob.includes("POWER OUTLET") || item.symbol === "GPO") return "gpo";
  if (
    blob.includes("DOWNLIGHT") ||
    blob.includes("LIGHT") ||
    item.symbol === "LT" ||
    (item.category || "").toLowerCase().includes("lighting")
  ) {
    return "downlight";
  }
  return "other";
}

function asPercent(value: number, span: number): number {
  if (value >= 0 && value <= 100) return value;
  return Math.min(96, Math.max(4, (value / span) * 100));
}

function marksFor(item: StoredDetectedItem, qty: number): PlanMark[] {
  if (Array.isArray(item.marks) && item.marks.length > 0) {
    return item.marks.slice(0, Math.max(qty, item.marks.length)).map(mark => ({
      x: asPercent(mark.x, 500),
      y: asPercent(mark.y, 360),
    }));
  }
  const baseX = asPercent(item.x || 18, 500);
  const baseY = asPercent(item.y || 22, 360);
  const count = Math.max(0, Math.round(qty));
  return Array.from({ length: count }, (_, index) => ({
    x: Math.min(94, baseX + (index % 5) * 6),
    y: Math.min(92, baseY + Math.floor(index / 5) * 8),
  }));
}

export function normaliseTakeoff(items: StoredDetectedItem[]): StoredDetectedItem[] {
  return items.map(item => {
    const qty = Math.max(0, Math.round(item.qty));
    const group = groupForItem(item);
    const status: DetectionStatus = item.status ?? "ai";
    const marks = marksFor(item, status === "rejected" ? Math.max(qty, 1) : qty);
    return {
      ...item,
      qty: status === "rejected" ? qty : Math.max(qty, marks.length ? qty : 0),
      group,
      status,
      marks: status === "rejected" ? marks.slice(0, Math.max(1, qty || 1)) : marks.slice(0, Math.max(qty, 1)),
      x: marks[0]?.x ?? item.x,
      y: marks[0]?.y ?? item.y,
    };
  });
}

export function isBillable(item: StoredDetectedItem): boolean {
  return item.status !== "rejected" && item.qty > 0;
}

export function billableItems(items: StoredDetectedItem[]): StoredDetectedItem[] {
  return items.filter(isBillable);
}

export interface TakeoffGroup {
  id: TakeoffGroupId;
  label: string;
  count: number;
  rate: number;
  rateCode: string;
  lineTotal: number;
  items: StoredDetectedItem[];
}

export function costSplit(item: StoredDetectedItem, rates: RateLike[]): { material: number; labour: number } {
  const priced = rateForItem(item, rates);
  const hit = rates.find(rate => rate.code.trim().toLowerCase() === priced.code.trim().toLowerCase());
  if (hit && ((hit.labour || 0) > 0 || hit.rate > 0)) {
    return { material: hit.rate, labour: hit.labour || 0 };
  }
  return { material: item.unitPrice && item.unitPrice > 0 ? item.unitPrice : priced.rate, labour: 0 };
}

export function rateForItem(item: StoredDetectedItem, rates: RateLike[]): { rate: number; code: string } {
  const code = (item.rateCode || "").trim().toLowerCase();
  if (code) {
    const hit = rates.find(rate => rate.code.trim().toLowerCase() === code);
    if (hit && hit.rate > 0) return { rate: hit.rate, code: hit.code };
  }
  const words = GROUP_WORDS[groupForItem(item)];
  const hit = rates.find(rate => {
    const blob = `${rate.code} ${rate.description} ${rate.category || ""}`.toLowerCase();
    return words.some(word => blob.includes(word));
  });
  if (hit && hit.rate > 0) return { rate: hit.rate, code: hit.code };
  return { rate: item.unitPrice && item.unitPrice > 0 ? item.unitPrice : 0, code: item.rateCode || "" };
}

export function priceTakeoff(items: StoredDetectedItem[], rates: RateLike[]): StoredDetectedItem[] {
  return normaliseTakeoff(items).map(item => {
    const priced = rateForItem(item, rates);
    return {
      ...item,
      unitPrice: priced.rate,
      rateCode: item.rateCode || priced.code,
    };
  });
}

export function groupTakeoff(items: StoredDetectedItem[]): TakeoffGroup[] {
  const buckets = new Map<TakeoffGroupId, StoredDetectedItem[]>();
  for (const item of items) {
    const id = groupForItem(item);
    const list = buckets.get(id) ?? [];
    list.push(item);
    buckets.set(id, list);
  }
  return GROUP_ORDER.filter(id => buckets.has(id)).map(id => {
    const rows = buckets.get(id) ?? [];
    const billable = rows.filter(isBillable);
    const count = billable.reduce((sum, row) => sum + row.qty, 0);
    const rate = billable.find(row => (row.unitPrice ?? 0) > 0)?.unitPrice ?? rows[0]?.unitPrice ?? 0;
    const rateCode = billable.find(row => row.rateCode)?.rateCode || rows[0]?.rateCode || "";
    return {
      id,
      label: GROUP_LABEL[id],
      count,
      rate,
      rateCode,
      lineTotal: lineTotal(count, rate),
      items: rows,
    };
  });
}

export function takeoffSubtotal(items: StoredDetectedItem[]): number {
  return roundCents(groupTakeoff(items).reduce((sum, group) => sum + group.lineTotal, 0));
}

export function takeoffTotals(items: StoredDetectedItem[], marginPct: number): QuoteTotals {
  return computeQuoteTotals(takeoffSubtotal(items), marginPct);
}

/** Share of billable symbols the user has confirmed or added. Empty takeoff is fully verified. */
export function verifiedPercent(items: StoredDetectedItem[]): number {
  const billable = items.filter(isBillable);
  const total = billable.reduce((sum, item) => sum + item.qty, 0);
  if (total <= 0) return 100;
  const verified = billable
    .filter(item => item.status === "confirmed" || item.status === "added")
    .reduce((sum, item) => sum + item.qty, 0);
  return Math.round((verified / total) * 100);
}

export function formatVerified(items: StoredDetectedItem[]): string {
  return `Takeoff ${verifiedPercent(items)}% verified`;
}

export function canSendQuote(items: StoredDetectedItem[], minVerifiedPct: number | null): boolean {
  if (minVerifiedPct == null) return true;
  return verifiedPercent(items) >= minVerifiedPct;
}

function nextId(items: StoredDetectedItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function setStatus(items: StoredDetectedItem[], id: number, status: DetectionStatus): StoredDetectedItem[] {
  return items.map(item => (item.id === id ? { ...item, status } : item));
}

export function setItemQty(items: StoredDetectedItem[], id: number, qty: number): StoredDetectedItem[] {
  const next = Math.max(0, Math.round(qty));
  return items.map(item => {
    if (item.id !== id) return item;
    const marks = [...(item.marks ?? [])];
    while (marks.length < next) {
      const last = marks[marks.length - 1] ?? { x: item.x || 20, y: item.y || 20 };
      marks.push({
        x: Math.min(94, last.x + 6),
        y: Math.min(92, last.y + (marks.length % 2 === 0 ? 8 : 0)),
      });
    }
    return {
      ...item,
      qty: next,
      marks: marks.slice(0, Math.max(next, 1)),
      status: item.status === "rejected" && next > 0 ? "added" : item.status,
    };
  });
}

export function addSymbol(
  items: StoredDetectedItem[],
  group: TakeoffGroupId,
  at: PlanMark,
  rates: RateLike[],
): StoredDetectedItem[] {
  const draft: StoredDetectedItem = {
    id: nextId(items),
    symbol: group === "gpo" ? "GPO" : group === "downlight" ? "LT" : group === "data" ? "DC" : group === "smoke" ? "SA" : group === "switchboard" ? "DB" : "EL",
    qty: 1,
    desc: GROUP_LABEL[group].replace(/s$/, ""),
    rateCode: "",
    conf: 1,
    x: at.x,
    y: at.y,
    group,
    status: "added",
    marks: [{ x: at.x, y: at.y }],
    category: GROUP_LABEL[group],
  };
  const priced = rateForItem(draft, rates);
  return [...items, { ...draft, unitPrice: priced.rate, rateCode: priced.code }];
}

export function verifiedFromEstimate(estimate: {
  verified_pct?: number | null;
  line_items?: unknown;
}): number | null {
  if (typeof estimate.verified_pct === "number" && Number.isFinite(estimate.verified_pct)) {
    return Math.round(estimate.verified_pct);
  }
  if (!Array.isArray(estimate.line_items)) return null;
  const meta = estimate.line_items.find(row => {
    if (!row || typeof row !== "object") return false;
    return (row as { meta?: string }).meta === "takeoff";
  }) as { verifiedPct?: number } | undefined;
  return typeof meta?.verifiedPct === "number" ? Math.round(meta.verifiedPct) : null;
}
