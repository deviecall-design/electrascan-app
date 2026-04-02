/**
 * ElectraScan — PDF Detection Engine v3
 * =======================================
 * KEY CHANGE FROM v2:
 * The legend is now the PRIMARY source of quantities.
 * The floor plan scan is used for room distribution only.
 *
 * Logic:
 *   Pass 1 — Read legend → get item types + total quantities + Vesh pricing
 *   Pass 2 — Scan floor plan → distribute legend quantities by room
 *   Result — Legend quantities × Vesh catalogue prices = accurate estimate
 */

import Anthropic from "@anthropic-ai/sdk";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
import { mapLegendItem, VESH_CATALOGUE, type CatalogueItem } from "./vesh_catalogue";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type ComponentType =
  | "GPO_STANDARD" | "GPO_DOUBLE" | "GPO_WEATHERPROOF" | "GPO_USB"
  | "DOWNLIGHT_RECESSED" | "PENDANT_FEATURE" | "EXHAUST_FAN"
  | "SWITCHING_STANDARD" | "SWITCHING_DIMMER" | "SWITCHING_2WAY"
  | "SWITCHBOARD_MAIN" | "SWITCHBOARD_SUB"
  | "AC_SPLIT" | "AC_DUCTED"
  | "DATA_CAT6" | "DATA_TV"
  | "SECURITY_CCTV" | "SECURITY_INTERCOM" | "SECURITY_ALARM"
  | "EV_CHARGER" | "POOL_OUTDOOR" | "GATE_ACCESS"
  | "AUTOMATION_HUB";

export type DetectionFlag =
  | "HEIGHT_RISK" | "AUTOMATION_DEPENDENCY" | "MISSING_CIRCUIT"
  | "SCOPE_CONFIRM" | "OUTDOOR_LOCATION" | "OFF_FORM_PREMIUM"
  | "CABLE_RUN_LONG" | "LOW_CONFIDENCE" | "SYMBOL_AMBIGUOUS"
  | "LEGEND_MISMATCH" | "NOT_ELECTRICAL_SCOPE" | "FROM_LEGEND";

export interface LegendItem {
  symbol_description: string;
  quantity: number;
  unit: string;
  mapped_type: ComponentType | null;
  catalogue_id: string | null;      // Matched Vesh catalogue item ID
  catalogue_price: number | null;   // Exact Vesh price from catalogue
  in_electrical_scope: boolean;
  automation_flag: boolean;
  notes: string;
}

export interface DetectedComponent {
  type: ComponentType;
  quantity: number;
  room: string;
  drawing_ref: string;
  confidence: number;
  needs_review: boolean;
  flags: DetectionFlag[];
  notes: string;
  unit_price: number;
  line_total: number;
  legend_quantity?: number;
  legend_match?: boolean;
  catalogue_item_name?: string;     // The matched Vesh item name
}

export interface DetectionResult {
  drawing_version: string;
  page_count: number;
  processed_at: string;
  scale_detected: string;
  legend_found: boolean;
  legend_items: LegendItem[];
  components: DetectedComponent[];
  risk_flags: RiskFlag[];
  estimate_subtotal: number;
  raw_response: string;
  raw_legend_response: string;
}

export interface RiskFlag {
  flag: DetectionFlag;
  level: "high" | "medium" | "info";
  component_type: ComponentType;
  description: string;
}

// ─────────────────────────────────────────────
// FALLBACK PRICING (when catalogue has no match)
// ─────────────────────────────────────────────

const FALLBACK_PRICING: Record<ComponentType, number> = {
  GPO_STANDARD: 260, GPO_DOUBLE: 260, GPO_WEATHERPROOF: 290, GPO_USB: 360,
  DOWNLIGHT_RECESSED: 200, PENDANT_FEATURE: 600, EXHAUST_FAN: 215,
  SWITCHING_STANDARD: 120, SWITCHING_DIMMER: 220, SWITCHING_2WAY: 200,
  SWITCHBOARD_MAIN: 1800, SWITCHBOARD_SUB: 950,
  AC_SPLIT: 480, AC_DUCTED: 620,
  DATA_CAT6: 360, DATA_TV: 550,
  SECURITY_CCTV: 300, SECURITY_INTERCOM: 250, SECURITY_ALARM: 360,
  EV_CHARGER: 1000, POOL_OUTDOOR: 380, GATE_ACCESS: 400,
  AUTOMATION_HUB: 1200,
};

