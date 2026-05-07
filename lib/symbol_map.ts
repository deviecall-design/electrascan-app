/**
 * ElectraScan — Symbol-to-SKU Mapping Table
 *
 * Bridges AI detection output (componentType) → Vesh catalogue item IDs.
 *
 * Detection flow:
 *   Drawing symbol (visual)
 *     → AI returns componentType (e.g. "DOWNLIGHT_RECESSED")
 *     → componentType resolves to 1..N catalogue item IDs
 *     → If 1 item: auto-select, show for confirmation
 *     → If N items: show disambiguation UI, user picks variant
 *     → Selected catalogue ID written to estimate line item
 *
 * AS/NZS 1102 symbol codes and common legend abbreviations also map
 * to componentType so the legend reader can use the same path.
 */

import {
  VESH_CATALOGUE,
  CatalogueItem,
  mapLegendItem,
} from "../vesh_catalogue";

// ─────────────────────────────────────────────
// COMPONENT TYPE ENUM
// Single source of truth for all AI detection output types.
// The AI must return exactly one of these strings.
// ─────────────────────────────────────────────

export type ComponentType =
  // Power Points
  | "GPO_STANDARD"
  | "GPO_DOUBLE"
  | "GPO_WEATHERPROOF"
  | "GPO_USB"
  // Appliance Circuits
  | "COOKTOP_20A"
  | "COOKTOP_25A"
  | "COOKTOP_32A"
  | "COOKTOP_3PHASE"
  // Data & Comms
  | "DATA_TV"
  | "DATA_CAT6"
  | "WIFI_POINT"
  | "SPEAKER_POINT"
  // Lighting
  | "DOWNLIGHT_RECESSED"
  | "DOWNLIGHT_TRIMLESS"
  | "DOWNLIGHT_DALI"
  | "LED_STRIP"
  | "WALL_LIGHT"
  | "GARDEN_LIGHT"
  | "PENDANT_FEATURE"
  | "TRACK_LIGHT"
  // Switching
  | "SWITCHING_STANDARD"
  | "SWITCHING_DIMMER"
  | "SWITCHING_2WAY"
  | "SWITCHING_3WAY"
  | "SWITCHING_DYNALITE"
  // Sensors & Automation
  | "PIR_SENSOR"
  | "KEYPAD"
  | "AUTOMATION_TOUCHSCREEN"
  | "MOTORISED_BLIND"
  // Safety & Ventilation
  | "SMOKE_DETECTOR"
  | "EXHAUST_FAN"
  | "CEILING_FAN"
  // Security
  | "SECURITY_INTERCOM"
  | "SECURITY_CCTV"
  | "GATE_ACCESS"
  // Special Circuits
  | "UNDERFLOOR_HEAT"
  | "HEATED_TOWEL_RAIL"
  | "EV_CHARGER"
  | "EXTERNAL_HEATER"
  | "TOILET_CIRCUIT"
  | "POOL_OUTDOOR";

// ─────────────────────────────────────────────
// COMPONENT TYPE METADATA
// Display name + whether it needs user disambiguation.
// ─────────────────────────────────────────────

export interface ComponentTypeMeta {
  label: string;
  category: string;
  requiresDisambiguation: boolean;  // true = show variant picker to user
  automationFlag?: boolean;
}

