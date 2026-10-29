/**
 * Compare two saved estimate takeoffs. Matching is by description so a
 * revised scan can be priced and diffed without a separate sample job.
 */

import { readDetectedItems, type StoredDetectedItem } from "./scanRecord";
import { computeQuoteTotals, DEFAULT_MARGIN_PCT } from "./quoteTotals";
import { costSplit, type RateLike } from "./takeoff";

export interface TakeoffLine {
  description: string;
  qty: number;
  unitPrice: number;
  materialUnit?: number;
  labourUnit?: number;
}

export type VariationChange = "added" | "removed" | "increased" | "decreased";

export interface VariationLine {
  description: string;
  prevQty: number;
  newQty: number;
  unitPrice: number;
  materialDelta: number;
  labourDelta: number;
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
    const materialUnit = typeof record.materialUnit === "number" ? record.materialUnit : undefined;
    const labourUnit = typeof record.labourUnit === "number" ? record.labourUnit : undefined;
    lines.push({
      description,
      qty,
      unitPrice,
      ...(materialUnit != null ? { materialUnit } : {}),
      ...(labourUnit != null ? { labourUnit } : {}),
    });
  }
  return lines;
}

function keyOf(description: string) {
  return description.trim().toLowerCase();
}

function materialOf(line: TakeoffLine) {
  return line.materialUnit ?? line.unitPrice;
}

function labourOf(line: TakeoffLine) {
  return line.labourUnit ?? 0;
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
      const materialDelta = line.qty * materialOf(line);
      const labourDelta = line.qty * labourOf(line);
      changes.push({
        description: line.description,
        prevQty: 0,
        newQty: line.qty,
        unitPrice: line.unitPrice,
        materialDelta,
        labourDelta,
        delta: materialDelta + labourDelta,
        change: "added",
      });
      continue;
    }
    if (before.qty === line.qty && materialOf(before) === materialOf(line) && labourOf(before) === labourOf(line)) continue;
    const materialDelta = line.qty * materialOf(line) - before.qty * materialOf(before);
    const labourDelta = line.qty * labourOf(line) - before.qty * labourOf(before);
    const delta = materialDelta + labourDelta;
    if (delta === 0 && before.qty === line.qty) continue;
    changes.push({
      description: line.description,
      prevQty: before.qty,
      newQty: line.qty,
      unitPrice: line.unitPrice || before.unitPrice,
      materialDelta,
      labourDelta,
      delta,
      change: line.qty > before.qty || delta > 0 ? "increased" : "decreased",
    });
  }

  for (const line of previous) {
    const key = keyOf(line.description);
    if (seen.has(key) || nextByKey.has(key)) continue;
    const materialDelta = -line.qty * materialOf(line);
    const labourDelta = -line.qty * labourOf(line);
    changes.push({
      description: line.description,
      prevQty: line.qty,
      newQty: 0,
      unitPrice: line.unitPrice,
      materialDelta,
      labourDelta,
      delta: materialDelta + labourDelta,
      change: "removed",
    });
  }

  return changes;
}

export function linesOf(estimate: EstimateForDiff | null | undefined): TakeoffLine[] {
  return asLines(estimate?.line_items).filter(line => line.qty > 0 && line.description !== "Takeoff verified");
}

function lineFromItem(item: StoredDetectedItem, rates: RateLike[]): TakeoffLine {
  const unitPrice = typeof item.unitPrice === "number" && item.unitPrice > 0 ? item.unitPrice : 0;
  // Keep the saved catalogue price. A rate-library keyword match can price
  // the same symbol lower, and that must not rewrite the takeoff total.
  const materialUnit = typeof item.materialUnit === "number" ? item.materialUnit : unitPrice;
  const storedLabour = typeof item.labourUnit === "number" ? item.labourUnit : null;
  const labourUnit = storedLabour != null ? storedLabour : (rates.length > 0 ? costSplit(item, rates).labour : 0);
  return {
    description: item.desc.trim(),
    qty: item.qty,
    unitPrice,
    materialUnit,
    labourUnit,
  };
}

/** Priced symbols stored on a scan. Rejected hits are not part of the variation. */
export function linesFromDetected(raw: unknown, rates: RateLike[] = []): TakeoffLine[] {
  return readDetectedItems(raw)
    .filter(item => item.status !== "rejected" && item.qty > 0 && item.desc.trim() && item.desc !== "Takeoff verified")
    .map(item => lineFromItem(item, rates));
}

export function materialsExGst(lines: TakeoffLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty * materialOf(line), 0);
}

export function labourExGst(lines: TakeoffLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty * labourOf(line), 0);
}

/** GST-inclusive value of unquoted takeoffs. Pending quotes stay a separate figure. */
export function reviewTakeoffIncGst(
  scans: Array<{ estimate_ref?: string | null; detected_items?: unknown }>,
  rates: RateLike[] = [],
): number {
  return scans
    .filter(scan => !scan.estimate_ref)
    .reduce((sum, scan) => sum + takeoffIncGst(linesFromDetected(scan.detected_items, rates)), 0);
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

/** Same job: explicit client, otherwise the one unassigned Vesh takeoff. */
export function variationProjectKey(scan: { client?: string | null }): string {
  const client = (scan.client || "").trim().toLowerCase();
  return client || "unassigned";
}

export interface VariationVersion<T> {
  scan: T;
  lines: TakeoffLine[];
  changes: VariationLine[];
  materials: number;
  labour: number;
}

function startedMs(value?: string | null) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : 0;
}

/** Oldest plan first. Each later plan is a variation against the one before it. */
export function variationChain<T extends { client?: string | null; started_at?: string | null; detected_items?: unknown }>(
  scans: T[],
  project?: string,
  rates: RateLike[] = [],
): VariationVersion<T>[] {
  const key = project ?? (scans[0] ? variationProjectKey(scans[0]) : "unassigned");
  const ordered = scans
    .filter(scan => variationProjectKey(scan) === key)
    .sort((a, b) => startedMs(a.started_at) - startedMs(b.started_at));
  return ordered.map((scan, index) => {
    const lines = linesFromDetected(scan.detected_items, rates);
    const prev = index > 0 ? linesFromDetected(ordered[index - 1].detected_items, rates) : null;
    return {
      scan,
      lines,
      changes: prev ? diffTakeoffLines(prev, lines) : [],
      materials: materialsExGst(lines),
      labour: labourExGst(lines),
    };
  });
}
