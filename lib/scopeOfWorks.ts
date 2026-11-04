/**
 * Template scope of works for an electrical quote.
 * Built from the takeoff, assemblies, legend, and schedules.
 * The contractor can edit every section before it is saved.
 */

import { matchAssembly, type Assembly } from "./assemblies";
import type { LegendRow } from "./legendMatch";

export interface ScopeSection {
  heading: string;
  lines: string[];
}

export interface ScopeOfWorks {
  inclusions: ScopeSection[];
  exclusions: string[];
  assumptions: string[];
  compliance: string;
  clarifications: string[];
}

export const COMPLIANCE_NOTE =
  "All electrical work will be carried out in accordance with AS/NZS 3000 (Wiring Rules) and the applicable state service and installation rules. A certificate of compliance will be issued for the completed work.";

export const DEFAULT_EXCLUSIONS = [
  "Making good, patching, plastering, and painting",
  "NBN lead-in, pit, and carrier network-boundary work",
  "Supply-authority fees, metering charges, and network connection fees unless listed",
  "Asbestos removal and other hazardous-material work",
  "Structural openings that need an engineer",
  "Whitegoods, appliances, and fittings supplied by others, unless listed",
  "Active data equipment, programming, and third-party system commissioning unless listed",
  "After-hours or weekend labour unless listed",
];

export const DEFAULT_ASSUMPTIONS = [
  "The drawings, legend, and schedules provided are the scope documents.",
  "The existing installation is safe to isolate and connect to.",
  "Work is carried out in ordinary weekday hours with clear access.",
  "Fittings marked TBC are selected by the client before they are ordered.",
  "Cable routes follow the shortest compliant path unless the drawings show otherwise.",
  "Quantities are taken from the detected plan symbols and the schedules.",
];

const LOW_CONFIDENCE = 0.75;

export interface ScopeItem {
  desc?: string;
  qty?: number;
  room?: string;
  category?: string;
  symbol?: string;
  rateCode?: string;
  unitPrice?: number;
  conf?: number;
  status?: string;
}

export function linesFromText(value: string): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export function textFromLines(lines: string[]): string {
  return lines.join("\n");
}

