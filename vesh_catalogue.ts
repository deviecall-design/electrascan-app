/**
 * Vesh Electrical Services — Complete Per-Point Price Catalogue
 * Effective 31 March 2026
 *
 * This is the single source of truth for all pricing in ElectraScan.
 * Every legend item detected from a drawing is matched against this catalogue.
 * The search() function handles: exact match, synonym match, fuzzy match.
 */

// ─────────────────────────────────────────────
// CATALOGUE ITEM TYPE
// ─────────────────────────────────────────────

export interface CatalogueItem {
  id: string;                    // Unique key e.g. "GPO_DOUBLE_STANDARD"
  category: string;              // Display category
  name: string;                  // Full display name
  price: number;                 // Standard price ex GST
  offFormPrice?: number;         // Off-form concrete premium price
  unit: "EA" | "LM" | "CIRCUIT";
  // Search synonyms — every term that should match this item
  aliases: string[];
  // The component type this maps to in the detection engine
  componentType: string;
  // Whether this item triggers automation flag
  automationFlag?: boolean;
  // Notes for estimator
  notes?: string;
}

// ─────────────────────────────────────────────
// COMPLETE VESH CATALOGUE
// ─────────────────────────────────────────────

export const VESH_CATALOGUE: CatalogueItem[] = [

  // ── POWER POINTS ────────────────────────────────────────────
  {
    id: "GPO_SINGLE_STANDARD",
    category: "Power Points",
    name: "Single GPO (standard PVC)",
    price: 260,
    offFormPrice: 360,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "single gpo", "single power point", "single powerpoint",
      "gpo single", "1 gang gpo", "single outlet",
      "single socket", "single gpo standard", "gpo",
    ],
  },
  {
    id: "GPO_DOUBLE_STANDARD",
    category: "Power Points",
    name: "Double GPO (standard PVC)",
    price: 260,
    offFormPrice: 360,
    unit: "EA",
    componentType: "GPO_DOUBLE",
    aliases: [
      "double gpo", "double power point", "double powerpoint",
      "gpo double", "2 gang gpo", "twin gpo", "twin power point",
      "double outlet", "double socket", "power point",
      "hager silhouette double power point",
      "hager double power point",
      "clipsal double power point",
      "standard double gpo", "double gpo standard pvc",
    ],
  },
  {
    id: "GPO_DOUBLE_WEATHERPROOF",
    category: "Power Points",
    name: "Double GPO – weatherproof",
    price: 290,
    offFormPrice: 390,
    unit: "EA",
    componentType: "GPO_WEATHERPROOF",
    aliases: [
      "weatherproof gpo", "weatherproof power point", "wp gpo",
      "outdoor gpo", "external gpo", "ip56 gpo", "ip66 gpo",
      "weatherproof double gpo", "external power point",
      "double gpo weatherproof", "gpo wp", "wp powerpoint",
    ],
  },
  {
    id: "GPO_DOUBLE_USB_STANDARD",
    category: "Power Points",
    name: "Double GPO with USB (standard PVC)",
    price: 360,
    offFormPrice: 460,
    unit: "EA",
    componentType: "GPO_USB",
    aliases: [
      "gpo with usb", "usb power point", "usb gpo", "gpo usb",
      "double gpo usb", "power point with usb", "usb outlet",
      "double gpo with usb charging", "usb charging point",
    ],
  },
  {
    id: "GPO_DOUBLE_ZETR13_WHITE",
    category: "Power Points",
    name: "Double GPO – Zetr 13 series – white",
    price: 525,
    offFormPrice: 725,
    unit: "EA",
    componentType: "GPO_DOUBLE",
    aliases: [
      "zetr 13 gpo", "zetr 13 double power point", "zetr 13 powerpoint",
      "zetr 13 series double gpo", "zetr13 gpo", "zetr 13 double gpo white",
      "zetr 13 series double powerpoint", "zetr 13 double powerpoint",
      "zetr double power point", "zetr gpo",
    ],
  },
  {
    id: "GPO_DOUBLE_ZETR12_WHITE",
    category: "Power Points",
    name: "Double GPO – Zetr 12 series – white",
    price: 425,
    offFormPrice: 625,
    unit: "EA",
    componentType: "GPO_DOUBLE",
    aliases: [
      "zetr 12 gpo", "zetr 12 double power point", "zetr 12 powerpoint",
      "zetr 12 series double gpo", "zetr12 gpo",
      "zetr 12 series double powerpoint", "zetr 12 double gpo white",
    ],
  },
  {
    id: "GPO_DOUBLE_USB_ZETR13_WHITE",
    category: "Power Points",
    name: "Double GPO with USB – Zetr 13 series – white",
    price: 650,
    offFormPrice: 850,
    unit: "EA",
    componentType: "GPO_USB",
    aliases: [
      "zetr 13 usb gpo", "zetr 13 gpo with usb", "zetr 13 usb power point",
      "zetr 13 series usb double gpo", "zetr usb gpo",
    ],
  },
  {
    id: "GPO_DOUBLE_ZETR13_CARBON",
    category: "Power Points",
    name: "Double GPO – Zetr 13 series Carbon",
    price: 750,
    offFormPrice: 950,
    unit: "EA",
    componentType: "GPO_DOUBLE",
    aliases: [
      "zetr 13 carbon", "zetr 13 carbon gpo", "zetr carbon gpo",
      "zetr 13 series carbon gpo", "zetr 13 black gpo",
      "zetr carbon double power point",
    ],
  },
  {
    id: "GPO_OWN_CIRCUIT",
    category: "Power Points",
    name: "GPO on own circuit",
    price: 450,
    unit: "EA",
    componentType: "GPO_STANDARD",
    notes: "Dedicated circuit — e.g. fridge, dishwasher, microwave",
    aliases: [
      "gpo own circuit", "dedicated gpo", "gpo dedicated circuit",
      "dishwasher point", "fridge point", "microwave point",
      "dedicated power point", "gpo on dedicated circuit",
    ],
  },
  {
    id: "GPO_SWITCHED",
    category: "Power Points",
    name: "GPO switched",
    price: 450,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "switched gpo", "switched power point", "gpo with switch",
      "switched outlet",
    ],
  },
  {
    id: "GPO_FLOOR_BOX",
    category: "Power Points",
    name: "Floor box point – wire & connect",
    price: 600,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "floor box", "floor gpo", "floor power point",
      "floor outlet", "floor box point",
    ],
  },

  // ── COOKING / APPLIANCES ────────────────────────────────────
  {
    id: "COOKTOP_20AMP",
    category: "Appliance Circuits",
    name: "20amp cooktop/oven connection",
    price: 450,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "20amp cooktop", "20a oven", "cooktop 20amp", "oven 20a",
      "20 amp cooktop", "cooktop connection 20a",
    ],
  },
  {
    id: "COOKTOP_25AMP",
    category: "Appliance Circuits",
    name: "25amp cooktop/oven connection",
    price: 600,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "25amp cooktop", "25a oven", "cooktop 25amp", "oven 25a",
      "25 amp cooktop",
    ],
  },
  {
    id: "COOKTOP_32AMP",
    category: "Appliance Circuits",
    name: "32amp cooktop/oven connection",
    price: 750,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "32amp cooktop", "32a oven", "cooktop 32amp", "oven 32a",
      "32 amp cooktop",
    ],
  },
  {
    id: "COOKTOP_3PHASE",
    category: "Appliance Circuits",
    name: "3-phase cooktop/oven connection",
    price: 1000,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "3 phase cooktop", "three phase cooktop", "3phase oven",
      "commercial cooktop", "3 phase oven",
    ],
  },

  // ── DATA & COMMS ─────────────────────────────────────────────
  {
    id: "DATA_COMBO_TV",
    category: "Data & Communications",
    name: "Combo TV point – 3 x Cat6 + 1 x RG6 (inc. media box)",
    price: 550,
    unit: "EA",
    componentType: "DATA_TV",
    aliases: [
      "combo tv point", "tv data combo", "tv point with cat6",
      "media point", "tv data ethernet", "dual tv data outlet",
      "dual tv/data outlet", "hdmi tv data", "tv data comms",
      "tv cat6 rg6", "comms rack point", "hdmi link to tv",
    ],
  },
  {
    id: "DATA_CAT6_DOUBLE",
    category: "Data & Communications",
    name: "Data point – 2 x Cat6",
    price: 360,
    unit: "EA",
    componentType: "DATA_CAT6",
    aliases: [
      "data point", "cat6 point", "2 x cat6", "double cat6",
      "ethernet point", "network point", "lan point",
      "data cat6", "cat 6 point", "cat6 data point",
      "data 2 x cat6",
    ],
  },
  {
    id: "WIFI_POINT",
    category: "Data & Communications",
    name: "Wi-Fi point – 1 x Cat6",
    price: 185,
    unit: "EA",
    componentType: "DATA_CAT6",
    aliases: [
      "wifi point", "wi-fi point", "wireless point", "wifi cat6",
      "access point", "wifi access point", "wireless access point",
    ],
  },
  {
    id: "SPEAKER_POINT",
    category: "Data & Communications",
    name: "Speaker point – wire & connect x 2 speakers (max 30mtrs)",
    price: 660,
    unit: "EA",
    componentType: "DATA_CAT6",
    aliases: [
      "speaker point", "speaker wire", "audio point", "sound point",
      "speaker connection", "in-wall speaker", "speaker wiring",
    ],
  },

  // ── LIGHTING ─────────────────────────────────────────────────
  {
    id: "DOWNLIGHT_STANDARD",
    category: "Lighting",
    name: "Single down light point",
    price: 200,
    offFormPrice: 350,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    aliases: [
      "downlight", "down light", "recessed downlight", "led downlight",
      "recessed down light", "downlights", "recessed pair of down lights",
      "recessed pair downlights", "downlight point", "led down light",
      "surface can light", "can light", "pot light",
    ],
  },
  {
    id: "DOWNLIGHT_TRIMLESS",
    category: "Lighting",
    name: "Single down light point – trim-less",
    price: 240,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    notes: "Plaster-in/trim-less finish",
    aliases: [
      "trimless downlight", "trim-less downlight", "plaster in downlight",
      "plasterboard downlight", "trimless down light",
    ],
  },
  {
    id: "DOWNLIGHT_DALI",
    category: "Lighting",
    name: "Single down light point – Dali",
    price: 220,
    offFormPrice: 370,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    automationFlag: true,
    aliases: [
      "dali downlight", "dali down light", "dali lighting",
      "dynalite downlight", "dynalite down light",
      "dali dimming downlight", "smart downlight",
    ],
  },
  {
    id: "DOWNLIGHT_DALI_TRIMLESS",
    category: "Lighting",
    name: "Single down light point – Dali – trim-less",
    price: 260,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    automationFlag: true,
    aliases: [
      "dali trimless downlight", "dali trim-less downlight",
      "dali plaster in downlight",
    ],
  },
  {
    id: "LED_STRIP",
    category: "Lighting",
    name: "Single LED strip",
    price: 400,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    aliases: [
      "led strip", "led strip light", "strip light", "led tape",
      "led strip lighting", "strip lighting", "led linear",
      "linear light", "led ribbon",
    ],
  },
  {
    id: "LED_STRIP_DALI",
    category: "Lighting",
    name: "Single LED strip inc Dali driver",
    price: 450,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    automationFlag: true,
    aliases: [
      "led strip dali", "dali led strip", "led strip with dali driver",
      "dali strip light", "dynalite led strip",
    ],
  },
  {
    id: "WALL_LIGHT_SURFACE",
    category: "Lighting",
    name: "Single wall light – surface mounted",
    price: 250,
    offFormPrice: 350,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    aliases: [
      "wall light", "wall light surface", "surface wall light",
      "surface mounted wall light", "sconce", "wall sconce",
      "wall mounted light", "external wall light",
      "art light", "art lighting",
    ],
  },
  {
    id: "WALL_LIGHT_RECESSED_DALI",
    category: "Lighting",
    name: "Single wall light – recessed or Dali",
    price: 300,
    offFormPrice: 400,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    automationFlag: true,
    aliases: [
      "wall light recessed", "recessed wall light", "dali wall light",
      "wall light dali",
    ],
  },
  {
    id: "GARDEN_LIGHT",
    category: "Lighting",
    name: "Single garden light point",
    price: 150,
    unit: "EA",
    componentType: "POOL_OUTDOOR",
    aliases: [
      "garden light", "garden lighting", "external light", "outdoor light",
      "landscape light", "path light", "garden light point",
    ],
  },
  {
    id: "PENDANT_STANDARD",
    category: "Lighting",
    name: "Single standard pendant light",
    price: 600,
    offFormPrice: 750,
    unit: "EA",
    componentType: "PENDANT_FEATURE",
    aliases: [
      "pendant light", "pendant", "hanging light", "feature pendant",
      "pendant tbc", "feature light", "chandelier", "feature lighting",
      "pendant fitting", "decorative pendant",
    ],
  },
  {
    id: "TRACK_LIGHT",
    category: "Lighting",
    name: "Track light point",
    price: 1000,
    unit: "EA",
    componentType: "DOWNLIGHT_RECESSED",
    notes: "Track lighting system — includes track + fittings per point",
    aliases: [
      "track light", "track lighting", "track light point",
      "rail lighting", "track spotlight", "track mounted light",
      "track fitting",
    ],
  },

  // ── SWITCHING ────────────────────────────────────────────────
  {
    id: "SWITCH_CONVENTIONAL",
    category: "Switching",
    name: "Switch point – conventional",
    price: 120,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    aliases: [
      "switch", "light switch", "conventional switch",
      "standard switch", "single switch", "switch point",
      "single pole switch", "zetr 13 light switch",
      "zetr 12 light switch", "zetr 13 series light switch",
      "zetr 12 series light switch", "switch point conventional",
    ],
  },
  {
    id: "SWITCH_DIMMER",
    category: "Switching",
    name: "Switch point – conventional inc. dimmer",
    price: 220,
    unit: "EA",
    componentType: "SWITCHING_DIMMER",
    aliases: [
      "dimmer", "dimmer switch", "dimmer point", "switch with dimmer",
      "dimming switch", "light dimmer", "conventional dimmer",
    ],
  },
  {
    id: "SWITCH_2WAY",
    category: "Switching",
    name: "2-way switch point – conventional",
    price: 200,
    unit: "EA",
    componentType: "SWITCHING_2WAY",
    aliases: [
      "2 way switch", "2-way switch", "two way switch",
      "corridor switch", "stair switch", "2 gang switch",
    ],
  },
  {
    id: "SWITCH_3WAY",
    category: "Switching",
    name: "3-way switch point – conventional",
    price: 250,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    aliases: [
      "3 way switch", "3-way switch", "three way switch",
      "intermediate switch", "3 gang switch",
    ],
  },
  {
    id: "SWITCH_DYNALITE",
    category: "Switching",
    name: "Switch point – Dynalite – wire only",
    price: 180,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    automationFlag: true,
    notes: "Wire only — Dynalite programming billed separately",
    aliases: [
      "dynalite switch", "dynalite switch point", "dynalite lighting switch",
      "dali switch", "automation switch", "smart switch point",
      "dynalite keypad", "automation light switch",
      "zetr 13 series double powerpoint dynalite",
    ],
  },

  // ── SENSORS & AUTOMATION ─────────────────────────────────────
  {
    id: "SENSOR_SUPPLY_INSTALL",
    category: "Sensors & Automation",
    name: "Sensor – supply & install",
    price: 380,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    aliases: [
      "sensor", "light sensor", "occupancy sensor",
      "sensor supply install", "motion sensor",
    ],
  },
  {
    id: "PIR_POINT",
    category: "Sensors & Automation",
    name: "PIR point – 1 x 6-core",
    price: 185,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    aliases: [
      "pir", "pir point", "pir sensor", "motion detector",
      "passive infrared", "pir detection point",
    ],
  },
  {
    id: "KEYPAD_POINT",
    category: "Sensors & Automation",
    name: "Keypad point – 1 x 6-core",
    price: 185,
    unit: "EA",
    componentType: "AUTOMATION_HUB",
    automationFlag: true,
    aliases: [
      "keypad", "keypad point", "automation keypad",
      "control keypad", "lighting keypad",
    ],
  },
  {
    id: "SENSOR_DYNALITE",
    category: "Sensors & Automation",
    name: "Sensor point – Dynalite – wire only",
    price: 180,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    automationFlag: true,
    notes: "Wire only — Dynalite programming billed separately",
    aliases: [
      "dynalite sensor", "dali sensor", "automation sensor",
      "sensor point dynalite",
    ],
  },
  {
    id: "SENSOR_CONVENTIONAL",
    category: "Sensors & Automation",
    name: "Sensor point – conventional",
    price: 200,
    unit: "EA",
    componentType: "SWITCHING_STANDARD",
    aliases: [
      "conventional sensor", "standard sensor", "sensor conventional",
    ],
  },
  {
    id: "ACCESS_KEYPAD",
    category: "Sensors & Automation",
    name: "Access Key Pad",
    price: 400,
    unit: "EA",
    componentType: "GATE_ACCESS",
    aliases: [
      "access keypad", "access control keypad", "door access keypad",
      "entry keypad", "security keypad", "gate keypad",
    ],
  },
  {
    id: "AUTOMATION_TOUCHSCREEN",
    category: "Sensors & Automation",
    name: "Automation Touchscreen",
    price: 1200,
    unit: "EA",
    componentType: "AUTOMATION_HUB",
    automationFlag: true,
    aliases: [
      "automation touchscreen", "home automation screen",
      "smart home touchscreen", "automation panel",
      "control touchscreen", "dynalite touchscreen",
      "home automation hub", "automation controller",
    ],
  },

  // ── SAFETY ───────────────────────────────────────────────────
  {
    id: "SMOKE_DETECTOR",
    category: "Safety",
    name: "Smoke detector",
    price: 360,
    unit: "EA",
    componentType: "SECURITY_ALARM",
    aliases: [
      "smoke detector", "smoke alarm", "fire detector",
      "smoke detection", "heat detector",
    ],
  },
  {
    id: "EXHAUST_FAN",
    category: "Ventilation",
    name: "Exhaust fan point – conventional - automated",
    price: 215,
    unit: "EA",
    componentType: "EXHAUST_FAN",
    notes: "Range $180–$250 depending on spec",
    aliases: [
      "exhaust fan", "exhaust fan point", "ventilation fan",
      "bathroom fan", "kitchen exhaust fan", "range hood",
      "exhaust", "fan point", "ceiling fan exhaust",
    ],
  },
  {
    id: "CEILING_FAN",
    category: "Ventilation",
    name: "Ceiling fan point",
    price: 450,
    unit: "EA",
    componentType: "EXHAUST_FAN",
    aliases: [
      "ceiling fan", "ceiling fan point", "fan point",
      "ceiling mounted fan", "pedestal fan connection",
    ],
  },

  // ── SECURITY ─────────────────────────────────────────────────
  {
    id: "INTERCOM",
    category: "Security",
    name: "Intercom point – 1 x Cat6 + 1 x 6-core",
    price: 250,
    unit: "EA",
    componentType: "SECURITY_INTERCOM",
    aliases: [
      "intercom", "intercom point", "video intercom",
      "doorbell", "door bell", "door intercom",
      "entry intercom", "video doorbell", "bell point",
    ],
  },
  {
    id: "CCTV",
    category: "Security",
    name: "CCTV",
    price: 300,
    unit: "EA",
    componentType: "SECURITY_CCTV",
    aliases: [
      "cctv", "cctv camera", "security camera", "camera point",
      "surveillance camera", "ip camera", "security cctv",
    ],
  },

  // ── SPECIAL CIRCUITS ─────────────────────────────────────────
  {
    id: "UNDERFLOOR_HEAT",
    category: "Special Circuits",
    name: "Under floor heat circuit inc. remote sensor location",
    price: 450,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "underfloor heating", "under floor heat", "floor heating",
      "radiant floor heat", "in floor heating", "heated floor",
      "underfloor heat circuit", "floor heat point",
    ],
  },
  {
    id: "MOTORISED_BLIND",
    category: "Special Circuits",
    name: "Motorised blind point – wire & connect",
    price: 380,
    unit: "EA",
    componentType: "AUTOMATION_HUB",
    automationFlag: true,
    notes: "Includes wiring and motor connection. Part of automation scope.",
    aliases: [
      "motorised blind", "motorized blind", "blind motor",
      "motorised blind point", "electric blind", "automated blind",
      "roller blind motor", "motorised roller blind",
      "motorised curtain", "blind automation",
    ],
  },
  {
    id: "HEATED_TOWEL_RAIL",
    category: "Special Circuits",
    name: "Heated towel rail point – wire & connect",
    price: 450,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "heated towel rail", "towel rail", "towel warmer",
      "electric towel rail", "heated towel rail point",
      "towel rail point", "vertical heated towel rail",
      "bathroom towel rail",
    ],
  },
  {
    id: "CAR_CHARGER",
    category: "Special Circuits",
    name: "Car charger point – wire & connect (max 15mtrs)",
    price: 1000,
    unit: "EA",
    componentType: "EV_CHARGER",
    aliases: [
      "ev charger", "car charger", "electric vehicle charger",
      "ev charging point", "ev charger point", "tesla charger",
      "ev charge point", "electric car charging",
      "car charging point", "ev", "electric vehicle",
    ],
  },
  {
    id: "EXTERNAL_HEATER",
    category: "Special Circuits",
    name: "External Heater",
    price: 850,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "external heater", "outdoor heater", "alfresco heater",
      "patio heater", "infrared heater", "radiant heater",
    ],
  },
  {
    id: "TOILET_CIRCUIT",
    category: "Special Circuits",
    name: "Toilet",
    price: 450,
    unit: "EA",
    componentType: "GPO_STANDARD",
    aliases: [
      "toilet", "toilet circuit", "toilet power point",
      "bidet", "smart toilet", "washlet",
    ],
  },
];

