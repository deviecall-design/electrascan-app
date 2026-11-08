/**
 * Keep in step with lib/supplierName.ts.
 * Stored Lawrence & Hanson / L&H labels become TLE. Other names stay.
 */

const TLE_SUPPLIER_NAME = "TLE";

const LEGACY_SUPPLIER_NAMES = new Set([
  "lawrence & hanson",
  "lawrence and hanson",
  "l&h",
  "l & h",
  "l and h",
]);

export function canonicalSupplierName(value, fallback = TLE_SUPPLIER_NAME) {
  const trimmed = String(value ?? "").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  if (LEGACY_SUPPLIER_NAMES.has(trimmed.toLowerCase())) return TLE_SUPPLIER_NAME;
  return trimmed;
}

export { TLE_SUPPLIER_NAME };