export const COMPONENT_TYPE_META: Record<ComponentType, ComponentTypeMeta> = {
  GPO_STANDARD:          { label: "Single GPO",                category: "Power Points",         requiresDisambiguation: false },
  GPO_DOUBLE:            { label: "Double GPO",                 category: "Power Points",         requiresDisambiguation: true  },
  GPO_WEATHERPROOF:      { label: "Weatherproof GPO",           category: "Power Points",         requiresDisambiguation: false },
  GPO_USB:               { label: "GPO with USB",               category: "Power Points",         requiresDisambiguation: true  },
  COOKTOP_20A:           { label: "Cooktop/Oven 20A",           category: "Appliance Circuits",   requiresDisambiguation: false },
  COOKTOP_25A:           { label: "Cooktop/Oven 25A",           category: "Appliance Circuits",   requiresDisambiguation: false },
  COOKTOP_32A:           { label: "Cooktop/Oven 32A",           category: "Appliance Circuits",   requiresDisambiguation: false },
  COOKTOP_3PHASE:        { label: "Cooktop/Oven 3-Phase",       category: "Appliance Circuits",   requiresDisambiguation: false },
  DATA_TV:               { label: "TV + Data Combo",            category: "Data & Communications",requiresDisambiguation: false },
  DATA_CAT6:             { label: "Data Point (Cat6)",          category: "Data & Communications",requiresDisambiguation: false },
  WIFI_POINT:            { label: "Wi-Fi Point",                category: "Data & Communications",requiresDisambiguation: false },
  SPEAKER_POINT:         { label: "Speaker Point",              category: "Data & Communications",requiresDisambiguation: false },
  DOWNLIGHT_RECESSED:    { label: "Recessed Downlight",         category: "Lighting",             requiresDisambiguation: true  },
  DOWNLIGHT_TRIMLESS:    { label: "Trimless Downlight",         category: "Lighting",             requiresDisambiguation: false },
  DOWNLIGHT_DALI:        { label: "DALI Downlight",             category: "Lighting",             requiresDisambiguation: true, automationFlag: true },
  LED_STRIP:             { label: "LED Strip",                  category: "Lighting",             requiresDisambiguation: true  },
  WALL_LIGHT:            { label: "Wall Light",                 category: "Lighting",             requiresDisambiguation: true  },
  GARDEN_LIGHT:          { label: "Garden/External Light",      category: "Lighting",             requiresDisambiguation: false },
  PENDANT_FEATURE:       { label: "Pendant / Feature Light",    category: "Lighting",             requiresDisambiguation: false },
  TRACK_LIGHT:           { label: "Track Light",                category: "Lighting",             requiresDisambiguation: false },
  SWITCHING_STANDARD:    { label: "Switch (Conventional)",      category: "Switching",            requiresDisambiguation: false },
  SWITCHING_DIMMER:      { label: "Dimmer Switch",              category: "Switching",            requiresDisambiguation: false },
  SWITCHING_2WAY:        { label: "2-Way Switch",               category: "Switching",            requiresDisambiguation: false },
  SWITCHING_3WAY:        { label: "3-Way Switch",               category: "Switching",            requiresDisambiguation: false },
  SWITCHING_DYNALITE:    { label: "Dynalite Switch",            category: "Switching",            requiresDisambiguation: false, automationFlag: true },
  PIR_SENSOR:            { label: "PIR Sensor",                 category: "Sensors & Automation", requiresDisambiguation: true  },
  KEYPAD:                { label: "Keypad",                     category: "Sensors & Automation", requiresDisambiguation: false, automationFlag: true },
  AUTOMATION_TOUCHSCREEN:{ label: "Automation Touchscreen",     category: "Sensors & Automation", requiresDisambiguation: false, automationFlag: true },
  MOTORISED_BLIND:       { label: "Motorised Blind",            category: "Sensors & Automation", requiresDisambiguation: false, automationFlag: true },
  SMOKE_DETECTOR:        { label: "Smoke Detector",             category: "Safety",               requiresDisambiguation: false },
  EXHAUST_FAN:           { label: "Exhaust Fan",                category: "Ventilation",          requiresDisambiguation: false },
  CEILING_FAN:           { label: "Ceiling Fan",                category: "Ventilation",          requiresDisambiguation: false },
  SECURITY_INTERCOM:     { label: "Intercom / Doorbell",        category: "Security",             requiresDisambiguation: false },
  SECURITY_CCTV:         { label: "CCTV Camera",                category: "Security",             requiresDisambiguation: false },
  GATE_ACCESS:           { label: "Gate / Access Keypad",       category: "Security",             requiresDisambiguation: false },
  UNDERFLOOR_HEAT:       { label: "Underfloor Heating",         category: "Special Circuits",     requiresDisambiguation: false },
  HEATED_TOWEL_RAIL:     { label: "Heated Towel Rail",          category: "Special Circuits",     requiresDisambiguation: false },
  EV_CHARGER:            { label: "EV Charger",                 category: "Special Circuits",     requiresDisambiguation: false },
  EXTERNAL_HEATER:       { label: "External Heater",            category: "Special Circuits",     requiresDisambiguation: false },
  TOILET_CIRCUIT:        { label: "Toilet Circuit",             category: "Special Circuits",     requiresDisambiguation: false },
  POOL_OUTDOOR:          { label: "Pool / Outdoor Circuit",     category: "Special Circuits",     requiresDisambiguation: false },
};

