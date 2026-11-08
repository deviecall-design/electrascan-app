/**
 * Merge identical estimate lines for display and PDF export.
 * The underlying detections stay separate.
 */

import { computeQuoteTotals, lineTotal } from "./quoteTotals";

export interface GroupableEstimateLine {
  description: string;
  qty: number;
  unitPrice: number;
  unit?: string;
  category?: string;
  /** Set only when the estimate is drawn as room or section blocks. A flat estimate omits it. */
  room?: string;
  code?: string;
  ids?: number[];
  /** Sell split. Included in the key so two prices with the same total stay separate. */
  materialUnit?: number;
  labourUnit?: number;
  labourNote?: string;
  /** Sum of member line totals. Keeps the grouped subtotal equal to the ungrouped one. */
  lineAmount?: number;
}

function norm(value: string | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function moneyPart(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(cents(value)) : "";
}

export function estimateLineKey(line: GroupableEstimateLine): string {
  return [
    norm(line.description),
    norm(line.code),
    String(cents(line.unitPrice)),
    norm(line.unit || "ea"),
    norm(line.category),
    norm(line.room),
    moneyPart(line.materialUnit),
    moneyPart(line.labourUnit),
    norm(line.labourNote),
  ].join("\u001f");
}

export function groupEstimateLines<T extends GroupableEstimateLine>(lines: T[]): T[] {
  const grouped = new Map<string, T>();
  for (const line of lines) {
    if (!(line.qty > 0) || !line.description.trim()) continue;
    const key = estimateLineKey(line);
    const amount = line.lineAmount ?? lineTotal(line.qty, line.unitPrice);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...line, ids: [...(line.ids ?? [])], lineAmount: amount });
      continue;
    }
    existing.qty += line.qty;
    existing.lineAmount = (existing.lineAmount ?? 0) + amount;
    if (line.ids?.length) existing.ids = [...(existing.ids ?? []), ...line.ids];
  }
  return [...grouped.values()];
}

export function estimateSubtotal(lines: Array<{ qty: number; unitPrice: number; lineAmount?: number }>): number {
  return lines.reduce((sum, line) => sum + (line.lineAmount ?? lineTotal(line.qty, line.unitPrice)), 0);
}

/** Spread a grouped quantity back across the detections that formed the line. */
export function scaleMemberQtys(qtys: number[], nextTotal: number): number[] {
  const total = Math.max(0, Math.round(nextTotal));
  const current = qtys.reduce((sum, qty) => sum + qty, 0);
  if (qtys.length === 0) return [];
  if (current <= 0) return qtys.map((_, index) => (index === 0 ? total : 0));
  const scaled = qtys.map(qty => Math.floor((qty * total) / current));
  let drift = total - scaled.reduce((sum, qty) => sum + qty, 0);
  for (let index = scaled.length - 1; drift > 0 && index >= 0; index -= 1) {
    scaled[index] += 1;
    drift -= 1;
  }
  return scaled;
}

export function groupedMatchesUngrouped(
  lines: GroupableEstimateLine[],
  marginPct: number,
): boolean {
  const grouped = groupEstimateLines(lines);
  const before = computeQuoteTotals(estimateSubtotal(lines), marginPct);
  const after = computeQuoteTotals(estimateSubtotal(grouped), marginPct);
  return before.subtotal === after.subtotal
    && before.marginAmount === after.marginAmount
    && before.gst === after.gst
    && before.total === after.total;
}
