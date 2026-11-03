/**
 * Compare detections with the legend and schedules read from the plan.
 */

export interface LegendRow {
  symbol: string;
  description: string;
  quantity?: number;
  inScope?: boolean;
  kind?: "legend" | "schedule" | "note";
}

export interface LegendFlag {
  kind: "not_in_legend" | "missing_on_plan";
  message: string;
  symbol: string;
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function overlaps(a: string, b: string) {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

export function legendFlags(
  rows: LegendRow[],
  items: Array<{ symbol?: string; desc?: string; qty?: number; status?: string }>,
): LegendFlag[] {
  const legend = rows.filter(row => row.kind !== "note" && row.description.trim());
  const live = items.filter(item => item.status !== "rejected" && (item.qty ?? 0) > 0);
  const flags: LegendFlag[] = [];

  for (const item of live) {
    const label = item.desc || item.symbol || "Symbol";
    const matched = legend.some(row => overlaps(label, row.description) || overlaps(item.symbol || "", row.symbol));
    if (legend.length > 0 && !matched) {
      flags.push({
        kind: "not_in_legend",
        symbol: item.symbol || "",
        message: `${label} was detected but it is not on this plan's legend.`,
      });
    }
  }

  for (const row of legend) {
    if (row.inScope === false) continue;
    if ((row.quantity ?? 1) <= 0) continue;
    const found = live.some(item => overlaps(item.desc || "", row.description) || overlaps(item.symbol || "", row.symbol));
    if (!found) {
      flags.push({
        kind: "missing_on_plan",
        symbol: row.symbol,
        message: `${row.description} is on the legend and was not found on the plan.`,
      });
    }
  }

  return flags;
}
