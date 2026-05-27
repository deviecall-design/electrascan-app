import { type CostOverrun, type Timesheet } from "../contexts/ProjectContext";

/**
 * Cost overrun and variance tracking service for Vesh POC
 */

export function addOverrun(overrun: Omit<CostOverrun, "id">): CostOverrun {
  return {
    ...overrun,
    id: `overrun-${Date.now()}`,
  };
}

export function acknowledgeOverrun(overrun: CostOverrun): CostOverrun {
  return {
    ...overrun,
    acknowledged: true,
  };
}

export interface VarianceResult {
  totalSpent: number;
  variance: number;
  variancePct: number;
  atRisk: boolean;
  level: number; // 0=ok, 1=trending toward risk, 2=at risk (threshold crossed)
}

/**
 * Calculate total project variance combining materials + labour + overruns
 * level 1: trending toward risk (any point in project)
 * level 2: variancePct >= varianceThreshold (5-10%)
 */
export function calculateVariance(
  timesheets: Timesheet[] | undefined,
  overruns: CostOverrun[] | undefined,
  materialsSpent: number,
  budgetTotal: number,
  varianceThreshold: number = 0.05, // default 5%
): VarianceResult {
  // Calculate labour variance
  const ts = timesheets ?? [];
  const labourCostActual = ts.reduce((s, t) => s + t.labourCost, 0);
  const overrunAmount = (overruns ?? []).reduce((s, o) => s + o.amount, 0);

  // Total spent = materials + labour + overruns
  const totalSpent = materialsSpent + labourCostActual + overrunAmount;
  const variance = totalSpent - budgetTotal;
  const variancePct = budgetTotal > 0 ? variance / budgetTotal : 0;

  // Determine risk level
  let level = 0;
  let atRisk = false;

  if (variancePct >= varianceThreshold) {
    level = 2; // At risk — threshold crossed
    atRisk = true;
  } else if (variancePct > 0 || overrunAmount > 0) {
    level = 1; // Trending toward risk
    atRisk = false;
  }

  return {
    totalSpent,
    variance,
    variancePct,
    atRisk,
    level,
  };
}
