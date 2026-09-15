/**
 * Review-step classification — single source of truth for:
 *   - honest confidence bands (85% is not "Low")
 *   - category / rate / placeholder defaults from the component, not GPO
 *   - clean detection labels (EDB vs the lighting "LT" fallback)
 *
 * Used by ScanDetailScreen Review and by analyze_pdf matchToVesh so Detect
 * and Review do not drift. Pure functions — no React, no I/O.
 */

export const REVIEW_CATEGORIES = [
  "Switchboard",
  "Power (GPO, switches)",
  "Lighting (downlights, strips)",
  "Switching & sensors",
  "AV / Data",
  "Ventilation",
  "Safety (smoke, fire)",
  "Security (CCTV, access)",
  "Automation (blinds, curtains)",
  "Solar / Battery",
  "EV Charging",
  "Other",
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

export type ReviewKind =
  | "switchboard"
  | "power"
  | "lighting"
  | "switching"
  | "sensor"
  | "data"
  | "ventilation"
  | "safety"
  | "security"
  | "automation"
  | "ev"
  | "special"
  | "other";

export type ConfidenceBand =
  | "high"
  | "medium"
  | "low"
  | "unrecognised"
  | "unclear";

export interface ConfidenceMeta {
  band: ConfidenceBand;
  label: string;
  /** Short hint shown next to the % so 85% is not read as a failure. */
  hint: string;
  /** Queue items at or below this seriousness. */
  needsReview: boolean;
  /** Unrecognised / unclear still block estimate lock. */
  blocksLock: boolean;
  tone: "green" | "amber" | "orange" | "red";
}

export interface ReviewSuggestion {
  kind: ReviewKind;
  category: ReviewCategory;
  symbol: string;
  /** Clean title for the queue row. */
  label: string;
  placeholder: string;
  qty: number;
  rate: number;
  /** Pre-filled classify description (blank if the label is already clear). */
  description: string;
}

export interface ReviewQueueSeed {
  id: number;
  symbol: string;
  desc: string;
  qty: number;
  conf: number;
  room?: string;
  unitPrice?: number;
  category?: string;
}

const KIND_META: Record<
  ReviewKind,
  {
    category: ReviewCategory;
    symbol: string;
    placeholder: string;
    rate: number;
  }
> = {
  switchboard: {
    category: "Switchboard",
    symbol: "EDB",
    placeholder: "e.g. 12-way distribution board",
    rate: 1800,
  },
  power: {
    category: "Power (GPO, switches)",
    symbol: "GPO",
    placeholder: "e.g. Double GPO",
    rate: 260,
  },
  lighting: {
    category: "Lighting (downlights, strips)",
    symbol: "LT",
    placeholder: "e.g. Recessed downlight",
    rate: 200,
  },
  switching: {
    category: "Switching & sensors",
    symbol: "SW",
    placeholder: "e.g. 2-way light switch",
    rate: 120,
  },
  sensor: {
    category: "Switching & sensors",
    symbol: "EX",
    placeholder: "e.g. External PIR / motion sensor",
    rate: 380,
  },
  data: {
    category: "AV / Data",
    symbol: "DC",
    placeholder: "e.g. Cat6 data point",
    rate: 360,
  },
  ventilation: {
    category: "Ventilation",
    symbol: "FN",
    placeholder: "e.g. Bathroom exhaust fan",
    rate: 215,
  },
  safety: {
    category: "Safety (smoke, fire)",
    symbol: "SA",
    placeholder: "e.g. 240V interconnect smoke alarm",
    rate: 360,
  },
  security: {
    category: "Security (CCTV, access)",
    symbol: "CCTV",
    placeholder: "e.g. CCTV camera point",
    rate: 300,
  },
  automation: {
    category: "Automation (blinds, curtains)",
    symbol: "AU",
    placeholder: "e.g. Motorised blind point",
    rate: 380,
  },
  ev: {
    category: "EV Charging",
    symbol: "EV",
    placeholder: "e.g. 32A EV charger circuit",
    rate: 1000,
  },
  special: {
    category: "Other",
    symbol: "EL",
    placeholder: "e.g. Dedicated circuit",
    rate: 450,
  },
  other: {
    category: "Other",
    symbol: "EL",
    placeholder: "e.g. Describe the fitting",
    rate: 200,
  },
};

/** analyze_pdf ComponentType → ReviewKind. Unknown types fall through to text. */
const TYPE_TO_KIND: Record<string, ReviewKind> = {
  GPO_STANDARD: "power",
  GPO_DOUBLE: "power",
  GPO_WEATHERPROOF: "power",
  GPO_USB: "power",
  COOKTOP_20A: "special",
  COOKTOP_25A: "special",
  COOKTOP_32A: "special",
  COOKTOP_3PHASE: "special",
  DOWNLIGHT_RECESSED: "lighting",
  DOWNLIGHT_TRIMLESS: "lighting",
  DOWNLIGHT_DALI: "lighting",
  PENDANT_FEATURE: "lighting",
  LED_STRIP: "lighting",
  WALL_LIGHT: "lighting",
  GARDEN_LIGHT: "lighting",
  TRACK_LIGHT: "lighting",
  EXHAUST_FAN: "ventilation",
  CEILING_FAN: "ventilation",
  SWITCHING_STANDARD: "switching",
  SWITCHING_DIMMER: "switching",
  SWITCHING_2WAY: "switching",
  SWITCHING_3WAY: "switching",
  SWITCHING_DYNALITE: "switching",
  SWITCHBOARD_MAIN: "switchboard",
  SWITCHBOARD_SUB: "switchboard",
  DATA_CAT6: "data",
  DATA_TV: "data",
  WIFI_POINT: "data",
  SPEAKER_POINT: "data",
  SECURITY_CCTV: "security",
  SECURITY_INTERCOM: "security",
  SECURITY_ALARM: "safety",
  SMOKE_DETECTOR: "safety",
  PIR_SENSOR: "sensor",
  EV_CHARGER: "ev",
  POOL_OUTDOOR: "special",
  GATE_ACCESS: "security",
  AUTOMATION_HUB: "automation",
  MOTORISED_BLIND: "automation",
  HEATED_TOWEL_RAIL: "special",
  UNDERFLOOR_HEAT: "special",
};

/** analyze_pdf ComponentType → badge abbreviation. */
export const TYPE_TO_SYMBOL: Record<string, string> = {
  GPO_STANDARD: "GPO",
  GPO_DOUBLE: "GPO",
  GPO_WEATHERPROOF: "GPO",
  GPO_USB: "GPO",
  DOWNLIGHT_RECESSED: "LT",
  PENDANT_FEATURE: "LT",
  EXHAUST_FAN: "FN",
  CEILING_FAN: "FN",
  SWITCHING_STANDARD: "SW",
  SWITCHING_DIMMER: "SW",
  SWITCHING_2WAY: "SW",
  SWITCHBOARD_MAIN: "EDB",
  SWITCHBOARD_SUB: "EDB",
  DATA_CAT6: "DC",
  DATA_TV: "DC",
  SECURITY_CCTV: "CCTV",
  SECURITY_INTERCOM: "IC",
  SECURITY_ALARM: "SA",
  SMOKE_DETECTOR: "SA",
  PIR_SENSOR: "EX",
  EV_CHARGER: "EV",
  POOL_OUTDOOR: "EX",
  GATE_ACCESS: "EX",
  AUTOMATION_HUB: "AU",
};

/** Legend / AS/NZS-style abbreviations → kind. Description wins on conflict. */
const SYMBOL_TO_KIND: Record<string, ReviewKind> = {
  EDB: "switchboard",
  DB: "switchboard",
  MSB: "switchboard",
  SB: "switchboard",
  GPO: "power",
  DGPO: "power",
  SGPO: "power",
  WPO: "power",
  LT: "lighting",
  DL: "lighting",
  LED: "lighting",
  SW: "switching",
  S: "switching",
  DC: "data",
  DP: "data",
  FN: "ventilation",
  EF: "ventilation",
  CF: "ventilation",
  SA: "safety",
  SD: "safety",
  EX: "sensor",
  PIR: "sensor",
  MS: "sensor",
  EV: "ev",
  EVC: "ev",
  CCTV: "security",
  AU: "automation",
  MB: "automation",
};

/**
 * Pull a legend code + human title out of messy detector copy.
 * "Edb: electrical distribution board" → { code: "EDB", title: "Electrical distribution board" }
 * "Electrical: data point as spec."   → { code: undefined, title: "Data point" }
 */
export function parseLegendLabel(raw: string): { code?: string; title: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { title: "" };

  let body = trimmed
    .replace(/\s+/g, " ")
    .replace(/^(electrical|legend|item)\s*[:–—-]\s+/i, "")
    .replace(/[.,;:]+$/, "")
    .replace(/\s*[,;]?\s*(as spec\.?|type as noted|as noted|per legend)$/i, "")
    .replace(/[.,;:]+$/, "")
    .trim();

  const prefixed = body.match(/^([A-Za-z][A-Za-z0-9/-]{0,6})\s*[:–—-]\s+(.+)$/);
  if (prefixed) {
    const code = prefixed[1].toUpperCase();
    const rest = prefixed[2].trim();
    return { code, title: titleCase(rest) };
  }

  return { title: titleCase(body) };
}

function titleCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.replace(/(^|[\s(/])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function getConfidenceMeta(conf: number): ConfidenceMeta {
  // Detector stores 0–100 or 0–1. Normalise first.
  const unit = conf > 1 ? conf / 100 : conf;
  if (unit <= 0) {
    return {
      band: "unclear",
      label: "No score",
      hint: "Detector did not score this mark",
      needsReview: true,
      blocksLock: true,
      tone: "red",
    };
  }
  if (unit >= 0.9) {
    return {
      band: "high",
      label: "High confidence",
      hint: "Recognised — spot-check qty if you like",
      needsReview: false,
      blocksLock: false,
      tone: "green",
    };
  }
  if (unit >= 0.75) {
    return {
      band: "medium",
      label: "Medium confidence",
      hint: "Likely correct — confirm category and qty",
      needsReview: true,
      blocksLock: false,
      tone: "amber",
    };
  }
  if (unit >= 0.5) {
    return {
      band: "low",
      label: "Low confidence",
      hint: "Guessed — check the drawing before quoting",
      needsReview: true,
      blocksLock: false,
      tone: "orange",
    };
  }
  return {
    band: "unrecognised",
    label: "Unrecognised",
    hint: "Could not classify this mark",
    needsReview: true,
    blocksLock: true,
    tone: "red",
  };
}

/** Legacy Review queue state name — kept so estimate-lock logic stays familiar. */
export function getConfidenceState(
  conf: number,
): "recognised" | "low_confidence" | "unrecognised" | "unclear" {
  const band = getConfidenceMeta(conf).band;
  if (band === "high") return "recognised";
  if (band === "unrecognised") return "unrecognised";
  if (band === "unclear") return "unclear";
  return "low_confidence";
}

/**
 * Description always wins over a conflicting symbol/type.
 * That is the LT-vs-EDB bug: unmatched legend rows were typed as
 * DOWNLIGHT_RECESSED (badge LT) even when the text said "distribution board".
 */
export function inferReviewKind(
  description: string,
  symbol?: string,
  detectedType?: string,
): ReviewKind {
  const { code, title } = parseLegendLabel(description);
  const text = `${code ?? ""} ${title} ${description}`.toLowerCase();

  // High-signal phrases first — must beat the downlight / "board" fuzzy trap
  // (catalogue aliases include "plasterboard downlight").
  if (
    /\b(edb|msb|mdb|switchboard|switch board|distribution board|db board|sub-?board|main board)\b/.test(text) ||
    /\b(electrical distribution|dist\.?\s*board)\b/.test(text)
  ) {
    return "switchboard";
  }
  if (/\b(ev\s*charg|car charg|electric vehicle)\b/.test(text)) return "ev";
  if (/\b(smoke|heat detector|fire alarm)\b/.test(text)) return "safety";
  if (/\b(cctv|security camera|intercom|doorbell)\b/.test(text)) return "security";
  if (/\b(exhaust fan|ceiling fan|ventilation)\b/.test(text)) return "ventilation";
  if (/\b(data point|data outlet|cat\s*6|ethernet|tv\/data|wifi|speaker point)\b/.test(text)) return "data";
  if (/\b(motoris[ae]d blind|automation|dynalite keypad)\b/.test(text)) return "automation";
  if (/\b(motion sensor|pir|occupancy|light sensor)\b/.test(text)) return "sensor";
  if (/\b(gpo|power point|powerpoint|outlet|socket)\b/.test(text)) return "power";
  if (/\b(downlight|pendant|led strip|track light|wall light|garden light)\b/.test(text)) {
    return "lighting";
  }
  if (/\b(dimmer|2-?way|switch)\b/.test(text) && !/\bswitchboard\b/.test(text)) {
    return "switching";
  }
  if (/\b(underfloor|towel rail|cooktop|oven)\b/.test(text)) return "special";

  const fromCode = (code && SYMBOL_TO_KIND[code]) || (symbol && SYMBOL_TO_KIND[symbol.toUpperCase()]);
  if (fromCode) return fromCode;

  if (detectedType && TYPE_TO_KIND[detectedType]) {
    // Ignore the historic "everything unknown is a downlight" default when
    // the text clearly is not lighting.
    if (detectedType.startsWith("DOWNLIGHT") && !/\b(light|lamp|led)\b/.test(text)) {
      return "other";
    }
    return TYPE_TO_KIND[detectedType];
  }

  return "other";
}

export function suggestReviewItem(input: {
  description: string;
  symbol?: string;
  detectedType?: string;
  qty?: number;
  unitPrice?: number;
}): ReviewSuggestion {
  const kind = inferReviewKind(input.description, input.symbol, input.detectedType);
  const meta = KIND_META[kind];
  const parsed = parseLegendLabel(input.description);
  const symbol = parsed.code && SYMBOL_TO_KIND[parsed.code]
    ? parsed.code
    : kind !== "other"
      ? meta.symbol
      : (input.symbol && input.symbol !== "EL" && input.symbol !== "LT" ? input.symbol : meta.symbol);

  const typeKind = input.detectedType ? TYPE_TO_KIND[input.detectedType] : undefined;
  const priceUntrusted = Boolean(typeKind && typeKind !== kind);
  const rate =
    typeof input.unitPrice === "number" && input.unitPrice > 0 && !priceUntrusted
      ? input.unitPrice
      : meta.rate;

  return {
    kind,
    category: meta.category,
    symbol,
    label: parsed.title || titleCase(input.description || meta.placeholder.replace(/^e\.g\.\s*/i, "")),
    placeholder: meta.placeholder,
    qty: Math.max(1, input.qty ?? 1),
    rate,
    description: parsed.title,
  };
}

/**
 * Map a legend line to an analyze_pdf ComponentType + fallback price.
 * Returns null when we should leave the existing catalogue / default path.
 */
export function inferAnalyzeType(
  description: string,
  symbol?: string,
): { componentType: string; price: number } | null {
  const kind = inferReviewKind(description, symbol);
  const price = KIND_META[kind].rate;
  switch (kind) {
    case "switchboard":
      return {
        componentType: /\bsub[- ]?board\b/i.test(description)
          ? "SWITCHBOARD_SUB"
          : "SWITCHBOARD_MAIN",
        price,
      };
    case "power":
      return { componentType: "GPO_DOUBLE", price };
    case "lighting":
      return { componentType: "DOWNLIGHT_RECESSED", price };
    case "switching":
      return { componentType: "SWITCHING_STANDARD", price };
    case "sensor":
      return { componentType: "SWITCHING_STANDARD", price };
    case "data":
      return { componentType: "DATA_CAT6", price };
    case "ventilation":
      return { componentType: "EXHAUST_FAN", price };
    case "safety":
      return { componentType: "SECURITY_ALARM", price };
    case "security":
      return { componentType: "SECURITY_CCTV", price };
    case "automation":
      return { componentType: "AUTOMATION_HUB", price };
    case "ev":
      return { componentType: "EV_CHARGER", price };
    case "special":
      return null;
    case "other":
      return null;
  }
}

export function formatDetectionLabel(raw: string, symbol?: string, detectedType?: string): string {
  return suggestReviewItem({ description: raw, symbol, detectedType }).label;
}

export function symbolForDetection(raw: string, detectedType?: string, fallbackSymbol?: string): string {
  return suggestReviewItem({
    description: raw,
    symbol: fallbackSymbol,
    detectedType,
  }).symbol;
}

export function shouldQueueForReview(conf: number): boolean {
  return getConfidenceMeta(conf).needsReview;
}

export function groupSuggestionsByCategory<T extends { suggestion: ReviewSuggestion }>(
  items: T[],
): { category: ReviewCategory; items: T[] }[] {
  const order = REVIEW_CATEGORIES;
  const buckets = new Map<ReviewCategory, T[]>();
  for (const item of items) {
    const cat = item.suggestion.category;
    const list = buckets.get(cat) ?? [];
    list.push(item);
    buckets.set(cat, list);
  }
  return order
    .filter(cat => buckets.has(cat))
    .map(cat => ({ category: cat, items: buckets.get(cat)! }));
}

export function displayRoom(room?: string): string {
  const value = (room ?? "").trim();
  if (!value || /^level\s*\d+$/i.test(value)) return "Location not set";
  return value;
}

export function quoteCategoryForKind(kind: ReviewKind): string {
  switch (kind) {
    case "switchboard": return "Distribution board";
    case "power": return "Power outlets";
    case "lighting": return "Lighting";
    case "switching":
    case "sensor": return "Switching & sensors";
    case "data": return "Data & comms";
    case "ventilation": return "Ventilation & climate";
    case "safety": return "Safety & compliance";
    case "security": return "Security";
    case "automation": return "Specialist & automation";
    case "ev": return "EV charging";
    default: return "Other";
  }
}

/** Fields DetectedItem / Review queue share after a raw detection row is cleaned up. */
export function mapComponentToReviewFields(c: {
  type?: string;
  catalogue_item_name?: string;
  quantity?: number;
  confidence?: number;
  unit_price?: number;
  room?: string;
}): {
  symbol: string;
  desc: string;
  category: string;
  quoteCategory: string;
  room: string;
  suggestion: ReviewSuggestion;
} {
  const raw = (c.catalogue_item_name || c.type || "Unknown item").replace(/_/g, " ");
  const suggestion = suggestReviewItem({
    description: raw,
    detectedType: c.type,
    qty: c.quantity,
    unitPrice: typeof c.unit_price === "number" ? c.unit_price : undefined,
  });
  return {
    symbol: suggestion.symbol,
    desc: suggestion.label,
    category: suggestion.category,
    quoteCategory: quoteCategoryForKind(suggestion.kind),
    room: displayRoom(c.room),
    suggestion,
  };
}