// ─────────────────────────────────────────────
// COMPONENT TYPE → CATALOGUE ID MAP
// Which Vesh catalogue item IDs resolve from each componentType.
// Items are ordered: most common first (used as the default selection).
// ─────────────────────────────────────────────

export const COMPONENT_TYPE_TO_SKU: Record<ComponentType, string[]> = {
  GPO_STANDARD:          ["GPO_SINGLE_STANDARD", "GPO_OWN_CIRCUIT", "GPO_SWITCHED", "GPO_FLOOR_BOX"],
  GPO_DOUBLE:            ["GPO_DOUBLE_STANDARD", "GPO_DOUBLE_ZETR13_WHITE", "GPO_DOUBLE_ZETR12_WHITE", "GPO_DOUBLE_ZETR13_CARBON"],
  GPO_WEATHERPROOF:      ["GPO_DOUBLE_WEATHERPROOF"],
  GPO_USB:               ["GPO_DOUBLE_USB_STANDARD", "GPO_DOUBLE_USB_ZETR13_WHITE"],
  COOKTOP_20A:           ["COOKTOP_20AMP"],
  COOKTOP_25A:           ["COOKTOP_25AMP"],
  COOKTOP_32A:           ["COOKTOP_32AMP"],
  COOKTOP_3PHASE:        ["COOKTOP_3PHASE"],
  DATA_TV:               ["DATA_COMBO_TV"],
  DATA_CAT6:             ["DATA_CAT6_DOUBLE"],
  WIFI_POINT:            ["WIFI_POINT"],
  SPEAKER_POINT:         ["SPEAKER_POINT"],
  DOWNLIGHT_RECESSED:    ["DOWNLIGHT_STANDARD", "DOWNLIGHT_TRIMLESS"],
  DOWNLIGHT_TRIMLESS:    ["DOWNLIGHT_TRIMLESS"],
  DOWNLIGHT_DALI:        ["DOWNLIGHT_DALI", "DOWNLIGHT_DALI_TRIMLESS"],
  LED_STRIP:             ["LED_STRIP", "LED_STRIP_DALI"],
  WALL_LIGHT:            ["WALL_LIGHT_SURFACE", "WALL_LIGHT_RECESSED_DALI"],
  GARDEN_LIGHT:          ["GARDEN_LIGHT"],
  PENDANT_FEATURE:       ["PENDANT_STANDARD"],
  TRACK_LIGHT:           ["TRACK_LIGHT"],
  SWITCHING_STANDARD:    ["SWITCH_CONVENTIONAL"],
  SWITCHING_DIMMER:      ["SWITCH_DIMMER"],
  SWITCHING_2WAY:        ["SWITCH_2WAY"],
  SWITCHING_3WAY:        ["SWITCH_3WAY"],
  SWITCHING_DYNALITE:    ["SWITCH_DYNALITE"],
  PIR_SENSOR:            ["PIR_POINT", "SENSOR_CONVENTIONAL", "SENSOR_DYNALITE"],
  KEYPAD:                ["KEYPAD_POINT"],
  AUTOMATION_TOUCHSCREEN:["AUTOMATION_TOUCHSCREEN"],
  MOTORISED_BLIND:       ["MOTORISED_BLIND"],
  SMOKE_DETECTOR:        ["SMOKE_DETECTOR"],
  EXHAUST_FAN:           ["EXHAUST_FAN"],
  CEILING_FAN:           ["CEILING_FAN"],
  SECURITY_INTERCOM:     ["INTERCOM"],
  SECURITY_CCTV:         ["CCTV"],
  GATE_ACCESS:           ["ACCESS_KEYPAD"],
  UNDERFLOOR_HEAT:       ["UNDERFLOOR_HEAT"],
  HEATED_TOWEL_RAIL:     ["HEATED_TOWEL_RAIL"],
  EV_CHARGER:            ["CAR_CHARGER"],
  EXTERNAL_HEATER:       ["EXTERNAL_HEATER"],
  TOILET_CIRCUIT:        ["TOILET_CIRCUIT"],
  POOL_OUTDOOR:          ["GARDEN_LIGHT"],
};

