import { roundCents } from "./quoteTotals";

/**
 * Materials, labour, and margin for the quote breakdown.
 * Labour comes from the labour-by-role rows when those exist, and materials
 * are the rest of the ex-GST subtotal so the three parts add up to
 * subtotal + margin.
 */
export function splitCostBreakdown(input: {
  subtotal: number;
  margin: number;
  labourByRole?: Array<{ amount: number }>;
  fallbackLabour?: number;
}): { materials: number; labour: number; margin: number } {
  const fromRoles = (input.labourByRole ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const raw = input.labourByRole && input.labourByRole.length > 0 ? fromRoles : (input.fallbackLabour ?? 0);
  const subtotal = roundCents(Math.max(0, input.subtotal));
  const labour = roundCents(Math.min(subtotal, Math.max(0, raw)));
  const materials = roundCents(subtotal - labour);
  const margin = roundCents(Math.max(0, input.margin));
  return { materials, labour, margin };
}
