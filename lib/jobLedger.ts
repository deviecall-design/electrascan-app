/**
 * Weekly job ledger. The baseline is the contract ex GST.
 * Each week deducts actual cost. Remaining is baseline minus cumulative cost.
 */

import { roundCents } from "./quoteTotals";
import { isHourlyCharge, type LabourRole } from "./labourRates";

export type CostKind = "timesheet" | "supplier" | "other";

export interface LedgerCost {
  id: string;
  date: string;
  kind: CostKind;
  amount: number;
  hours?: number;
  roleName?: string;
  supplier?: string;
  reference?: string;
  note?: string;
}

export interface LedgerClaim {
  id: string;
  date: string;
  label: string;
  amount: number;
  status: "draft" | "invoiced" | "paid" | "unpaid";
  kind: "claim" | "invoice";
}

export interface LedgerWeek {
  label: string;
  start: string;
  labour: number;
  supplier: number;
  other: number;
  cost: number;
  cumulativeCost: number;
  claims: number;
  invoices: number;
  cumulativeClaimed: number;
  remaining: number;
  plannedCumulative: number;
  variance: number;
  /** True when this week is behind the plan or already over the budget. */
  ahead: boolean;
  pace: PlanPace;
  items: LedgerCost[];
  claimItems: LedgerClaim[];
}

export interface LedgerSummary {
  baselineExGst: number;
  costToDate: number;
  remaining: number;
  claimedToDate: number;
  paidToDate: number;
  marginToDatePct: number;
  forecastAtCompletion: number;
}

/** Invoiced, invoiced draft, and received claims. Ready-to-claim stays out of the column. */
export function claimCountsTowardTotal(status: LedgerClaim["status"]): boolean {
  return status === "draft" || status === "invoiced" || status === "paid";
}

export type PlanPace = "future" | "on-plan" | "ahead" | "behind" | "over-budget";

export const PACE_LABEL: Record<PlanPace, string> = {
  future: "Forecast",
  "on-plan": "On plan",
  ahead: "Ahead",
  behind: "Behind",
  "over-budget": "Over budget",
};

/** Green when more budget is left than planned, red when the week has fallen behind. */
export const PACE_COLOR: Record<PlanPace, string> = {
  future: "#64748B",
  "on-plan": "#64748B",
  ahead: "#10B981",
  behind: "#EF4444",
  "over-budget": "#e11d48",
};

/** Within 2% of the planned remaining, or $100, whichever is wider. */
export function planTolerance(plannedRemaining: number): number {
  return Math.max(100, Math.abs(plannedRemaining) * 0.02);
}

export function planPace(input: {
  plannedRemaining: number;
  actualRemaining: number | null;
  cumulativeCost: number;
  baseline: number;
}): PlanPace {
  if (input.actualRemaining == null) return "future";
  const gap = input.actualRemaining - input.plannedRemaining;
  if (Math.abs(gap) <= planTolerance(input.plannedRemaining) + 0.001) return "on-plan";
  if (input.actualRemaining < -0.009 || input.cumulativeCost > input.baseline + 0.009) return "over-budget";
  if (gap > 0) return "ahead";
  return "behind";
}

export function categoryOverrun(input: {
  labourSpent: number;
  labourBudget: number;
  materialsSpent: number;
  materialsBudget: number;
  otherSpent: number;
}): number {
  return roundCents(
    Math.max(0, input.otherSpent)
    + Math.max(0, input.labourSpent - input.labourBudget)
    + Math.max(0, input.materialsSpent - input.materialsBudget),
  );
}

export function priceTimesheet(hours: number, role: LabourRole | null, fallbackRate: number): number {
  const rate = role && isHourlyCharge(role.chargeType) && role.rate > 0 ? role.rate : Math.max(0, fallbackRate);
  return roundCents(Math.max(0, hours) * rate);
}

function dayMs(value: string): number {
  const ms = Date.parse(`${value.slice(0, 10)}T00:00:00`);
  return Number.isFinite(ms) ? ms : 0;
}

