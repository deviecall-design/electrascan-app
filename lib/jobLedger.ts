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
  ahead: boolean;
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
    const claims = roundCents(claimItems.filter(row => row.kind === "claim").reduce((sum, row) => sum + row.amount, 0));
    const invoices = roundCents(claimItems.filter(row => row.kind === "invoice").reduce((sum, row) => sum + row.amount, 0));
    const recognised = claimItems.filter(row => row.status !== "unpaid").reduce((sum, row) => sum + row.amount, 0);
    cumulativeClaimed = roundCents(cumulativeClaimed + recognised);
    const plannedCumulative = roundCents(baseline * ((index + 1) / starts.length));
    const variance = roundCents(cumulativeCost - plannedCumulative);
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
      remaining: roundCents(baseline - cumulativeCost),
      plannedCumulative,
      variance,
      ahead: variance > 0.01,
      items,
      claimItems,
    });
  });
  const costToDate = weeks.length ? weeks[weeks.length - 1].cumulativeCost : 0;
  const claimedToDate = roundCents(input.claims.filter(row => row.status !== "unpaid").reduce((sum, row) => sum + row.amount, 0));
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