const FLAG_RISK_LEVELS: Record<DetectionFlag, RiskFlag["level"]> = {
  HEIGHT_RISK: "high", AUTOMATION_DEPENDENCY: "medium",
  MISSING_CIRCUIT: "high", SCOPE_CONFIRM: "medium",
  OUTDOOR_LOCATION: "info", OFF_FORM_PREMIUM: "info",
  CABLE_RUN_LONG: "medium", LOW_CONFIDENCE: "info",
  SYMBOL_AMBIGUOUS: "medium", LEGEND_MISMATCH: "medium",
  NOT_ELECTRICAL_SCOPE: "info", FROM_LEGEND: "info",
};

// ─────────────────────────────────────────────
// PASS 1 — LEGEND EXTRACTION PROMPT
// ─────────────────────────────────────────────

const LEGEND_SYSTEM_PROMPT = `You are ElectraScan reading the legend/key/schedule from an Australian electrical or architectural drawing.

Find the LEGEND, KEY, or SCHEDULE table — usually in a corner listing symbols and quantities.

For EVERY item in the legend extract:
1. Exact description as written (e.g. "Recessed pair of Down Lights", "ZETR 13 series light switch")
2. Quantity shown (number)
3. Unit (usually EA)
4. Whether it is in electrical scope for an electrician

IMPORTANT scope rules:
- Power points (GPO, double power point, Hager, Zetr) → IN SCOPE
- All lighting (downlights, LED strip, wall lights, track lights, pendants) → IN SCOPE
- Switches (ZETR, Dynalite, conventional) → IN SCOPE
- Motorised blinds → IN SCOPE (electrical motor connection required)
- Ceiling fans → IN SCOPE
- Exhaust fans → IN SCOPE
- Heated towel rails → IN SCOPE (hardwired circuit)
- Underfloor heating → IN SCOPE (dedicated circuit)
- Automation touchscreens → IN SCOPE
- Door bell / intercom → IN SCOPE
- Car charger / EV → IN SCOPE
- Smoke detectors → IN SCOPE
- Sensors → IN SCOPE
- Furniture, blinds fabric, decorative items (non-electrical) → NOT in scope

Also read the scale from the title block or scale bar.

Return ONLY valid JSON:
{
  "legend_found": true,
  "scale_detected": "1:50",
  "items": [
    {
      "symbol_description": "Recessed pair of Down Lights",
      "quantity": 18,
      "unit": "EA",
      "in_electrical_scope": true,
      "notes": "Red dot symbol on ceiling plan"
    },
    {
      "symbol_description": "Motorised Blind",
      "quantity": 14,
      "unit": "EA",
      "in_electrical_scope": true,
      "notes": "Motor connection and wiring required"
    }
  ]
}`;

// ─────────────────────────────────────────────
// PASS 2 — ROOM DISTRIBUTION PROMPT
// ─────────────────────────────────────────────

const buildRoomDistributionPrompt = (legendItems: LegendItem[]): string => {
  const inScopeItems = legendItems.filter(l => l.in_electrical_scope);
  const legendSummary = inScopeItems
    .map(l => `- "${l.symbol_description}": ${l.quantity} ${l.unit} total`)
    .join("\n");

  return `You are ElectraScan distributing electrical components by room from an Australian floor plan.

THE LEGEND (total quantities already confirmed — DO NOT change totals):
${legendSummary}

YOUR JOB:
Scan the floor plan and distribute the above legend items by room.
The TOTAL across all rooms must equal the legend quantity for each item.

Rules:
1. Use exact room names from the drawing (Kitchen, Living/Dining, Master Bedroom, Bedroom 2, etc.)
2. Every quantity in the legend must be accounted for across rooms
3. If you cannot determine which room an item is in, group into "General" room
4. Map each legend description to a component type

COMPONENT TYPES (pick the closest match):
GPO_STANDARD, GPO_DOUBLE, GPO_WEATHERPROOF, GPO_USB,
DOWNLIGHT_RECESSED, PENDANT_FEATURE, EXHAUST_FAN,
SWITCHING_STANDARD, SWITCHING_DIMMER, SWITCHING_2WAY,
SWITCHBOARD_MAIN, SWITCHBOARD_SUB, AC_SPLIT, AC_DUCTED,
DATA_CAT6, DATA_TV, SECURITY_CCTV, SECURITY_INTERCOM, SECURITY_ALARM,
EV_CHARGER, POOL_OUTDOOR, GATE_ACCESS, AUTOMATION_HUB

FLAGS to apply:
- AUTOMATION_DEPENDENCY: Dynalite, Dali, C-Bus, KNX, motorised items
- HEIGHT_RISK: items above 3.5m (voids, double-height ceilings)
- OUTDOOR_LOCATION: external walls or outdoor areas

Return ONLY valid JSON:
{
  "scale_detected": "1:50",
  "components": [
    {
      "type": "DOWNLIGHT_RECESSED",
      "quantity": 6,
      "room": "Kitchen",
      "drawing_ref": "Sheet 1",
      "confidence": 90,
      "flags": [],
      "notes": "Recessed pair of Down Lights in kitchen area. Legend total: 18 EA across all rooms.",
      "legend_description": "Recessed pair of Down Lights"
    }
  ]
}`;
};

