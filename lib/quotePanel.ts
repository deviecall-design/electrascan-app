/**
 * The Price & send panel follows the estimate that was opened,
 * not the next free reference or the workspace default margin.
 */

import { estimateTotal } from "./estimateTotal";

export interface BoundEstimateRow {
  id?: string | null;
  reference?: string | null;
  ref?: string | null;
  margin_pct?: number | null;
  subtotal?: number | null;
  value?: number | null;
}

export function bindOpenedEstimate(input: {
  openedRef?: string | null;
  scanRef?: string | null;
  estimates: BoundEstimateRow[];
  items: Array<{ qty?: number; unitPrice?: number; status?: string }>;
}): { estimateId: string; marginPct: number; incGst: number } | null {
  const wanted = (input.openedRef || "").trim();
  const scanRef = (input.scanRef || "").trim();
  const key = wanted || scanRef;
  if (!key) return null;
  const row = input.estimates.find(item => item.id === key || item.reference === key || item.ref === key);
  if (!row && !wanted) return null;
  const total = estimateTotal({
    items: input.items,
    subtotal: row?.subtotal,
    marginPct: row?.margin_pct,
    value: row?.value,
  });
  return {
    estimateId: row?.reference || row?.ref || wanted || scanRef,
    marginPct: total.marginPct,
    incGst: total.incGst,
  };
}
