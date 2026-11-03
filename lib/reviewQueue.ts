/**
 * Least-sure detections first, plus the correction record and the end-of-scan recap.
 */

import type { LegendFlag } from "./legendMatch";

export interface ReviewItem {
  id: number;
  desc: string;
  symbol?: string;
  qty: number;
  conf: number;
  status?: string;
}

export interface DetectionCorrection {
  itemId: number;
  symbol: string;
  originalDesc: string;
  originalQty: number;
  correctedDesc: string;
  correctedQty: number;
  action: "confirmed" | "rejected" | "fixed";
}

export function confidenceQueue<T extends ReviewItem>(items: T[]): T[] {
  return items
    .filter(item => item.status !== "confirmed" && item.status !== "added" && item.status !== "rejected")
    .slice()
    .sort((a, b) => (a.conf || 0) - (b.conf || 0) || a.id - b.id);
}

export function correctionFrom(
  item: ReviewItem,
  action: DetectionCorrection["action"],
  next: { desc?: string; qty?: number } = {},
): DetectionCorrection {
  return {
    itemId: item.id,
    symbol: item.symbol || "",
    originalDesc: item.desc,
    originalQty: item.qty,
    correctedDesc: next.desc ?? item.desc,
    correctedQty: next.qty ?? item.qty,
    action,
  };
}

export interface ScanRecap {
  pagesRead: number | null;
  detected: number;
  confirmed: number;
  rejected: number;
  waiting: number;
  anomalies: string[];
}

export function scanRecap(
  items: ReviewItem[],
  options: { pageCount?: number | null; flags?: LegendFlag[] } = {},
): ScanRecap {
  const flags = options.flags ?? [];
  const low = items
    .filter(item => item.status !== "rejected" && item.conf > 0 && item.conf < 0.6)
    .map(item => `${item.desc} is below 60% confidence.`);
  return {
    pagesRead: options.pageCount ?? null,
    detected: items.length,
    confirmed: items.filter(item => item.status === "confirmed" || item.status === "added").length,
    rejected: items.filter(item => item.status === "rejected").length,
    waiting: confidenceQueue(items).length,
    anomalies: [...flags.map(flag => flag.message), ...low],
  };
}
