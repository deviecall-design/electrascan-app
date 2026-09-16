/**
 * Scan → quote mapping used by ScanDetailScreen.
 *
 * Extracted so categorisation and line pricing can be tested without the UI.
 * Detection itself does not emit x/y on the drawing; any marker positions
 * derived here are display-only and must not be treated as plan coordinates.
 */

export interface ScanQuoteItem {
  id: number;
  symbol: string;
  qty: number;
  desc: string;
  rateCode: string;
  conf: number;
  /** Synthetic display position — NOT a PDF overlay coordinate. */
  x: number;
  y: number;
  unitPrice?: number;
  category?: string;
  room?: string;
}

export interface DetectionComponentLike {
  type: string;
  quantity: number;
  catalogue_item_name?: string;
  unit_price?: number;
  confidence?: number;
  room?: string;
}

const SYMBOL_MAP: Record<string, string> = {
  GPO_STANDARD: "GPO",
  GPO_DOUBLE: "GPO",
  GPO_WEATHERPROOF: "GPO",
  GPO_USB: "GPO",
  DOWNLIGHT_RECESSED: "LT",
  DOWNLIGHT_TRIMLESS: "LT",
  DOWNLIGHT_DALI: "LT",
  PENDANT_FEATURE: "LT",
  LED_STRIP: "LT",
  WALL_LIGHT: "LT",
  TRACK_LIGHT: "LT",
  GARDEN_LIGHT: "LT",
  EXHAUST_FAN: "FN",
  CEILING_FAN: "FN",
  SWITCHING_STANDARD: "SW",
  SWITCHING_DIMMER: "SW",
  SWITCHING_2WAY: "SW",
  SWITCHING_3WAY: "SW",
  SWITCHING_DYNALITE: "SW",
  SWITCHBOARD_MAIN: "DB",
  SWITCHBOARD_SUB: "DB",
  DATA_CAT6: "DC",
  DATA_TV: "DC",
  WIFI_POINT: "DC",
  SPEAKER_POINT: "DC",
  AC_SPLIT: "FN",
  AC_DUCTED: "FN",
  SECURITY_CCTV: "SA",
  SECURITY_INTERCOM: "SA",
  SECURITY_ALARM: "SA",
  SMOKE_DETECTOR: "SA",
  EV_CHARGER: "EX",
  POOL_OUTDOOR: "EX",
  GATE_ACCESS: "EX",
  AUTOMATION_HUB: "DC",
  COOKTOP_20A: "GPO",
  COOKTOP_25A: "GPO",
  COOKTOP_32A: "GPO",
  COOKTOP_3PHASE: "GPO",
  HEATED_TOWEL_RAIL: "EX",
  EXTERNAL_HEATER: "EX",
  TOILET_CIRCUIT: "EX",
  UNDERFLOOR_HEAT: "EX",
};

/**
 * Quote-category bucket for a detection component type.
 *
 * Cooktops, towel rails, toilets and heaters used to share catalogue
 * `componentType: "GPO_STANDARD"`, so they rolled into "Power outlets"
 * and inflated that category (Sirius quote: Power outlets $70,980).
 */
export function categoryFor(type: string): string {
  const t = (type || "").toUpperCase();
  if (t.startsWith("COOKTOP")) return "Appliance circuits";
  if (t.startsWith("GPO")) return "Power outlets";
  if (
    t.startsWith("DOWNLIGHT") ||
    t.startsWith("PENDANT") ||
    t.startsWith("LED") ||
    t.startsWith("LIGHT") ||
    t.startsWith("TRACK") ||
    t.startsWith("WALL_LIGHT") ||
    t.startsWith("GARDEN")
  ) {
    return "Lighting";
  }
  if (t.startsWith("SWITCHING")) return "Switching & dimming";
  if (t.startsWith("DATA") || t.startsWith("WIFI") || t.startsWith("SPEAKER") || t.startsWith("AV")) {
    return "Data & comms";
  }
  if (t.startsWith("SWITCHBOARD")) return "Distribution board";
  if (t.startsWith("SECURITY") || t.startsWith("SMOKE")) return "Safety & compliance";
  if (t.startsWith("EXHAUST") || t.startsWith("AC_") || t.startsWith("CEILING_FAN")) {
    return "Ventilation & climate";
  }
  if (
    t.startsWith("EV_") ||
    t.startsWith("POOL") ||
    t.startsWith("GATE") ||
    t.startsWith("AUTOMATION") ||
    t.startsWith("HEATED_TOWEL") ||
    t.startsWith("TOILET") ||
    t.startsWith("UNDERFLOOR") ||
    t.startsWith("EXTERNAL_HEATER") ||
    t.startsWith("MOTORISED")
  ) {
    return "Specialist & automation";
  }
  return "Other";
}

