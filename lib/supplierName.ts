/**
 * The customer-facing supplier name is TLE.
 * Older rows may still say Lawrence & Hanson or L&H. Those labels display
 * and save as TLE. Any other stored supplier name is left unchanged.
 */

export const TLE_SUPPLIER_NAME = "TLE";

const LEGACY_SUPPLIER_NAMES = new Set([
  "lawrence & hanson",
  "lawrence and hanson",
  "l&h",
  "l & h",
  "l and h",
]);

export function canonicalSupplierName(value: string | null | undefined, fallback = TLE_SUPPLIER_NAME): string {
  const trimmed = String(value ?? "").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  if (LEGACY_SUPPLIER_NAMES.has(trimmed.toLowerCase())) return TLE_SUPPLIER_NAME;
  return trimmed;
}