function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekBuckets(start: string, end: string): string[] {
  const first = new Date(dayMs(start));
  const last = dayMs(end);
  if (!first.getTime() || !last || first.getTime() > last) return [];
  const out: string[] = [];
  const cursor = new Date(first);
  while (cursor.getTime() <= last && out.length < 26) {
    out.push(formatDay(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

function spanFrom(costs: LedgerCost[], claims: LedgerClaim[], start?: string, end?: string): string[] {
  const dates = [
    ...(start ? [start] : []),
    ...(end ? [end] : []),
    ...costs.map(row => row.date),
    ...claims.map(row => row.date),
  ].filter(Boolean).sort();
  if (dates.length === 0) return [];
  return weekBuckets(dates[0], dates[dates.length - 1]);
}

export function buildLedger(input: {
  baselineExGst: number;
  start?: string;
  end?: string;
  costs: LedgerCost[];
  claims: LedgerClaim[];
  today?: string;
}): { weeks: LedgerWeek[]; summary: LedgerSummary } {
  const baseline = roundCents(Math.max(0, input.baselineExGst));
  const starts = spanFrom(input.costs, input.claims, input.start, input.end);
  const weeks: LedgerWeek[] = [];
  let cumulativeCost = 0;
  let cumulativeClaimed = 0;
  starts.forEach((start, index) => {
    const next = starts[index + 1] ? dayMs(starts[index + 1]) : Number.POSITIVE_INFINITY;
    const from = dayMs(start);
    const items = input.costs.filter(row => {
      const ms = dayMs(row.date);
      return ms >= from && ms < next;
    });
    const claimItems = input.claims.filter(row => {
      const ms = dayMs(row.date);
      return ms >= from && ms < next;
    });
    const labour = roundCents(items.filter(row => row.kind === "timesheet").reduce((sum, row) => sum + row.amount, 0));
    const supplier = roundCents(items.filter(row => row.kind === "supplier").reduce((sum, row) => sum + row.amount, 0));
    const other = roundCents(items.filter(row => row.kind === "other").reduce((sum, row) => sum + row.amount, 0));
    const cost = roundCents(labour + supplier + other);
    cumulativeCost = roundCents(cumulativeCost + cost);
    const recognisedItems = claimItems.filter(row => claimCountsTowardTotal(row.status));
    const claims = roundCents(recognisedItems.filter(row => row.kind === "claim").reduce((sum, row) => sum + row.amount, 0));
    const invoices = roundCents(recognisedItems.filter(row => row.kind === "invoice").reduce((sum, row) => sum + row.amount, 0));
    const recognised = recognisedItems.reduce((sum, row) => sum + row.amount, 0);
    cumulativeClaimed = roundCents(cumulativeClaimed + recognised);
    const plannedCumulative = roundCents(baseline * ((index + 1) / starts.length));
    const variance = roundCents(cumulativeCost - plannedCumulative);
    const remaining = roundCents(baseline - cumulativeCost);
    const pace = planPace({
      plannedRemaining: roundCents(baseline - plannedCumulative),
      actualRemaining: remaining,
      cumulativeCost,
      baseline,
    });
    weeks.push({
      label: start.slice(5),
      start,
      labour,
      supplier,
      other,
      cost,
      cumulativeCost,
      claims,
      invoices,
      cumulativeClaimed,
      remaining,
      plannedCumulative,
      variance,
      ahead: pace === "behind" || pace === "over-budget",
      pace,
      items,
      claimItems,
    });
  });
  const costToDate = weeks.length ? weeks[weeks.length - 1].cumulativeCost : 0;
  const claimedToDate = roundCents(input.claims.filter(row => claimCountsTowardTotal(row.status)).reduce((sum, row) => sum + row.amount, 0));
  const paidToDate = roundCents(input.claims.filter(row => row.status === "paid").reduce((sum, row) => sum + row.amount, 0));
  const today = input.today || formatDay(new Date());
  const elapsed = weeks.filter(week => week.start <= today).length || (weeks.length ? 1 : 0);
  const forecastAtCompletion = elapsed > 0 && weeks.length > 0
    ? roundCents(costToDate / elapsed * weeks.length)
    : costToDate;
  return {
    weeks,
    summary: {
      baselineExGst: baseline,
      costToDate,
      remaining: roundCents(baseline - costToDate),
      claimedToDate,
      paidToDate,
      marginToDatePct: baseline > 0 ? roundCents((baseline - costToDate) / baseline * 100) : 0,
      forecastAtCompletion,
    },
  };
}

/** Remaining budget at a week. Actual is blank for a week that has not started. */
export function remainingAt(week: LedgerWeek, baseline: number, today: string): {
  planned: number;
  actual: number | null;
  ahead: boolean;
  pace: PlanPace;
} {
  const planned = roundCents(baseline - week.plannedCumulative);
  const actual = week.start <= today ? week.remaining : null;
  const pace = planPace({
    plannedRemaining: planned,
    actualRemaining: actual,
    cumulativeCost: week.cumulativeCost,
    baseline,
  });
  return { planned, actual, ahead: pace === "behind" || pace === "over-budget", pace };
}

/** Quoted hours spread evenly. Logged hours are the timesheets in that week. */
export function weekHours(items: LedgerCost[], plannedTotal: number, weekCount: number, index = 0): { planned: number; actual: number } {
  const safeTotal = Math.round(Math.max(0, plannedTotal) * 10) / 10;
  const base = weekCount > 0 ? Math.floor((safeTotal / weekCount) * 10) / 10 : 0;
  const planned = weekCount > 0 && index === weekCount - 1
    ? Math.round((safeTotal - base * (weekCount - 1)) * 10) / 10
    : base;
  const actual = Math.round(items.filter(row => row.kind === "timesheet").reduce((sum, row) => sum + (row.hours || 0), 0) * 10) / 10;
  return { planned, actual };
}

export function ledgerRows(weeks: LedgerWeek[]): Array<Array<string | number>> {
  return [
    ["Week", "Labour", "Supplier", "Other", "Total cost", "Claims", "Invoices", "Remaining", "Variance vs plan"],
    ...weeks.map(week => [
      week.start,
      week.labour,
      week.supplier,
      week.other,
      week.cost,
      week.claims,
      week.invoices,
      week.remaining,
      week.variance,
    ]),
  ];
}
