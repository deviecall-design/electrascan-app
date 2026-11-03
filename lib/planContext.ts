import type { LegendRow } from "./legendMatch";

export interface PlanContext {
  pageCount: number | null;
  legend: LegendRow[];
  schedules: LegendRow[];
  notes: string[];
}

const KEY = "es-plan-context-v1";

export function rememberPlanContext(fileName: string, context: PlanContext) {
  try {
    const all = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    all[fileName] = context;
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

export function recallPlanContext(fileName: string | null | undefined): PlanContext | null {
  if (!fileName) return null;
  try {
    const all = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    return all[fileName] ?? null;
  } catch {
    return null;
  }
}

export function planContextFromFlags(flags: unknown): PlanContext | null {
  if (!Array.isArray(flags)) return null;
  const row = flags.find(entry => entry && typeof entry === "object" && (entry as { type?: string }).type === "plan_context") as
    | { pageCount?: number; legend?: LegendRow[]; schedules?: LegendRow[]; notes?: string[] }
    | undefined;
  if (!row) return null;
  return {
    pageCount: typeof row.pageCount === "number" ? row.pageCount : null,
    legend: Array.isArray(row.legend) ? row.legend : [],
    schedules: Array.isArray(row.schedules) ? row.schedules : [],
    notes: Array.isArray(row.notes) ? row.notes : [],
  };
}
