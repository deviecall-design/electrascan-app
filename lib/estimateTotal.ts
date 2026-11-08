/**
 * One quoted total for an estimate.
 * Priced takeoff lines win over a saved subtotal, and a saved subtotal wins
 * over a stale GST-inclusive value. Margin is the estimate's own margin.
 */

import { quotedSellExGst } from "./jobLink";
import { marginForQuote } from "./margin";
import { computeQuoteTotals, formatAud, roundCents } from "./quoteTotals";

export interface PricedLine {
  qty?: number;
  unitPrice?: number;
  status?: string;
}

export interface EstimateTotalInput {
  items?: PricedLine[] | null;
  subtotal?: number | null;
  marginPct?: number | null;
  value?: number | null;
}

export interface EstimateTotal {
  /** Line sell, ex GST, before margin. */
  sellExGst: number;
  marginPct: number;
  marginExGst: number;
  /** Sell plus margin, ex GST. This is the contract baseline. */
  contractExGst: number;
  gst: number;
  incGst: number;
  basis: "lines" | "subtotal" | "stored";
}

export function estimateTotal(input: EstimateTotalInput): EstimateTotal {
  const lineSell = input.items ? quotedSellExGst(input.items) : 0;
  const savedSubtotal = Number(input.subtotal ?? 0);
  const marginPct = marginForQuote(input.marginPct);
  const sellExGst = lineSell > 0 ? lineSell : (Number.isFinite(savedSubtotal) && savedSubtotal > 0 ? savedSubtotal : 0);
  const basis: EstimateTotal["basis"] = lineSell > 0 ? "lines" : sellExGst > 0 ? "subtotal" : "stored";
  if (sellExGst > 0) {
    const totals = computeQuoteTotals(sellExGst, marginPct);
    return {
      sellExGst: totals.subtotal,
      marginPct: totals.marginPct,
      marginExGst: totals.marginAmount,
      contractExGst: roundCents(totals.subtotal + totals.marginAmount),
      gst: totals.gst,
      incGst: totals.total,
      basis,
    };
  }
  return {
    sellExGst: 0,
    marginPct,
    marginExGst: 0,
    contractExGst: 0,
    gst: 0,
    incGst: roundCents(Number(input.value) || 0),
    basis: "stored",
  };
}

export function formatGstMoney(amount: number, basis: "ex" | "inc"): string {
  return `$${formatAud(amount)} ${basis === "inc" ? "inc GST" : "ex GST"}`;
}