// ─────────────────────────────────────────────
// SEARCH FUNCTION — 3-layer matching
// ─────────────────────────────────────────────

export interface SearchResult {
  item: CatalogueItem;
  score: number;        // 0-100, higher = better match
  matchType: "exact" | "alias" | "fuzzy";
}

/**
 * Search the Vesh catalogue by any text.
 * Returns ranked results — exact/alias matches first, fuzzy matches second.
 *
 * Usage:
 *   searchCatalogue("zetr 13 double power point")  → Double GPO Zetr 13 $525
 *   searchCatalogue("GPO")                         → all GPO variants
 *   searchCatalogue("track light")                  → Track light point $1,000
 *   searchCatalogue("dynalite switch")              → Dynalite switch $180
 */
export function searchCatalogue(
  query: string,
  limit: number = 10
): SearchResult[] {
  if (!query || query.trim().length < 1) return [];

  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const item of VESH_CATALOGUE) {
    if (seen.has(item.id)) continue;

    // Layer 1: Exact name match
    if (item.name.toLowerCase() === q) {
      results.push({ item, score: 100, matchType: "exact" });
      seen.add(item.id);
      continue;
    }

    // Layer 2: Alias exact match
    const aliasMatch = item.aliases.find(a => a.toLowerCase() === q);
    if (aliasMatch) {
      results.push({ item, score: 95, matchType: "alias" });
      seen.add(item.id);
      continue;
    }

    // Layer 2b: Alias contains query
    const aliasContains = item.aliases.find(a => a.toLowerCase().includes(q));
    if (aliasContains) {
      results.push({ item, score: 85, matchType: "alias" });
      seen.add(item.id);
      continue;
    }

    // Layer 2c: Query contains alias word
    const words = q.split(/\s+/);
    const aliasWordMatch = item.aliases.find(a => {
      const aliasWords = a.toLowerCase().split(/\s+/);
      return aliasWords.some(aw => words.includes(aw) && aw.length > 2);
    });
    if (aliasWordMatch) {
      results.push({ item, score: 75, matchType: "alias" });
      seen.add(item.id);
      continue;
    }

    // Layer 3: Fuzzy — name contains query words
    const nameWords = item.name.toLowerCase().split(/\s+/);
    const matchingWords = words.filter(w => w.length > 2 && nameWords.some(nw => nw.includes(w) || w.includes(nw)));
    if (matchingWords.length > 0) {
      const score = 40 + (matchingWords.length / words.length) * 30;
      results.push({ item, score, matchType: "fuzzy" });
      seen.add(item.id);
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Map a legend item description to the best matching catalogue item.
 * Used by the detection engine to go from legend text → Vesh price.
 *
 * Returns null if no match found (should fall back to Claude semantic mapping).
 */
export function mapLegendItem(legendDescription: string): CatalogueItem | null {
  const results = searchCatalogue(legendDescription, 1);
  if (results.length === 0) return null;
  if (results[0].score < 50) return null; // Too uncertain
  return results[0].item;
}

/**
 * Get all items in a category.
 */
export function getByCategory(category: string): CatalogueItem[] {
  return VESH_CATALOGUE.filter(item =>
    item.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get all unique categories.
 */
export function getCategories(): string[] {
  return [...new Set(VESH_CATALOGUE.map(item => item.category))];
}

/**
 * Check if a legend description triggers the automation flag.
 */
export function isAutomationItem(description: string): boolean {
  const match = mapLegendItem(description);
  return match?.automationFlag === true;
}
