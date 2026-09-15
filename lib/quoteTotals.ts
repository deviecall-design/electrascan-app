/**
 * Shared AU estimate arithmetic for the live Quote path.
 *
 * Contract (Vesh / ATO GST):
 *   line total     = qty × unit price (ex GST)
 *   subtotal       = sum of line totals
 *   margin amount  = subtotal × (marginPct / 100)   // markup on ex-GST cost
 *   GST            = (subtotal + margin) × gstRate  // default 10%
 *   total inc GST  = subtotal + margin + GST
 *
 * Prices in the Vesh catalogue are ex GST. Margin is applied before GST.
 */

export const AU_GST_RATE = 0.1;
export const DEFAULT_MARGIN_PCT = 15; // Vesh company profile default

/** Round to whole cents (AUD). */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface QuoteTotals {
  subtotal: number;
  marginAmount: number;
  gst: number;
  total: number;
  marginPct: number;
  gstRatePct: number;
}

export function computeQuoteTotals(
  subtotal: number,
  marginPct: number,
  gstRate: number = AU_GST_RATE,
): QuoteTotals {
  const safeSub = Math.max(0, subtotal);
  const safeMargin = Math.max(0, marginPct);
  const safeGst = Math.max(0, gstRate);
  const marginAmount = roundCents(safeSub * (safeMargin / 100));
  const exGst = roundCents(safeSub + marginAmount);
  const gst = roundCents(exGst * safeGst);
  const total = roundCents(exGst + gst);
  return {
    subtotal: roundCents(safeSub),
    marginAmount,
    gst,
    total,
    marginPct: safeMargin,
    gstRatePct: safeGst * 100,
  };
}

export function lineTotal(qty: number, unitPrice: number): number {
  return roundCents(Math.max(0, qty) * Math.max(0, unitPrice));
}

export function formatAud(n: number, wholeDollars = false): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: wholeDollars ? 0 : 2,
    maximumFractionDigits: wholeDollars ? 0 : 2,
  });
}
