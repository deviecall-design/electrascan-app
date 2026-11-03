/**
 * Quote margin is a markup on the ex-GST subtotal.
 * 15 is only the starting default. A tenant default and a per-quote
 * override replace it. Saved quotes keep the margin stored on the estimate.
 */

import { DEFAULT_MARGIN_PCT } from "./quoteTotals";

const STORAGE_KEY = "es-default-margin-v1";

export function clampMargin(value: unknown, fallback = DEFAULT_MARGIN_PCT): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

export function loadDefaultMargin(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === "") return DEFAULT_MARGIN_PCT;
    return clampMargin(Number(raw));
  } catch {
    return DEFAULT_MARGIN_PCT;
  }
}

export function saveDefaultMargin(value: unknown) {
  const next = clampMargin(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* private mode */
  }
  return next;
}

/** A saved estimate wins. Otherwise use the tenant default. */
export function marginForQuote(saved: unknown, fallback?: unknown): number {
  if (typeof saved === "number" && Number.isFinite(saved)) return clampMargin(saved);
  if (saved != null && saved !== "" && Number.isFinite(Number(saved))) return clampMargin(Number(saved));
  return clampMargin(fallback ?? loadDefaultMargin());
}
