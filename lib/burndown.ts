/**
 * Job burndown from a real quote, milestone schedule, and dated actuals.
 * No sample weeks. Planned lines are the quote spread from the job's own dates.
 */

import { computeQuoteTotals } from "./quoteTotals";

export interface ActualEntry {
  id?: string;
  jobId: string;
  date: string;
  materials: number;
  labourHours: number;
  labourCost: number;
  note: string;
}

export type MilestonePayStatus = "not_due" | "due" | "invoiced" | "paid";

export interface BurndownMilestone {
  id: string;
  label: string;
  description: string;
  pct: number;
  amount: number;
  status: MilestonePayStatus;
  invoiceId: string | null;
}

export interface BurndownWeek {
  label: string;
  start: string;
  plannedSpend: number;
  plannedHours: number;
  actualSpend: number | null;
  actualHours: number | null;
}

const SHARES: Array<[string, string, string, number]> = [
  ["deposit", "Deposit on signing", "On acceptance", 0.1],
  ["rough-in", "Rough-in complete", "Cabling complete", 0.2],
  ["first-fix", "First fix complete", "First fix signed off", 0.25],
  ["second-fix", "Second fix / fit-off", "Second fix signed off", 0.25],
  ["pc", "Practical completion", "Test and compliance", 0.15],
  ["retention", "Retention holdback", "Released after the defect period", 0.05],
];

export function quoteContract(sellExGst: number, marginPct: number) {
  return computeQuoteTotals(Math.max(0, sellExGst), marginPct);
}

export function burnPercent(spent: number, contract: number): number {
  if (!(contract > 0)) return 0;
  return Math.round((Math.max(0, spent) / contract) * 1000) / 10;
}

export function burnTone(pct: number): "ok" | "amber" | "red" {
  if (pct > 90) return "red";
  if (pct > 75) return "amber";
  return "ok";
}

export function weekStarts(start: string, end: string): string[] {
  const first = parseDay(start);
  const last = parseDay(end);
  if (!first || !last || first.getTime() > last.getTime()) return [];
  const out: string[] = [];
  const cursor = new Date(first);
  while (cursor.getTime() <= last.getTime() && out.length < 26) {
    out.push(formatDay(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  const endLabel = formatDay(last);
  if (out.length === 1 || out[out.length - 1] !== endLabel) out.push(endLabel);
  return out.slice(0, 26);
}

export function burndownWeeks(input: {
  contract: number;
  plannedHours: number;
  start: string;
  end: string;
  actuals: ActualEntry[];
  today?: string;
}): BurndownWeek[] {
  const starts = weekStarts(input.start, input.end);
  const today = input.today || formatDay(new Date());
  return starts.map((start, index) => {
    const next = starts[index + 1];
    const through = next ? dayBefore(next) : start;
    const frac = (index + 1) / starts.length;
    const spent = sumActuals(input.actuals.filter(entry => entry.date <= through));
    const open = start <= today;
    return {
      label: `W${index + 1}`,
      start,
      plannedSpend: roundMoney(input.contract * frac),
      plannedHours: roundMoney(input.plannedHours * frac),
      actualSpend: open ? spent.cost : null,
      actualHours: open ? spent.hours : null,
    };
  });
}

export function paymentSchedule(contract: number): Omit<BurndownMilestone, "status" | "invoiceId">[] {
  return SHARES.map(([id, label, description, share]) => ({
    id,
    label,
    description,
    pct: Math.round(share * 100),
    amount: Math.round(contract * share),
  }));
}

export function milestoneStatus(input: {
  index: number;
  count: number;
  weeks: BurndownWeek[];
  invoiced: boolean;
  paid: boolean;
  today?: string;
}): MilestonePayStatus {
  if (input.paid) return "paid";
  if (input.invoiced) return "invoiced";
  const today = input.today || formatDay(new Date());
  const at = input.weeks[milestoneWeekIndex(input.index, input.count, input.weeks.length)];
  if (at && at.start <= today) return "due";
  return "not_due";
}

export function milestoneWeekIndex(index: number, count: number, weeks: number): number {
  if (weeks <= 1 || count <= 0) return 0;
  return Math.min(weeks - 1, Math.round(((index + 1) / count) * (weeks - 1)));
}

export function spendAheadWarning(burnPct: number, milestones: Array<{ pct: number; status: MilestonePayStatus }>): string | null {
  const claimed = milestones
    .filter(row => row.status === "invoiced" || row.status === "paid")
    .reduce((sum, row) => sum + row.pct, 0);
  if (burnPct >= 50 && burnPct > claimed + 10) {
    return `Spend is at ${burnPct}% of the contract, and only ${claimed}% has been invoiced.`;
  }
  return null;
}

export function sumActuals(entries: ActualEntry[]): { materials: number; hours: number; labour: number; cost: number } {
  const materials = roundMoney(entries.reduce((sum, entry) => sum + entry.materials, 0));
  const hours = roundMoney(entries.reduce((sum, entry) => sum + entry.labourHours, 0));
  const labour = roundMoney(entries.reduce((sum, entry) => sum + entry.labourCost, 0));
  return { materials, hours, labour, cost: roundMoney(materials + labour) };
}

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayBefore(value: string): string {
  const date = parseDay(value);
  if (!date) return value;
  date.setDate(date.getDate() - 1);
  return formatDay(date);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
