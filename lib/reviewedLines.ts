/**
 * Review resolutions are the source of truth for Quote and PDF lines.
 *
 * Detect still produces the raw takeoff. Classify / adjust writes qty, rate,
 * category and description back onto that line. Not in scope drops it from
 * the money. Flag for site check keeps the detected price.
 */

export type ReviewResolutionAction = "classify" | "not_in_scope" | "flag_site";

export interface ReviewClassifyData {
  category: string;
  description: string;
  qty: number;
  rate: number;
  symbol?: string;
}

export interface ReviewResolution {
  id: number;
  action: ReviewResolutionAction;
  classifyData?: ReviewClassifyData;
}

export interface ReviewableLine {
  id: number;
  symbol: string;
  qty: number;
  desc: string;
  rateCode: string;
  conf: number;
  x: number;
  y: number;
  unitPrice?: number;
  category?: string;
  room?: string;
  detectedType?: string;
}

export interface ReviewedLine extends ReviewableLine {
  /** Removed in Review. Quote totals and the PDF omit these lines. */
  excluded: boolean;
  /** Kept on the quote; flagged for a site check. Does not change the price. */
  flagged: boolean;
}

export function upsertResolution(
  resolutions: ReviewResolution[],
  id: number,
  action: ReviewResolutionAction,
  classifyData?: ReviewClassifyData,
): ReviewResolution[] {
  const row: ReviewResolution = { id, action, classifyData };
  const idx = resolutions.findIndex(r => r.id === id);
  if (idx === -1) return [...resolutions, row];
  const next = resolutions.slice();
  next[idx] = row;
  return next;
}

export function applyReviewResolutions(
  items: ReviewableLine[],
  resolutions: ReviewResolution[],
): ReviewedLine[] {
  const byId = new Map(resolutions.map(r => [r.id, r]));
  return items.map(item => {
    const res = byId.get(item.id);
    if (!res || res.action === "flag_site") {
      return { ...item, excluded: false, flagged: res?.action === "flag_site" };
    }
    if (res.action === "not_in_scope") {
      return {
        ...item,
        qty: 0,
        unitPrice: 0,
        rateCode: "",
        excluded: true,
        flagged: false,
      };
    }
    const data = res.classifyData;
    if (!data) return { ...item, excluded: false, flagged: false };
    return {
      ...item,
      desc: data.description || item.desc,
      qty: data.qty,
      unitPrice: data.rate,
      category: data.category || item.category,
      symbol: data.symbol || item.symbol,
      rateCode: "",
      excluded: false,
      flagged: false,
    };
  });
}

/** Lines that still contribute money after Review. */
export function linesForQuote<T extends ReviewedLine>(items: T[]): T[] {
  return items.filter(it => !it.excluded);
}
