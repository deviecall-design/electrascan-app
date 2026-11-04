/**
 * Review takeoff rundown. A line is priced when it has a sell price
 * from a typed price, a rate code, an assembly, or a stored unit price.
 */

import type { StoredDetectedItem } from "./scanRecord";
import type { Assembly } from "./assemblies";
import type { StoredContractorPrice } from "./priceFile";
import { priceItem, type QuotePrice } from "./quoteSource";
import type { RateLike } from "./takeoff";

export interface RundownRow {
  item: StoredDetectedItem;
  quote: QuotePrice;
  priced: boolean;
  lineTotal: number;
  category: string;
}

export interface TakeoffRundown {
  scanned: number;
  priced: number;
  unpriced: number;
  total: number;
  gaps: RundownRow[];
  groups: { category: string; total: number; rows: RundownRow[] }[];
}

export function reviewCategory(item: {
  symbol?: string;
  desc?: string;
  detectedType?: string;
  category?: string;
}): string {
  const blob = `${item.detectedType || ""} ${item.symbol || ""} ${item.desc || ""}`.toLowerCase();
  if (blob.includes("switchboard") || blob.includes("distribution") || item.symbol === "DB") return "Distribution boards";
  if (blob.includes("switch")) return "Switching";
  if (blob.includes("smoke") || item.symbol === "SA") return "Smoke alarms";
  if (blob.includes("data") || blob.includes("cat6") || item.symbol === "DC") return "Data";
  if (blob.includes("gpo") || blob.includes("power point") || blob.includes("powerpoint") || item.symbol === "GPO") return "Power";
  if (blob.includes("light") || blob.includes("lamp") || item.symbol === "LT") return "Lighting";
  return item.category || "Other";
}

export function takeoffRundown(
  items: StoredDetectedItem[],
  rates: RateLike[] = [],
  assemblies: Assembly[] = [],
  labourRate = 110,
  priceList: StoredContractorPrice[] = [],
): TakeoffRundown {
  const rows: RundownRow[] = items.map(item => {
    const quote = priceItem(item, rates, assemblies, labourRate, priceList);
    const priced = item.status !== "rejected" && quote.sellUnit > 0;
    return {
      item,
      quote,
      priced,
      lineTotal: item.status === "rejected" ? 0 : item.qty * quote.sellUnit,
      category: reviewCategory(item),
    };
  });
  const open = rows.filter(row => row.item.status !== "rejected");
  const buckets = new Map<string, RundownRow[]>();
  for (const row of rows) {
    const list = buckets.get(row.category) ?? [];
    list.push(row);
    buckets.set(row.category, list);
  }
  const groups = [...buckets.entries()]
    .map(([category, groupRows]) => ({
      category,
      rows: groupRows,
      total: groupRows.reduce((sum, row) => sum + row.lineTotal, 0),
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  return {
    scanned: open.length,
    priced: open.filter(row => row.priced).length,
    unpriced: open.filter(row => !row.priced).length,
    total: open.reduce((sum, row) => sum + row.lineTotal, 0),
    gaps: open.filter(row => !row.priced),
    groups,
  };
}