// ─────────────────────────────────────────────
// AS/NZS 1102 SYMBOL CODES → COMPONENT TYPE
// Standard Australian electrical drawing symbol codes.
// Source: AS/NZS 1102.301 (electrical diagrams).
// Legend reader uses this before falling back to text search.
// ─────────────────────────────────────────────

export const ASNZS_SYMBOL_MAP: Record<string, ComponentType> = {
  // Power
  "GPO":    "GPO_DOUBLE",
  "DGPO":   "GPO_DOUBLE",
  "SGPO":   "GPO_STANDARD",
  "WPO":    "GPO_WEATHERPROOF",
  "WP GPO": "GPO_WEATHERPROOF",
  "USB":    "GPO_USB",
  "FB":     "GPO_STANDARD",        // Floor box
  "FP":     "GPO_STANDARD",        // Floor point
  "20A":    "COOKTOP_20A",
  "25A":    "COOKTOP_25A",
  "32A":    "COOKTOP_32A",
  "3PH":    "COOKTOP_3PHASE",

  // Data & Comms
  "DP":     "DATA_CAT6",
  "TV":     "DATA_TV",
  "TV/D":   "DATA_TV",
  "WF":     "WIFI_POINT",
  "WAP":    "WIFI_POINT",
  "SP":     "SPEAKER_POINT",

  // Lighting
  "DL":     "DOWNLIGHT_RECESSED",
  "TDL":    "DOWNLIGHT_TRIMLESS",
  "DDL":    "DOWNLIGHT_DALI",
  "TDAL":   "DOWNLIGHT_DALI",
  "WL":     "WALL_LIGHT",
  "GL":     "GARDEN_LIGHT",
  "PL":     "PENDANT_FEATURE",
  "FL":     "PENDANT_FEATURE",     // Feature light
  "TL":     "TRACK_LIGHT",
  "LS":     "LED_STRIP",
  "LED":    "DOWNLIGHT_RECESSED",

  // Switching
  "S":      "SWITCHING_STANDARD",
  "S1":     "SWITCHING_STANDARD",
  "SD":     "SWITCHING_DIMMER",
  "S2":     "SWITCHING_2WAY",
  "2W":     "SWITCHING_2WAY",
  "S3":     "SWITCHING_3WAY",
  "3W":     "SWITCHING_3WAY",
  "DS":     "SWITCHING_DYNALITE",
  "DYN":    "SWITCHING_DYNALITE",

  // Sensors & Automation
  "PIR":    "PIR_SENSOR",
  "MS":     "PIR_SENSOR",          // Motion sensor
  "KP":     "KEYPAD",
  "AT":     "AUTOMATION_TOUCHSCREEN",
  "MB":     "MOTORISED_BLIND",
  "BM":     "MOTORISED_BLIND",

  // Safety & Ventilation
  "SD":     "SMOKE_DETECTOR",      // Note: may conflict with switch dimmer — legend context resolves
  "EF":     "EXHAUST_FAN",
  "CF":     "CEILING_FAN",

  // Security
  "IC":     "SECURITY_INTERCOM",
  "INT":    "SECURITY_INTERCOM",
  "CC":     "SECURITY_CCTV",
  "CCTV":   "SECURITY_CCTV",
  "AK":     "GATE_ACCESS",

  // Special Circuits
  "UFH":    "UNDERFLOOR_HEAT",
  "UF":     "UNDERFLOOR_HEAT",
  "HTR":    "HEATED_TOWEL_RAIL",
  "TR":     "HEATED_TOWEL_RAIL",
  "EV":     "EV_CHARGER",
  "EVC":    "EV_CHARGER",
  "EH":     "EXTERNAL_HEATER",
  "TC":     "TOILET_CIRCUIT",
  "POL":    "POOL_OUTDOOR",
};

