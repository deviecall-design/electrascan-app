/**
 * Compare two saved estimate takeoffs. Matching is by description so a
 * revised scan can be priced and diffed without a separate sample job.
 */

import { readDetectedItems } from "./scanRecord";
import { computeQuoteTotals, DEFAULT_MARGIN_PCT } from "./quoteTotals";

export interface TakeoffLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export type VariationChange = "added" | "removed" | "increased" | "decreased";

export interface VariationLine {
  description: string;
  prevQty: number;
  newQty: number;
  unitPrice: number;
  delta: number;
  change: VariationChange;
}

export interface EstimateForDiff {
  id?: string;
  reference?: string | null;
  ref?: string | null;
  client?: string | null;
  project_name?: string | null;
  value?: number | null;
  subtotal?: number | null;
  line_items?: unknown;
  created_at?: string | null;
}

function asLines(raw: unknown): TakeoffLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: TakeoffLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const description = typeof record.description === "string"
      ? record.description.trim()
      : typeof record.desc === "string"
        ? record.desc.trim()
        : "";
    const qty = typeof record.qty === "number" ? record.qty : Number(record.qty);
    const unitPrice = typeof record.unitPrice === "number"
      ? record.unitPrice
      : typeof record.unit_price === "number"
        ? record.unit_price
        : Number(record.unitPrice);
    if (!description || !Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue;
    lines.push({ description, qty, unitPrice });
  }
  return lines;
}

function keyOf(description: string) {
  return description.trim().toLowerCase();
}

export function diffTakeoffLines(previous: TakeoffLine[], next: TakeoffLine[]): VariationLine[] {
  const prevByKey = new Map<string, TakeoffLine>();
  for (const line of previous) prevByKey.set(keyOf(line.description), line);
  const nextByKey = new Map<string, TakeoffLine>();
  for (const line of next) nextByKey.set(keyOf(line.description), line);

  const changes: VariationLine[] = [];
  const seen = new Set<string>();

  for (const line of next) {
    const key = keyOf(line.description);
    seen.add(key);
    const before = prevByKey.get(key);
    if (!before) {
      changes.push({
        description: line.description,
        prevQty: 0,
        newQty: line.qty,
        unitPrice: line.unitPrice,
        delta: line.qty * line.unitPrice,
        change: "added",
      });
      continue;
    }
    if (before.qty === line.qty) continue;
    const unitPrice = line.unitPrice || before.unitPrice;
    changes.push({
      description: line.description,
      prevQty: before.qty,
      newQty: line.qty,
      unitPrice,
      delta: (line.qty - before.qty) * unitPrice,
      change: line.qty > before.qty ? "increased" : "decreased",
    });
  }

  for (const line of previous) {
    const key = keyOf(line.description);
    if (seen.has(key) || nextByKey.has(key)) continue;
    changes.push({
      description: line.description,
      prevQty: line.qty,
      newQty: 0,
      unitPrice: line.unitPrice,
      delta: -line.qty * line.unitPrice,
      change: "removed",
    });
  }

  return changes;
}

export function linesOf(estimate: EstimateForDiff | null | undefined): TakeoffLine[] {
  return asLines(estimate?.line_items).filter(line => line.qty > 0 && line.description !== "Takeoff verified");
}

/** Priced symbols stored on a scan. Rejected hits are not part of the variation. */
export function linesFromDetected(raw: unknown): TakeoffLine[] {
  return readDetectedItems(raw)
    .filter(item => item.status !== "rejected" && item.qty > 0 && item.desc.trim() && item.desc !== "Takeoff verified")
    .map(item => ({
      description: item.desc.trim(),
      qty: item.qty,
      unitPrice: typeof item.unitPrice === "number" && item.unitPrice > 0 ? item.unitPrice : 0,
    }));
}

export function materialsExGst(lines: TakeoffLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
}

export function takeoffIncGst(lines: TakeoffLine[], marginPct: number = DEFAULT_MARGIN_PCT): number {
  return computeQuoteTotals(materialsExGst(lines), marginPct).total;
}

/**
 * Prefer two quotes for the same client. Fall back to the two newest quotes
 * that actually have takeoff lines. Returns older first.
 */
export function pickVariationPair(estimates: EstimateForDiff[]): {
  base: EstimateForDiff;
  next: EstimateForDiff;
} | null {
  const usable = estimates.filter(estimate => linesOf(estimate).length > 0);
  if (usable.length < 2) return null;

  const newestFirst = [...usable].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return bTime - aTime;
  });

  const newest = newestFirst[0];
  const client = (newest.client || "").trim().toLowerCase();
  const sameClient = client
    ? newestFirst.find((estimate, index) => index > 0 && (estimate.client || "").trim().toLowerCase() === client)
    : undefined;
  const base = sameClient ?? newestFirst[1];
  return { base, next: newest };
}

export function estimateRef(estimate: EstimateForDiff): string {
  return estimate.reference || estimate.ref || "Untitled";
}
