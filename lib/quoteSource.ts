/**
 * One price for a detected line.
 *
 * A rate code uses that rate-library row.
 * Otherwise an assembly supplies the sell price.
 * Otherwise the price already stored on the line is kept.
 * A keyword in the rate library never replaces a stored price.
 */

import { matchAssembly, materialCostOf, type Assembly, DEFAULT_LABOUR_RATE } from "./assemblies";
import type { RateLike } from "./takeoff";

export interface QuotePrice {
  materialUnit: number;
  labourUnit: number;
  labourHours: number;
  sellUnit: number;
  source: "rate" | "assembly" | "stored";
  assemblyId: string | null;
  assemblyName: string | null;
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function priceItem(
  item: {
    rateCode?: string;
    symbol?: string;
    desc?: string;
    detectedType?: string;
    group?: string;
    category?: string;
    unitPrice?: number;
    materialUnit?: number;
    labourUnit?: number;
    manualPrice?: boolean;
    qty?: number;
  },
  rates: RateLike[] = [],
  assemblies: Assembly[] = [],
  labourRate: number = DEFAULT_LABOUR_RATE,
): QuotePrice {
  if (item.manualPrice && typeof item.unitPrice === "number" && item.unitPrice > 0) {
    return storedPrice(item);
  }
  const code = (item.rateCode || "").trim().toLowerCase();
  if (code) {
    const hit = rates.find(rate => rate.code.trim().toLowerCase() === code && rate.rate > 0);
    if (hit) {
      const materialUnit = hit.rate;
      const labourUnit = hit.labour || 0;
      return {
        materialUnit,
        labourUnit,
        labourHours: 0,
        sellUnit: round(materialUnit + labourUnit),
        source: "rate",
        assemblyId: null,
        assemblyName: null,
      };
    }
    return storedPrice(item);
  }

  const assembly = matchAssembly(item, assemblies);
  if (assembly) {
    const hours = Math.max(0, assembly.labourHours);
    const labourFromHours = round(hours * Math.max(0, labourRate));
    const fallback = materialCostOf(assembly) + labourFromHours;
    const sellUnit = assembly.sellPrice > 0 ? assembly.sellPrice : fallback;
    const labourUnit = Math.min(labourFromHours, sellUnit);
    return {
      materialUnit: round(sellUnit - labourUnit),
      labourUnit,
      labourHours: hours,
      sellUnit,
      source: "assembly",
      assemblyId: assembly.id,
      assemblyName: assembly.name,
    };
  }

  return storedPrice(item);
}

function storedPrice(item: {
  unitPrice?: number;
  materialUnit?: number;
  labourUnit?: number;
}): QuotePrice {
  const storedLabour = typeof item.labourUnit === "number" ? item.labourUnit : 0;
  const storedMaterial = typeof item.materialUnit === "number"
    ? item.materialUnit
    : (typeof item.unitPrice === "number" && item.unitPrice > 0 ? item.unitPrice : 0);
  const sellUnit = typeof item.materialUnit === "number" || typeof item.labourUnit === "number"
    ? round(storedMaterial + storedLabour)
    : storedMaterial;
  return {
    materialUnit: storedMaterial,
    labourUnit: storedLabour,
    labourHours: 0,
    sellUnit,
    source: "stored",
    assemblyId: null,
    assemblyName: null,
  };
}