// ─────────────────────────────────────────────
// LEGEND TEXT PATTERN → COMPONENT TYPE
// Common phrases that appear in Australian electrical plan legends.
// Used when ASNZS_SYMBOL_MAP has no match.
// Checked in order — first match wins.
// ─────────────────────────────────────────────

export interface LegendPattern {
  pattern: RegExp;
  componentType: ComponentType;
}

export const LEGEND_PATTERNS: LegendPattern[] = [
  // Must check more specific patterns before general ones

  // Automation / Dynalite / DALI — check before generic switch/downlight
  { pattern: /dynalite|dali(?!\s*(?:led|strip))/i,              componentType: "SWITCHING_DYNALITE" },
  { pattern: /dali.*downlight|downlight.*dali/i,                 componentType: "DOWNLIGHT_DALI" },
  { pattern: /dali.*strip|strip.*dali/i,                         componentType: "LED_STRIP" },
  { pattern: /motoris[ae]d.*blind|blind.*motor|roller.*blind/i,  componentType: "MOTORISED_BLIND" },
  { pattern: /automation.*touchscreen|touchscreen|home hub/i,    componentType: "AUTOMATION_TOUCHSCREEN" },
  { pattern: /keypad/i,                                          componentType: "KEYPAD" },
  { pattern: /pir|passive infra|motion detector/i,               componentType: "PIR_SENSOR" },

  // Power — specific before generic
  { pattern: /3.?phase.*cook|cook.*3.?phase|three.*phase/i,      componentType: "COOKTOP_3PHASE" },
  { pattern: /32.?a.*cook|cook.*32.?a/i,                         componentType: "COOKTOP_32A" },
  { pattern: /25.?a.*cook|cook.*25.?a/i,                         componentType: "COOKTOP_25A" },
  { pattern: /20.?a.*cook|cook.*20.?a|oven/i,                    componentType: "COOKTOP_20A" },
  { pattern: /floor.*box|floor.*point|floor.*gpo/i,              componentType: "GPO_STANDARD" },
  { pattern: /weatherproof|external.*gpo|outdoor.*gpo|wp.*gpo/i, componentType: "GPO_WEATHERPROOF" },
  { pattern: /usb.*gpo|gpo.*usb|usb.*power/i,                    componentType: "GPO_USB" },
  { pattern: /single.*gpo|1.*gang.*gpo/i,                        componentType: "GPO_STANDARD" },
  { pattern: /gpo|power point|powerpoint|outlet|socket/i,        componentType: "GPO_DOUBLE" },

  // Lighting — specific before generic
  { pattern: /trim.?less.*downlight|plaster.?in/i,               componentType: "DOWNLIGHT_TRIMLESS" },
  { pattern: /track.*light|rail.*light/i,                        componentType: "TRACK_LIGHT" },
  { pattern: /led.*strip|strip.*light|linear.*light/i,           componentType: "LED_STRIP" },
  { pattern: /pendant|feature.*light|chandelier/i,               componentType: "PENDANT_FEATURE" },
  { pattern: /wall.*light|sconce|art.*light/i,                   componentType: "WALL_LIGHT" },
  { pattern: /garden.*light|landscape|path.*light|external.*light/i, componentType: "GARDEN_LIGHT" },
  { pattern: /downlight|down.*light|can.*light|pot.*light/i,     componentType: "DOWNLIGHT_RECESSED" },

  // Switching
  { pattern: /2.?way.*switch|two.?way/i,                         componentType: "SWITCHING_2WAY" },
  { pattern: /3.?way.*switch|three.?way|intermediate/i,          componentType: "SWITCHING_3WAY" },
  { pattern: /dimmer|dimming.*switch/i,                          componentType: "SWITCHING_DIMMER" },
  { pattern: /switch/i,                                          componentType: "SWITCHING_STANDARD" },

  // Data & Comms
  { pattern: /speaker.*point|speaker.*wire/i,                    componentType: "SPEAKER_POINT" },
  { pattern: /wi.?fi|wireless.*point|access.*point/i,            componentType: "WIFI_POINT" },
  { pattern: /tv.*data|data.*tv|media.*point/i,                  componentType: "DATA_TV" },
  { pattern: /data.*point|cat.*6|ethernet|network.*point/i,      componentType: "DATA_CAT6" },

  // Safety & Ventilation
  { pattern: /smoke.*detector|smoke.*alarm|fire.*detector/i,     componentType: "SMOKE_DETECTOR" },
  { pattern: /exhaust.*fan|ventilation.*fan|range.*hood/i,       componentType: "EXHAUST_FAN" },
  { pattern: /ceiling.*fan/i,                                    componentType: "CEILING_FAN" },

  // Security
  { pattern: /intercom|doorbell|door.*bell|video.*door/i,        componentType: "SECURITY_INTERCOM" },
  { pattern: /cctv|security.*camera|surveillance/i,              componentType: "SECURITY_CCTV" },
  { pattern: /access.*keypad|gate.*keypad|entry.*keypad/i,       componentType: "GATE_ACCESS" },

  // Special Circuits
  { pattern: /underfloor.*heat|floor.*heat|in.?floor.*heat/i,    componentType: "UNDERFLOOR_HEAT" },
  { pattern: /towel.*rail|heated.*towel/i,                       componentType: "HEATED_TOWEL_RAIL" },
  { pattern: /ev.*charg|car.*charg|electric.*vehicle/i,          componentType: "EV_CHARGER" },
  { pattern: /external.*heater|outdoor.*heater|patio.*heater/i,  componentType: "EXTERNAL_HEATER" },
  { pattern: /toilet|bidet|smart.*toilet/i,                      componentType: "TOILET_CIRCUIT" },
  { pattern: /pool|pond.*pump/i,                                 componentType: "POOL_OUTDOOR" },
];

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Resolve a componentType to its matching catalogue items.
 * Returns ordered array — first item is the default/most common.
 */