/** Deterministic badge slot on the mock plan — not a PDF coordinate. */
export function gridPosition(index: number): { x: number; y: number } {
  return {
    x: 60 + ((index * 73) % 420),
    y: 60 + ((index * 61) % 280),
  };
}

export function mapDetectionToQuoteItems(
  components: DetectionComponentLike[] | null | undefined,
): ScanQuoteItem[] {
  if (!components || components.length === 0) return [];
  return components.map((c, i) => {
    const label = (c.catalogue_item_name || c.type || "Unknown item")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (ch: string) => ch.toUpperCase());
    const pos = gridPosition(i);
    return {
      id: i + 1,
      symbol: SYMBOL_MAP[c.type] ?? "EL",
      qty: c.quantity,
      desc: label,
      rateCode: "",
      conf: Math.min(1, Math.max(0, (c.confidence ?? 90) / 100)),
      x: pos.x,
      y: pos.y,
      unitPrice: typeof c.unit_price === "number" ? c.unit_price : undefined,
      category: categoryFor(c.type),
      room: c.room,
    };
  });
}

export function formatQtyRate(qty: number, unitPrice: number): string {
  const q = Math.max(0, qty);
  const p = Math.max(0, unitPrice);
  return `${q} × $${Math.round(p).toLocaleString("en-AU")}`;
}

export interface QuoteVisibleLine {
  category: string;
  desc: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

/** Category groups with qty × rate so a $71k GPO bucket can be inspected. */
export function quoteVisibleLines(
  items: Array<{ category?: string; desc: string; qty: number; unitPrice?: number }>,
): { category: string; total: number; lines: QuoteVisibleLine[] }[] {
  const groups = new Map<string, QuoteVisibleLine[]>();
  for (const it of items) {
    if (typeof it.unitPrice !== "number" || it.unitPrice <= 0 || it.qty <= 0) continue;
    const category = it.category ?? "Other";
    const line: QuoteVisibleLine = {
      category,
      desc: it.desc,
      qty: it.qty,
      unitPrice: it.unitPrice,
      lineTotal: it.qty * it.unitPrice,
    };
    const list = groups.get(category) ?? [];
    list.push(line);
    groups.set(category, list);
  }
  return [...groups.entries()]
    .map(([category, lines]) => ({
      category,
      total: lines.reduce((s, l) => s + l.lineTotal, 0),
      lines,
    }))
    .sort((a, b) => b.total - a.total);
}

export function sumCategory(
  items: Array<{ category?: string; qty: number; unitPrice?: number }>,
  category: string,
): number {
  return items
    .filter(it => (it.category ?? "Other") === category)
    .reduce((s, it) => s + (typeof it.unitPrice === "number" ? it.qty * it.unitPrice : 0), 0);
}

/**
 * If room-scan quantities for a legend row exceed the legend total,
 * scale them back. Legend quantity is the takeoff source of truth;
 * Pass 2 sometimes repeats the legend total on every room.
 */
export function capQuantitiesToLegend<T extends { quantity: number; legendKey: string }>(
  rows: T[],
  legendQtyByKey: Record<string, number>,
): T[] {
  const sums: Record<string, number> = {};
  for (const r of rows) {
    const k = r.legendKey.toLowerCase();
    sums[k] = (sums[k] ?? 0) + r.quantity;
  }
  const next = rows.map(r => {
    const k = r.legendKey.toLowerCase();
    const cap = legendQtyByKey[k];
    const sum = sums[k];
    if (typeof cap !== "number" || cap <= 0 || !sum || sum <= cap) return r;
    const scaled = r.quantity * (cap / sum);
    return { ...r, quantity: Math.round(scaled * 100) / 100 };
  });
  // Rounding per row can leave a cent of remainder — put it on the last row of that key.
  const seen: Record<string, number> = {};
  const lastIndex: Record<string, number> = {};
  next.forEach((r, i) => {
    const k = r.legendKey.toLowerCase();
    seen[k] = (seen[k] ?? 0) + r.quantity;
    lastIndex[k] = i;
  });
  for (const [k, cap] of Object.entries(legendQtyByKey)) {
    const idx = lastIndex[k];
    const got = seen[k];
    const sum = sums[k];
    if (idx === undefined || typeof cap !== "number" || !sum || sum <= cap) continue;
    const drift = Math.round((cap - got) * 100) / 100;
    if (drift !== 0) {
      next[idx] = { ...next[idx], quantity: Math.round((next[idx].quantity + drift) * 100) / 100 };
    }
  }
  return next;
}