// ─────────────────────────────────────────────
// PDF → IMAGES
// ─────────────────────────────────────────────

async function pdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const images: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    images.push(canvas.toDataURL("image/png").split(",")[1]);
  }
  return images;
}

function extractJSON(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```$/im, "").trim();
}

// ─────────────────────────────────────────────
// CATALOGUE MATCHING — Map legend item to Vesh price
// ─────────────────────────────────────────────

function matchLegendToVesh(description: string): {
  catalogueItem: CatalogueItem | null;
  price: number;
  componentType: ComponentType;
  automationFlag: boolean;
} {
  const match = mapLegendItem(description);

  if (match) {
    return {
      catalogueItem: match,
      price: match.price,
      componentType: match.componentType as ComponentType,
      automationFlag: match.automationFlag ?? false,
    };
  }

  // Fallback — try keyword matching
  const desc = description.toLowerCase();
  if (desc.includes("downlight") || desc.includes("down light") || desc.includes("recessed")) {
    return { catalogueItem: null, price: 200, componentType: "DOWNLIGHT_RECESSED", automationFlag: false };
  }
  if (desc.includes("led strip") || desc.includes("strip light")) {
    const dali = desc.includes("dali") || desc.includes("dynalite");
    return { catalogueItem: null, price: dali ? 450 : 400, componentType: "DOWNLIGHT_RECESSED", automationFlag: dali };
  }
  if (desc.includes("track light") || desc.includes("track lighting")) {
    return { catalogueItem: null, price: 1000, componentType: "DOWNLIGHT_RECESSED", automationFlag: false };
  }
  if (desc.includes("wall light") || desc.includes("art light")) {
    return { catalogueItem: null, price: 250, componentType: "DOWNLIGHT_RECESSED", automationFlag: false };
  }
  if (desc.includes("pendant") || desc.includes("feature light") || desc.includes("chandelier")) {
    return { catalogueItem: null, price: 600, componentType: "PENDANT_FEATURE", automationFlag: false };
  }
  if (desc.includes("motorised blind") || desc.includes("blind motor")) {
    return { catalogueItem: null, price: 380, componentType: "AUTOMATION_HUB", automationFlag: true };
  }
  if (desc.includes("ceiling fan") || desc.includes("fan")) {
    return { catalogueItem: null, price: 450, componentType: "EXHAUST_FAN", automationFlag: false };
  }
  if (desc.includes("exhaust fan") || desc.includes("exhaust")) {
    return { catalogueItem: null, price: 215, componentType: "EXHAUST_FAN", automationFlag: false };
  }
  if (desc.includes("zetr 13") && (desc.includes("gpo") || desc.includes("power"))) {
    return { catalogueItem: null, price: 525, componentType: "GPO_DOUBLE", automationFlag: false };
  }
  if (desc.includes("zetr 12") && (desc.includes("gpo") || desc.includes("power"))) {
    return { catalogueItem: null, price: 425, componentType: "GPO_DOUBLE", automationFlag: false };
  }
  if (desc.includes("gpo") || desc.includes("power point") || desc.includes("powerpoint")) {
    const weatherproof = desc.includes("weatherproof") || desc.includes("wp");
    const usb = desc.includes("usb");
    if (weatherproof) return { catalogueItem: null, price: 290, componentType: "GPO_WEATHERPROOF", automationFlag: false };
    if (usb) return { catalogueItem: null, price: 360, componentType: "GPO_USB", automationFlag: false };
    return { catalogueItem: null, price: 260, componentType: "GPO_DOUBLE", automationFlag: false };
  }
  if (desc.includes("dynalite") || desc.includes("dali") || desc.includes("automation touchscreen")) {
    return { catalogueItem: null, price: 180, componentType: "SWITCHING_STANDARD", automationFlag: true };
  }
  if (desc.includes("switch") || desc.includes("zetr")) {
    return { catalogueItem: null, price: 120, componentType: "SWITCHING_STANDARD", automationFlag: false };
  }
  if (desc.includes("sensor") || desc.includes("light sensor") || desc.includes("pir")) {
    return { catalogueItem: null, price: 200, componentType: "SWITCHING_STANDARD", automationFlag: false };
  }
  if (desc.includes("towel rail") || desc.includes("heated towel")) {
    return { catalogueItem: null, price: 450, componentType: "GPO_STANDARD", automationFlag: false };
  }
  if (desc.includes("underfloor") || desc.includes("floor heat")) {
    return { catalogueItem: null, price: 450, componentType: "GPO_STANDARD", automationFlag: false };
  }
  if (desc.includes("intercom") || desc.includes("door bell") || desc.includes("doorbell")) {
    return { catalogueItem: null, price: 250, componentType: "SECURITY_INTERCOM", automationFlag: false };
  }
  if (desc.includes("smoke") || desc.includes("fire alarm")) {
    return { catalogueItem: null, price: 360, componentType: "SECURITY_ALARM", automationFlag: false };
  }
  if (desc.includes("tv") || desc.includes("data") || desc.includes("cat6") || desc.includes("ethernet")) {
    return { catalogueItem: null, price: 360, componentType: "DATA_CAT6", automationFlag: false };
  }

  return { catalogueItem: null, price: 200, componentType: "DOWNLIGHT_RECESSED", automationFlag: false };
}

// ─────────────────────────────────────────────
// ENRICH LEGEND ITEMS WITH VESH PRICING
// ─────────────────────────────────────────────

function enrichLegendItems(rawItems: any[]): LegendItem[] {
  return rawItems.map(item => {
    const { catalogueItem, price, componentType, automationFlag } =
      matchLegendToVesh(item.symbol_description ?? "");

    return {
      symbol_description: item.symbol_description ?? "",
      quantity: item.quantity ?? 0,
      unit: item.unit ?? "EA",
      mapped_type: componentType,
      catalogue_id: catalogueItem?.id ?? null,
      catalogue_price: price,
      in_electrical_scope: item.in_electrical_scope !== false,
      automation_flag: automationFlag,
      notes: item.notes ?? "",
    };
  });
}

// ─────────────────────────────────────────────
// BUILD COMPONENTS FROM LEGEND + ROOM DISTRIBUTION
// ─────────────────────────────────────────────

function buildComponents(
  legendItems: LegendItem[],
  roomDistribution: any[]
): DetectedComponent[] {
  const components: DetectedComponent[] = [];

  // Build a lookup of legend items by description keyword
  const legendByDescription = new Map<string, LegendItem>();
  legendItems.forEach(l => {
    legendByDescription.set(l.symbol_description.toLowerCase(), l);
  });

  // Process room distribution — match each room component back to legend pricing
  for (const c of roomDistribution) {
    // Find the legend item this component came from
    const legendDesc = (c.legend_description ?? "").toLowerCase();
    let legendItem: LegendItem | undefined;

    // Try exact match first
    legendItem = legendByDescription.get(legendDesc);

    // Try partial match
    if (!legendItem) {
      for (const [key, item] of legendByDescription) {
        if (key.includes(legendDesc) || legendDesc.includes(key)) {
          legendItem = item;
          break;
        }
      }
    }

    // Fall back to type matching
    if (!legendItem) {
      legendItem = legendItems.find(l =>
        l.mapped_type === c.type && l.in_electrical_scope
      );
    }

    const price = legendItem?.catalogue_price ?? FALLBACK_PRICING[c.type as ComponentType] ?? 200;
    const qty = c.quantity ?? 1;
    const flags: DetectionFlag[] = [...(c.flags ?? [])];

    if (legendItem?.automation_flag && !flags.includes("AUTOMATION_DEPENDENCY")) {
      flags.push("AUTOMATION_DEPENDENCY");
    }

    components.push({
      type: (c.type ?? "DOWNLIGHT_RECESSED") as ComponentType,
      quantity: qty,
      room: c.room ?? "General",
      drawing_ref: c.drawing_ref ?? "",
      confidence: c.confidence ?? 80,
      needs_review: (c.confidence ?? 80) < 90,
      flags,
      notes: c.notes ?? "",
      unit_price: price,
      line_total: price * qty,
      legend_quantity: legendItem?.quantity,
      legend_match: true,
      catalogue_item_name: legendItem
        ? `${legendItem.symbol_description} ($${legendItem.catalogue_price})`
        : undefined,
    });
  }

  // Add any in-scope legend items that were completely missed by room scan
  const coveredDescriptions = new Set(
    roomDistribution.map(c => (c.legend_description ?? "").toLowerCase())
  );

  for (const legendItem of legendItems) {
    if (!legendItem.in_electrical_scope || !legendItem.catalogue_price) continue;
    if (legendItem.quantity === 0) continue;

    const desc = legendItem.symbol_description.toLowerCase();
    const isCovered = [...coveredDescriptions].some(
      d => d.includes(desc) || desc.includes(d)
    );

    // Check by type coverage
    const typeIsCovered = components.some(
      c => c.legend_quantity === legendItem.quantity &&
           legendItem.mapped_type === c.type
    );

    if (!isCovered && !typeIsCovered) {
      console.log(`[ElectraScan v3] Legend item not found in room scan — adding directly: ${legendItem.symbol_description} ×${legendItem.quantity}`);
      const price = legendItem.catalogue_price;
      const flags: DetectionFlag[] = ["FROM_LEGEND"];
      if (legendItem.automation_flag) flags.push("AUTOMATION_DEPENDENCY");

      components.push({
        type: (legendItem.mapped_type ?? "DOWNLIGHT_RECESSED") as ComponentType,
        quantity: legendItem.quantity,
        room: "General",
        drawing_ref: "From legend",
        confidence: 85,
        needs_review: false,
        flags,
        notes: `${legendItem.symbol_description} — ${legendItem.quantity} ${legendItem.unit} as per legend`,
        unit_price: price,
        line_total: price * legendItem.quantity,
        legend_quantity: legendItem.quantity,
        legend_match: true,
        catalogue_item_name: legendItem.symbol_description,
      });
    }
  }

  return components;
}

function generateRiskFlags(components: DetectedComponent[]): RiskFlag[] {
  const descriptions: Record<DetectionFlag, string> = {
    HEIGHT_RISK: "Fitting above 3.5m — scaffold or EWP required.",
    AUTOMATION_DEPENDENCY: "Smart/automation system — requires licensed programmer. Budget separately.",
    MISSING_CIRCUIT: "Equipment shown but no dedicated circuit on electrical drawing.",
    SCOPE_CONFIRM: "Confirm scope with architect.",
    OUTDOOR_LOCATION: "External install — confirm IP rating.",
    OFF_FORM_PREMIUM: "Off-form concrete — premium applies.",
    CABLE_RUN_LONG: "Cable run exceeds 20m — verify and add allowance.",
    LOW_CONFIDENCE: "Verify quantity on drawing before quoting.",
    SYMBOL_AMBIGUOUS: "Symbol unclear — manual check required.",
    LEGEND_MISMATCH: "Detected count differs from legend — verify on drawing.",
    NOT_ELECTRICAL_SCOPE: "Item in legend but excluded from electrical scope.",
    FROM_LEGEND: "Quantity taken directly from legend — room location unconfirmed.",
  };

  const flags: RiskFlag[] = [];
  const seen = new Set<string>();

  for (const c of components) {
    for (const flag of c.flags) {
      if (flag === "FROM_LEGEND") continue; // Don't show as risk
      const key = `${flag}:${c.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        flags.push({
          flag,
          level: FLAG_RISK_LEVELS[flag],
          component_type: c.type,
          description: descriptions[flag],
        });
      }
    }
  }

  return flags;
}