export function resolveComponentType(componentType: ComponentType): CatalogueItem[] {
  const ids = COMPONENT_TYPE_TO_SKU[componentType] ?? [];
  return ids
    .map(id => VESH_CATALOGUE.find(item => item.id === id))
    .filter((item): item is CatalogueItem => item !== undefined);
}

/**
 * Resolve the default (most common) catalogue item for a componentType.
 * Used when auto-selecting without showing a disambiguation picker.
 */
export function resolveDefault(componentType: ComponentType): CatalogueItem | null {
  const items = resolveComponentType(componentType);
  return items[0] ?? null;
}

/**
 * Check if a componentType requires user disambiguation before adding to estimate.
 */
export function needsDisambiguation(componentType: ComponentType): boolean {
  const meta = COMPONENT_TYPE_META[componentType];
  const items = resolveComponentType(componentType);
  return meta.requiresDisambiguation && items.length > 1;
}

/**
 * Map an AS/NZS 1102 symbol code to a componentType.
 * Returns undefined if the symbol code is not in the standard map.
 */
export function mapSymbolCode(code: string): ComponentType | undefined {
  const normalized = code.trim().toUpperCase();
  return ASNZS_SYMBOL_MAP[normalized] as ComponentType | undefined;
}

/**
 * Map a legend text description to a componentType.
 * Priority:
 *   1. ASNZS symbol code exact match
 *   2. LEGEND_PATTERNS regex match (ordered, first wins)
 *   3. Fall back to vesh_catalogue mapLegendItem (text search → componentType)
 *   4. null = unrecognised, goes to Review Queue
 */
