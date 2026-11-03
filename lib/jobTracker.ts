/**
 * Per-job tracker. There was no earlier job tracker in this repository.
 * Quoted sell comes from the assembly price. Actuals are supplier prices and crew hours.
 */

export const JOB_STAGES = [
  "lead",
  "takeoff",
  "quoted",
  "approved",
  "in_progress",
  "variations",
  "invoicing",
  "complete",
] as const;

export type JobStage = (typeof JOB_STAGES)[number];

export const STAGE_LABEL: Record<JobStage, string> = {
  lead: "Lead",
  takeoff: "Takeoff",
  quoted: "Quoted",
  approved: "Approved",
  in_progress: "In progress",
  variations: "Variations",
  invoicing: "Invoicing",
  complete: "Complete",
};

export interface JobCostCompare {
  quotedSell: number;
  quotedMarginPct: number;
  actualMaterials: number;
  actualHours: number;
  labourRate: number;
  actualCost: number;
  marginDollars: number;
  marginPct: number | null;
  slip: boolean;
  warning: string | null;
}

export function compareJobCost(input: {
  quotedSell: number;
  quotedMarginPct?: number;
  actualMaterials?: number;
  actualHours?: number;
  labourRate?: number;
  slipPoints?: number;
}): JobCostCompare {
  const quotedSell = Math.max(0, input.quotedSell);
  const quotedMarginPct = input.quotedMarginPct ?? 15;
  const actualMaterials = Math.max(0, input.actualMaterials ?? 0);
  const actualHours = Math.max(0, input.actualHours ?? 0);
  const labourRate = input.labourRate ?? 110;
  const actualCost = Math.round((actualMaterials + actualHours * labourRate) * 100) / 100;
  const marginDollars = Math.round((quotedSell - actualCost) * 100) / 100;
  const marginPct = quotedSell > 0 ? Math.round((marginDollars / quotedSell) * 1000) / 10 : null;
  const hasActual = actualMaterials > 0 || actualHours > 0;
  const slip = Boolean(hasActual && marginPct != null && marginPct < quotedMarginPct - (input.slipPoints ?? 5));
  return {
    quotedSell,
    quotedMarginPct,
    actualMaterials,
    actualHours,
    labourRate,
    actualCost,
    marginDollars,
    marginPct,
    slip,
    warning: slip
      ? `Margin is ${marginPct}% against a ${quotedMarginPct}% quote. Costs have slipped.`
      : null,
  };
}

export function jobKey(client: string | null | undefined, fileName: string | null | undefined): string {
  const clientKey = (client || "").trim().toLowerCase();
  if (clientKey) return clientKey;
  return (fileName || "unassigned").trim().toLowerCase();
}