// ─────────────────────────────────────────────
// MAIN FUNCTION — THREE-PASS DETECTION
// ─────────────────────────────────────────────

export async function detectElectricalComponents(
  file: File,
  drawingVersion: string = "001",
  apiKey?: string
): Promise<DetectionResult> {
  const client = new Anthropic({
    apiKey: apiKey ?? (import.meta as any).env.VITE_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  console.log(`[ElectraScan v3] Converting: ${file.name}`);
  const pageImages = await pdfToImages(file);
  const pageCount = pageImages.length;

  const imageBlocks: Anthropic.ImageBlockParam[] = pageImages.map(base64 => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
  }));

  // ── PASS 1: Legend extraction ─────────────────
  console.log("[ElectraScan v3] Pass 1: Reading legend...");
  let rawLegendResponse = "";
  let legendItems: LegendItem[] = [];
  let legendFound = false;
  let scaleDetected = "unknown";

  try {
    const legendResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: LEGEND_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: `Drawing: ${file.name}. Extract every item from the legend/schedule including motorised blinds, LED strips, ceiling fans, and all items even if not obviously electrical. They are all in scope if they need wiring or a motor connection.` },
        ],
      }],
    });

    rawLegendResponse = legendResponse.content[0].type === "text" ? legendResponse.content[0].text : "";
    const parsed = JSON.parse(extractJSON(rawLegendResponse));
    legendFound = parsed.legend_found ?? false;
    scaleDetected = parsed.scale_detected ?? "unknown";

    // Enrich with Vesh catalogue pricing
    legendItems = enrichLegendItems(parsed.items ?? []);

    console.log(`[ElectraScan v3] Legend: ${legendItems.length} items found`);
    legendItems.forEach(l => {
      if (l.in_electrical_scope) {
        console.log(`  ✓ ${l.symbol_description}: ${l.quantity} EA @ $${l.catalogue_price}`);
      }
    });

    // Calculate legend-based subtotal for reference
    const legendSubtotal = legendItems
      .filter(l => l.in_electrical_scope && l.catalogue_price)
      .reduce((s, l) => s + (l.catalogue_price! * l.quantity), 0);
    console.log(`[ElectraScan v3] Legend-based subtotal: $${legendSubtotal.toLocaleString()}`);

  } catch (err) {
    console.warn("[ElectraScan v3] Legend extraction failed:", err);
  }

  // ── PASS 2: Room distribution ──────────────────
  console.log("[ElectraScan v3] Pass 2: Distributing by room...");
  let rawResponse = "";
  let roomComponents: any[] = [];

  try {
    const distributionPrompt = buildRoomDistributionPrompt(legendItems);
    const distributionResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: distributionPrompt,
      messages: [{
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: `Drawing: ${file.name}. Distribute the legend quantities by room. Reference the legend_description field back to the original legend item for each component.` },
        ],
      }],
    });

    rawResponse = distributionResponse.content[0].type === "text" ? distributionResponse.content[0].text : "";
    const parsed = JSON.parse(extractJSON(rawResponse));
    if (parsed.scale_detected && scaleDetected === "unknown") {
      scaleDetected = parsed.scale_detected;
    }
    roomComponents = parsed.components ?? [];
    console.log(`[ElectraScan v3] Room distribution: ${roomComponents.length} entries`);

  } catch (err) {
    console.warn("[ElectraScan v3] Room distribution failed:", err);
  }

  // ── Build final components ─────────────────────
  const components = buildComponents(legendItems, roomComponents);
  const riskFlags = generateRiskFlags(components);
  const estimateSubtotal = components.reduce((s, c) => s + c.line_total, 0);

  console.log(`[ElectraScan v3] Final: ${components.length} line items, $${estimateSubtotal.toLocaleString()} subtotal`);

  return {
    drawing_version: drawingVersion,
    page_count: pageCount,
    processed_at: new Date().toISOString(),
    scale_detected: scaleDetected,
    legend_found: legendFound,
    legend_items: legendItems,
    components,
    risk_flags: riskFlags,
    estimate_subtotal: estimateSubtotal,
    raw_response: rawResponse,
    raw_legend_response: rawLegendResponse,
  };
}

// ── HELPERS ────────────────────────────────────

export function groupByRoom(components: DetectedComponent[]): Record<string, DetectedComponent[]> {
  return components.reduce((acc, c) => {
    const room = c.room || "General";
    if (!acc[room]) acc[room] = [];
    acc[room].push(c);
    return acc;
  }, {} as Record<string, DetectedComponent[]>);
}

export function getReviewItems(components: DetectedComponent[]): DetectedComponent[] {
  return components.filter(c => c.needs_review);
}

export function getLegendMismatches(components: DetectedComponent[]): DetectedComponent[] {
  return components.filter(c => c.legend_match === false);
}