export function mapLegendTextToComponentType(legendText: string): ComponentType | null {
  const trimmed = legendText.trim();

  // Layer 1: Try AS/NZS symbol code
  const symbolMatch = mapSymbolCode(trimmed);
  if (symbolMatch) return symbolMatch;

  // Layer 2: Try regex patterns
  for (const { pattern, componentType } of LEGEND_PATTERNS) {
    if (pattern.test(trimmed)) return componentType;
  }

  // Layer 3: Fall back to catalogue text search — get componentType from matched item
  const catalogueMatch = mapLegendItem(legendText);
  if (catalogueMatch) {
    // Find which componentType this catalogue item belongs to
    for (const [ct, ids] of Object.entries(COMPONENT_TYPE_TO_SKU) as [ComponentType, string[]][]) {
      if (ids.includes(catalogueMatch.id)) return ct;
    }
  }

  return null;
}

/**
 * Full resolution pipeline: legend text → catalogue item(s).
 *
 * Used by the detection engine Review step.
 * Returns:
 *   { componentType, items, needsPicker }
 *   items.length === 1 → auto-select, confirm with user
 *   items.length > 1 → show variant picker (disambiguate)
 *   items.length === 0 → unrecognised, goes to Review Queue
 */
export function resolveLegendEntry(legendText: string): {
  componentType: ComponentType | null;
  items: CatalogueItem[];
  needsPicker: boolean;
} {
  const componentType = mapLegendTextToComponentType(legendText);

  if (!componentType) {
    return { componentType: null, items: [], needsPicker: false };
  }

  const items = resolveComponentType(componentType);
  const needsPicker = needsDisambiguation(componentType);

  return { componentType, items, needsPicker };
}

/**
 * Check if a componentType carries the automation flag.
 * Used to surface the "Automation scope detected" banner in the estimate editor.
 */
export function isAutomationComponentType(componentType: ComponentType): boolean {
  return COMPONENT_TYPE_META[componentType]?.automationFlag === true;
}

/**
 * Get all componentTypes that belong to a given category.
 */
export function getComponentTypesByCategory(category: string): ComponentType[] {
  return (Object.entries(COMPONENT_TYPE_META) as [ComponentType, ComponentTypeMeta][])
    .filter(([, meta]) => meta.category.toLowerCase() === category.toLowerCase())
    .map(([ct]) => ct);
}

/**
 * Validate that all catalogue IDs referenced in COMPONENT_TYPE_TO_SKU
 * actually exist in VESH_CATALOGUE. Throws on startup if any are missing.
 * Call this in dev/test environments.
 */
export function validateSymbolMap(): void {
  const catalogueIds = new Set(VESH_CATALOGUE.map(i => i.id));
  const errors: string[] = [];

  for (const [ct, ids] of Object.entries(COMPONENT_TYPE_TO_SKU) as [ComponentType, string[]][]) {
    for (const id of ids) {
      if (!catalogueIds.has(id)) {
        errors.push(`ComponentType "${ct}" references unknown catalogue ID "${id}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Symbol map validation failed:\n${errors.join("\n")}`);
  }
}
