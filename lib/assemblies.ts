/**
 * Assemblies are the quote's pricing source.
 * Each one is materials plus labour hours plus a sell price.
 * Seed values are Australian electrical defaults. Vesh should edit them.
 */

export interface AssemblyMaterial {
  name: string;
  qty: number;
  /** Cost of the part, ex GST. This is not a supplier catalogue price. */
  unitCost: number;
}

export interface Assembly {
  id: string;
  name: string;
  symbols: string[];
  keywords: string[];
  materials: AssemblyMaterial[];
  labourHours: number;
  /** Customer sell price for one assembly, ex GST. */
  sellPrice: number;
  isDefault: boolean;
}

/** Default electrician charge-out. Edit this in Settings. */
export const DEFAULT_LABOUR_RATE = 110;

export const DEFAULT_ASSEMBLIES: Assembly[] = [
  {
    id: "gpo-double",
    name: "Double GPO",
    symbols: ["GPO"],
    keywords: ["double gpo", "gpo", "power point", "powerpoint", "socket outlet"],
    materials: [{ name: "Double GPO mechanism and plate", qty: 1, unitCost: 14 }],
    labourHours: 0.45,
    sellPrice: 95,
    isDefault: true,
  },
  {
    id: "gpo-single",
    name: "Single GPO",
    symbols: [],
    keywords: ["single gpo"],
    materials: [{ name: "Single GPO mechanism and plate", qty: 1, unitCost: 9 }],
    labourHours: 0.35,
    sellPrice: 75,
    isDefault: true,
  },
  {
    id: "downlight",
    name: "Recessed downlight",
    symbols: ["LT"],
    keywords: ["downlight", "down light", "recessed light"],
    materials: [{ name: "LED downlight", qty: 1, unitCost: 22 }],
    labourHours: 0.35,
    sellPrice: 85,
    isDefault: true,
  },
  {
    id: "switch",
    name: "Light switch",
    symbols: ["SW"],
    keywords: ["light switch", "switch"],
    materials: [{ name: "Switch mechanism and plate", qty: 1, unitCost: 8 }],
    labourHours: 0.3,
    sellPrice: 55,
    isDefault: true,
  },
  {
    id: "smoke",
    name: "Smoke alarm",
    symbols: ["SA"],
    keywords: ["smoke"],
    materials: [{ name: "240V smoke alarm", qty: 1, unitCost: 48 }],
    labourHours: 0.4,
    sellPrice: 140,
    isDefault: true,
  },
  {
    id: "data",
    name: "Data point",
    symbols: ["DC"],
    keywords: ["data", "cat6", "cat 6"],
    materials: [{ name: "Data outlet and plate", qty: 1, unitCost: 18 }],
    labourHours: 0.4,
    sellPrice: 135,
    isDefault: true,
  },
  {
    id: "switchboard",
    name: "Distribution board",
    symbols: ["DB"],
    keywords: ["switchboard", "switch board", "distribution board"],
    materials: [{ name: "Board allowance", qty: 1, unitCost: 220 }],
    labourHours: 2.5,
    sellPrice: 680,
    isDefault: true,
  },
  {
    id: "exhaust",
    name: "Exhaust fan",
    symbols: [],
    keywords: ["exhaust", "ceiling fan"],
    materials: [{ name: "Fan", qty: 1, unitCost: 75 }],
    labourHours: 0.75,
    sellPrice: 185,
    isDefault: true,
  },
];

const STORAGE_KEY = "es-assemblies-v1";
const RATE_KEY = "es-labour-rate-v1";

export function materialCostOf(assembly: Assembly): number {
  return assembly.materials.reduce((sum, part) => sum + part.qty * part.unitCost, 0);
}

export function matchAssembly(
  item: { symbol?: string; desc?: string; detectedType?: string; group?: string; category?: string },
  assemblies: Assembly[] = DEFAULT_ASSEMBLIES,
): Assembly | null {
  const blob = `${item.detectedType || ""} ${item.symbol || ""} ${item.desc || ""} ${item.group || ""} ${item.category || ""}`.toLowerCase();
  let best: { assembly: Assembly; score: number } | null = null;
  for (const assembly of assemblies) {
    if (!(assembly.sellPrice > 0)) continue;
    for (const keyword of assembly.keywords) {
      const word = keyword.trim().toLowerCase();
      if (!word || !blob.includes(word)) continue;
      if (!best || word.length > best.score) best = { assembly, score: word.length };
    }
  }
  return best?.assembly ?? null;
}

export function loadAssemblies(): Assembly[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ASSEMBLIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ASSEMBLIES;
    return parsed as Assembly[];
  } catch {
    return DEFAULT_ASSEMBLIES;
  }
}

export function saveAssemblies(assemblies: Assembly[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assemblies));
}

export function loadLabourRate(): number {
  try {
    const value = Number(localStorage.getItem(RATE_KEY));
    return value > 0 ? value : DEFAULT_LABOUR_RATE;
  } catch {
    return DEFAULT_LABOUR_RATE;
  }
}

export function saveLabourRate(rate: number) {
  localStorage.setItem(RATE_KEY, String(rate > 0 ? rate : DEFAULT_LABOUR_RATE));
}
