import { type Timesheet } from "../contexts/ProjectContext";

/**
 * Hours and labour cost tracking service for Vesh POC
 */

export function fetchTimesheets(timesheets: Timesheet[] | undefined): Timesheet[] {
  return timesheets ?? [];
}

export function submitTimesheet(
  entry: Omit<Timesheet, "id" | "labourCost">
): Omit<Timesheet, "id"> & { labourCost: number } {
  return {
    ...entry,
    labourCost: entry.actualHours * (entry.labourCost ?? 0), // labourCost param unused, compute from actualHours
  };
}

export function approveTimesheet(timesheet: Timesheet): Timesheet {
  return {
    ...timesheet,
    approvedAt: new Date().toISOString(),
  };
}

export interface LabourTotals {
  totalPlanned: number;
  totalActual: number;
  totalLabourCost: number;
  variance: number;
  variancePct: number;
}

export function labourTotals(timesheets: Timesheet[], labourRate: number): LabourTotals {
  const totalPlanned = timesheets.reduce((s, t) => s + t.plannedHours, 0);
  const totalActual = timesheets.reduce((s, t) => s + t.actualHours, 0);
  const totalLabourCost = totalActual * labourRate;
  const estimatedCost = totalPlanned * labourRate;
  const variance = totalLabourCost - estimatedCost;
  const variancePct = totalPlanned > 0 ? variance / estimatedCost : 0;

  return {
    totalPlanned,
    totalActual,
    totalLabourCost,
    variance,
    variancePct,
  };
}