function norm(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function billable(item: ScopeItem): boolean {
  return item.status !== "rejected" && (item.qty ?? 0) > 0 && Boolean((item.desc || "").trim());
}

function unpriced(item: ScopeItem, assemblies: Assembly[]): boolean {
  if ((item.unitPrice ?? 0) > 0 || (item.rateCode || "").trim()) return false;
  return !matchAssembly(item, assemblies);
}

export function generateScope(input: {
  items: ScopeItem[];
  assemblies?: Assembly[];
  legend?: LegendRow[];
  schedules?: LegendRow[];
}): ScopeOfWorks {
  const assemblies = input.assemblies ?? [];
  const items = input.items.filter(billable);
  const legend = (input.legend ?? []).filter(row => (row.description || row.symbol || "").trim());
  const schedules = (input.schedules ?? []).filter(row => (row.description || row.symbol || "").trim());
  const rooms = [...new Set(items.map(item => (item.room || "").trim()).filter(Boolean))];
  const byRoom = rooms.length >= 2;

  const buckets = new Map<string, Map<string, { qty: number; desc: string; symbol?: string; category?: string }>>();
  for (const item of items) {
    const heading = byRoom ? (item.room || "General").trim() : (item.category || "General").trim() || "General";
    const desc = item.desc!.trim();
    const group = buckets.get(heading) ?? new Map();
    const key = norm(desc);
    const existing = group.get(key);
    if (existing) existing.qty += item.qty ?? 0;
    else group.set(key, { qty: item.qty ?? 0, desc, symbol: item.symbol, category: item.category });
    buckets.set(heading, group);
  }

  const inclusions: ScopeSection[] = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([heading, group]) => ({
      heading,
      lines: [...group.values()]
        .sort((a, b) => a.desc.localeCompare(b.desc))
        .map(line => {
          const assembly = matchAssembly({ desc: line.desc, symbol: line.symbol }, assemblies);
          const named = assembly && norm(assembly.name) !== norm(line.desc) ? ` — ${assembly.name}` : "";
          return `${line.qty} × ${line.desc}${named}`;
        }),
    }));

  if (legend.length > 0) {
    inclusions.push({
      heading: "Drawing legend",
      lines: legend.map(row => [row.symbol, row.description].filter(Boolean).join(" — ")),
    });
  }
  if (schedules.length > 0) {
    inclusions.push({
      heading: "Schedules",
      lines: schedules.map(row => {
        const label = [row.symbol, row.description].filter(Boolean).join(" — ");
        return row.quantity != null ? `${row.quantity} × ${label}` : label;
      }),
    });
  }

  const clarifications: string[] = [];
  for (const item of items) {
    const label = item.desc!.trim();
    if (typeof item.conf === "number" && item.conf < LOW_CONFIDENCE && item.status !== "confirmed" && item.status !== "added") {
      clarifications.push(`${label} is low confidence (${Math.round(item.conf * 100)}%). Confirm the symbol before it is ordered.`);
    }
    if (unpriced(item, assemblies)) {
      clarifications.push(`${label} has no price. Confirm the fitting and the rate before this quote is sent.`);
    }
    if (/\btbc\b/i.test(label)) {
      clarifications.push(`${label} is still to be confirmed by the client.`);
    }
  }
  for (const row of [...legend, ...schedules]) {
    if (row.quantity == null) continue;
    const wanted = norm(row.description) || norm(row.symbol);
    const detected = items
      .filter(item => norm(item.desc).includes(wanted) || norm(item.symbol) === norm(row.symbol))
      .reduce((sum, item) => sum + (item.qty ?? 0), 0);
    if (detected !== row.quantity) {
      clarifications.push(`${row.kind === "schedule" ? "Schedule" : "Legend"} shows ${row.quantity} × ${row.description || row.symbol}; the takeoff has ${detected}.`);
    }
  }

  return {
    inclusions: inclusions.length > 0 ? inclusions : [{ heading: "Inclusions", lines: ["No billable items on this takeoff yet."] }],
    exclusions: [...DEFAULT_EXCLUSIONS],
    assumptions: [...DEFAULT_ASSUMPTIONS],
    compliance: COMPLIANCE_NOTE,
    clarifications: [...new Set(clarifications)],
  };
}

export function parseScope(raw: unknown): ScopeOfWorks | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Partial<ScopeOfWorks>;
  const inclusions = Array.isArray(record.inclusions)
    ? record.inclusions.flatMap(section => {
        if (!section || typeof section !== "object") return [];
        const heading = typeof section.heading === "string" ? section.heading : "Inclusions";
        const lines = Array.isArray(section.lines) ? section.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0) : [];
        return [{ heading, lines }];
      })
    : [];
  if (inclusions.length === 0 && typeof record.compliance !== "string") return null;
  const strings = (value: unknown, fallback: string[]) =>
    Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : fallback;
  return {
    inclusions: inclusions.length > 0 ? inclusions : [{ heading: "Inclusions", lines: [] }],
    exclusions: strings(record.exclusions, DEFAULT_EXCLUSIONS),
    assumptions: strings(record.assumptions, DEFAULT_ASSUMPTIONS),
    compliance: typeof record.compliance === "string" && record.compliance.trim() ? record.compliance : COMPLIANCE_NOTE,
    clarifications: strings(record.clarifications, []),
  };
}

export function readScopeFromEstimate(estimate: { line_items?: unknown; scope_of_works?: unknown } | null | undefined): ScopeOfWorks | null {
  if (!estimate) return null;
  const column = parseScope(estimate.scope_of_works);
  if (column) return column;
  if (!Array.isArray(estimate.line_items)) return null;
  const row = estimate.line_items.find(entry => entry && typeof entry === "object" && (entry as { meta?: string }).meta === "scope") as { scope?: unknown } | undefined;
  return parseScope(row?.scope);
}

export function scopeLineItem(scope: ScopeOfWorks) {
  return { description: "Scope of works", qty: 0, unitPrice: 0, meta: "scope" as const, scope };
}
