/**
 * One price for a detected line.
 *
 * A rate code uses that rate-library row.
 * Otherwise the workspace price list, when a row matches, supplies the material cost.
 * Otherwise an assembly supplies the sell price.
 * Otherwise the price already stored on the line is kept.
 * A keyword in the rate library never replaces a stored price.
 */

import { matchAssembly, materialCostOf, type Assembly, DEFAULT_LABOUR_RATE } from "./assemblies";
import type { StoredContractorPrice } from "./priceFile";
import type { RateLike } from "./takeoff";

export interface QuotePrice {
  materialUnit: number;
  labourUnit: number;
  labourHours: number;
  sellUnit: number;
  source: "rate" | "price-list" | "assembly" | "stored";
  assemblyId: string | null;
  assemblyName: string | null;
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function norm(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Contractor file first by code, then by description, then by a confirmed assembly link. */
export function findContractorPrice(
  item: { rateCode?: string; desc?: string; symbol?: string; detectedType?: string; group?: string; category?: string },
  priceList: StoredContractorPrice[],
  assemblies: Assembly[],
): StoredContractorPrice | null {
  const priced = priceList.filter(row => row.cost > 0);
  const code = (item.rateCode || "").trim().toLowerCase();
  if (code) {
    const hit = priced.find(row => row.code.trim().toLowerCase() === code);
    if (hit) return hit;
  }
  const desc = norm(item.desc);
  if (desc) {
    const exact = priced.find(row => norm(row.description) === desc);
    if (exact) return exact;
  }
  const assembly = matchAssembly(item, assemblies);
  if (!assembly) return null;
  const linked = priced.filter(row => row.assemblyId === assembly.id);
  if (linked.length === 0) return null;
  return linked.find(row => {
    const label = norm(row.description);
    return Boolean(label) && (desc.includes(label) || label.includes(desc));
  }) ?? linked[0];
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
  priceList: StoredContractorPrice[] = [],
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
  }

  const listed = findContractorPrice(item, priceList, assemblies);
  if (listed) {
    const assembly = matchAssembly(item, assemblies);
    const materialUnit = round(listed.cost);
    const labourHours = assembly ? Math.max(0, assembly.labourHours) : 0;
    const labourUnit = round(labourHours * Math.max(0, labourRate));
    return {
      materialUnit,
      labourUnit,
      labourHours,
      sellUnit: round(materialUnit + labourUnit),
      source: "price-list",
      assemblyId: assembly?.id ?? listed.assemblyId ?? null,
      assemblyName: assembly?.name ?? null,
    };
  }

  if (code) return storedPrice(item);

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
