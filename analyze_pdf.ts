/**
 * ElectraScan — PDF Detection Engine v2
 * =======================================
 * Two-pass detection:
 *   Pass 1 — Legend extraction: reads the drawing legend/key/schedule
 *   Pass 2 — Plan detection: scans the floor plan using legend as ground truth
 *
 * Based on DetectionSpec v1.0 — 31 March 2026
 */

import Anthropic from "@anthropic-ai/sdk";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// ─────────────────────────────────────────────
// 1. TYPES
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
  | "LEGEND_MISMATCH" | "NOT_ELECTRICAL_SCOPE";

export interface LegendItem {
  symbol_description: string;  // e.g. "Recessed pair of Down Lights"
  quantity: number;            // As stated in legend
  unit: string;                // e.g. "EA"
  mapped_type: ComponentType | null; // Our best match, null if not electrical
  in_electrical_scope: boolean;
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
  legend_quantity?: number;    // What the legend says — for cross-reference
  legend_match?: boolean;      // Does our count match the legend?
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
// 2. VESH PRICING MAP
// ─────────────────────────────────────────────

const VESH_PRICING: Record<ComponentType, number> = {
  GPO_STANDARD: 260, GPO_DOUBLE: 310, GPO_WEATHERPROOF: 410, GPO_USB: 380,
  DOWNLIGHT_RECESSED: 220, PENDANT_FEATURE: 260, EXHAUST_FAN: 195,
  SWITCHING_STANDARD: 120, SWITCHING_DIMMER: 285, SWITCHING_2WAY: 165,
  SWITCHBOARD_MAIN: 1800, SWITCHBOARD_SUB: 950,
  AC_SPLIT: 480, AC_DUCTED: 620,
  DATA_CAT6: 185, DATA_TV: 145,
  SECURITY_CCTV: 380, SECURITY_INTERCOM: 650, SECURITY_ALARM: 220,
  EV_CHARGER: 850, POOL_OUTDOOR: 420, GATE_ACCESS: 680,
  AUTOMATION_HUB: 1200,
};

const OFF_FORM_PREMIUM = 150;

const FLAG_RISK_LEVELS: Record<DetectionFlag, RiskFlag["level"]> = {
  HEIGHT_RISK: "high", AUTOMATION_DEPENDENCY: "medium", MISSING_CIRCUIT: "high",
  SCOPE_CONFIRM: "medium", OUTDOOR_LOCATION: "info", OFF_FORM_PREMIUM: "info",
  CABLE_RUN_LONG: "medium", LOW_CONFIDENCE: "info", SYMBOL_AMBIGUOUS: "medium",
  LEGEND_MISMATCH: "medium", NOT_ELECTRICAL_SCOPE: "info",
};

// ─────────────────────────────────────────────
// 3. PASS 1 — LEGEND EXTRACTION PROMPT
// ─────────────────────────────────────────────

const LEGEND_SYSTEM_PROMPT = `You are ElectraScan, reading the legend or key from an Australian electrical/architectural drawing.

Your job is to find the LEGEND, SCHEDULE, or KEY block on this drawing — usually a table in a corner listing symbols and quantities — and extract every item from it.

For each item in the legend, determine:
1. What it is (plain English description)
2. The quantity shown (number, e.g. 18 EA)
3. Whether it is an electrical item in scope for an electrician

Map each item to one of these electrical types if applicable:
GPO_STANDARD, GPO_DOUBLE, GPO_WEATHERPROOF, GPO_USB,
DOWNLIGHT_RECESSED, PENDANT_FEATURE, EXHAUST_FAN,
SWITCHING_STANDARD, SWITCHING_DIMMER, SWITCHING_2WAY,
SWITCHBOARD_MAIN, SWITCHBOARD_SUB, AC_SPLIT, AC_DUCTED,
DATA_CAT6, DATA_TV, SECURITY_CCTV, SECURITY_INTERCOM, SECURITY_ALARM,
EV_CHARGER, POOL_OUTDOOR, GATE_ACCESS, AUTOMATION_HUB

Items NOT in electrical scope (e.g. motorised blinds, furniture, plumbing) should have mapped_type: null and in_electrical_scope: false.

If no legend is found, return legend_found: false with an empty items array.

Return ONLY valid JSON, no markdown, no explanation:
{
  "legend_found": true,
  "scale_detected": "1:100",
  "items": [
    {
      "symbol_description": "Recessed pair of Down Lights",
      "quantity": 18,
      "unit": "EA",
      "mapped_type": "DOWNLIGHT_RECESSED",
      "in_electrical_scope": true,
      "notes": "Paired recessed LED downlights"
    },
    {
      "symbol_description": "Motorised Blind",
      "quantity": 14,
      "unit": "EA",
      "mapped_type": null,
      "in_electrical_scope": false,
      "notes": "Blind motor — not electrical scope unless wiring shown"
    }
  ]
}`;

// ─────────────────────────────────────────────
// 4. PASS 2 — DETECTION PROMPT (legend-informed)
// ─────────────────────────────────────────────

const buildDetectionPrompt = (legendItems: LegendItem[]): string => {
  const legendContext = legendItems.length > 0
    ? `\n\nLEGEND FROM THIS DRAWING (use this as ground truth):\n${legendItems
        .filter(l => l.in_electrical_scope && l.mapped_type)
        .map(l => `- ${l.symbol_description}: ${l.quantity} ${l.unit} → type: ${l.mapped_type}`)
        .join("\n")}`
    : "";

  return `You are ElectraScan, detecting electrical components on an Australian residential/commercial electrical drawing.${legendContext}

IMPORTANT: The legend above is the ground truth. Use it to:
1. Correctly identify symbols you see on the plan (match them to legend descriptions)
2. Count components room by room — totals should match legend quantities
3. Flag LEGEND_MISMATCH if your room-by-room count doesn't add up to the legend total

For each component group (one entry per room per type):
- type: exact type key from the list below
- quantity: count in that specific room
- room: exact room name from the drawing (e.g. "Master Bedroom", "Kitchen", "Living/Dining")
- drawing_ref: page and zone reference if visible
- confidence: 0-100
- flags: array of applicable flags
- notes: what you see, including legend symbol match

COMPONENT TYPES (use exact keys only):
Power: GPO_STANDARD, GPO_DOUBLE, GPO_WEATHERPROOF, GPO_USB
Lighting: DOWNLIGHT_RECESSED, PENDANT_FEATURE, EXHAUST_FAN
Switching: SWITCHING_STANDARD, SWITCHING_DIMMER, SWITCHING_2WAY
Switchboard: SWITCHBOARD_MAIN, SWITCHBOARD_SUB
AC: AC_SPLIT, AC_DUCTED
Data: DATA_CAT6, DATA_TV
Security: SECURITY_CCTV, SECURITY_INTERCOM, SECURITY_ALARM
EV/Pool/Access: EV_CHARGER, POOL_OUTDOOR, GATE_ACCESS
Automation: AUTOMATION_HUB

FLAGS:
- HEIGHT_RISK: fitting above 3.5m
- AUTOMATION_DEPENDENCY: C-Bus/KNX/Dali/smart system
- MISSING_CIRCUIT: equipment shown, no circuit
- SCOPE_CONFIRM: unclear scope
- OUTDOOR_LOCATION: external install
- OFF_FORM_PREMIUM: off-form concrete
- CABLE_RUN_LONG: cable run > 20m
- LOW_CONFIDENCE: confidence 50-69
- SYMBOL_AMBIGUOUS: confidence < 50
- LEGEND_MISMATCH: your count differs from legend quantity

CONFIDENCE: 90-100 auto-confirm, 70-89 needs_review, 50-69 LOW_CONFIDENCE flag, <50 SYMBOL_AMBIGUOUS

Return ONLY valid JSON:
{
  "scale_detected": "1:50",
  "components": [
    {
      "type": "DOWNLIGHT_RECESSED",
      "quantity": 6,
      "room": "Kitchen",
      "drawing_ref": "E-01",
      "confidence": 95,
      "needs_review": false,
      "flags": [],
      "notes": "Recessed downlights matching legend symbol. Legend total 18 across all rooms."
    }
  ]
}`;
};

// ─────────────────────────────────────────────
// 5. PDF → IMAGES
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
// 6. ENRICHMENT
// ─────────────────────────────────────────────

function enrichComponents(
  rawComponents: any[],
  legendItems: LegendItem[]
): DetectedComponent[] {
  // Build legend lookup by type
  const legendByType: Record<string, number> = {};
  legendItems.forEach(l => {
    if (l.mapped_type && l.in_electrical_scope) {
      legendByType[l.mapped_type] = (legendByType[l.mapped_type] ?? 0) + l.quantity;
    }
  });

  // Build detected totals per type
  const detectedTotals: Record<string, number> = {};
  rawComponents.forEach(c => {
    detectedTotals[c.type] = (detectedTotals[c.type] ?? 0) + (c.quantity ?? 1);
  });

  return rawComponents
    .filter(c => (c.confidence ?? 50) >= 50)
    .map(c => {
      const flags: DetectionFlag[] = [...(c.flags ?? [])];

      // Force LOW_CONFIDENCE
      if ((c.confidence ?? 100) < 70 && !flags.includes("LOW_CONFIDENCE")) {
        flags.push("LOW_CONFIDENCE");
      }

      // Check legend mismatch (only flag on first component of that type)
      const legendQty = legendByType[c.type];
      const detectedQty = detectedTotals[c.type];
      const legendMatch = legendQty === undefined || Math.abs(detectedQty - legendQty) <= 1;
      if (!legendMatch && legendQty !== undefined && !flags.includes("LEGEND_MISMATCH")) {
        flags.push("LEGEND_MISMATCH");
      }

      const unitPrice = VESH_PRICING[c.type as ComponentType] ?? 0;
      const offForm = flags.includes("OFF_FORM_PREMIUM") ? OFF_FORM_PREMIUM : 0;
      const effectivePrice = unitPrice + offForm;

      return {
        type: c.type as ComponentType,
        quantity: c.quantity ?? 1,
        room: c.room ?? "Unspecified",
        drawing_ref: c.drawing_ref ?? "",
        confidence: c.confidence ?? 75,
        needs_review: (c.confidence ?? 100) < 90,
        flags,
        notes: c.notes ?? "",
        unit_price: effectivePrice,
        line_total: effectivePrice * (c.quantity ?? 1),
        legend_quantity: legendQty,
        legend_match: legendMatch,
      };
    });
}

function generateRiskFlags(components: DetectedComponent[]): RiskFlag[] {
  const descriptions: Record<DetectionFlag, string> = {
    HEIGHT_RISK: "Fitting above 3.5m — scaffold or EWP required. Add height allowance.",
    AUTOMATION_DEPENDENCY: "Smart system detected — requires licensed programmer.",
    MISSING_CIRCUIT: "Equipment shown but no dedicated circuit on electrical drawing.",
    SCOPE_CONFIRM: "Confirm with architect whether this item is in electrical scope.",
    OUTDOOR_LOCATION: "External install — confirm IP rating and weatherproofing.",
    OFF_FORM_PREMIUM: "Off-form concrete — premium of $100–$200 per point applies.",
    CABLE_RUN_LONG: "Estimated cable run exceeds 20m. Verify and add cable allowance.",
    LOW_CONFIDENCE: "Symbol unclear — verify quantity and type on drawing before quoting.",
    SYMBOL_AMBIGUOUS: "Symbol unidentifiable — manual check required.",
    LEGEND_MISMATCH: "Your detected count differs from the legend quantity. Verify on drawing.",
    NOT_ELECTRICAL_SCOPE: "Item in legend but not in electrical scope — excluded from estimate.",
  };

  const flags: RiskFlag[] = [];
  const seen = new Set<string>();

  for (const c of components) {
    for (const flag of c.flags) {
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
// 7. MAIN FUNCTION — TWO-PASS DETECTION
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

  console.log(`[ElectraScan v2] Converting PDF: ${file.name}`);
  const pageImages = await pdfToImages(file);
  const pageCount = pageImages.length;
  console.log(`[ElectraScan v2] ${pageCount} pages converted`);

  const imageBlocks: Anthropic.ImageBlockParam[] = pageImages.map(base64 => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data: base64 },
  }));

  // ── PASS 1: Extract legend ──────────────────────────────────
  console.log("[ElectraScan v2] Pass 1: Extracting legend...");
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
          { type: "text", text: `Drawing: ${file.name}. Find and extract the complete legend/key/schedule from this drawing.` },
        ],
      }],
    });

    rawLegendResponse = legendResponse.content[0].type === "text" ? legendResponse.content[0].text : "";
    const legendParsed = JSON.parse(extractJSON(rawLegendResponse));
    legendFound = legendParsed.legend_found ?? false;
    legendItems = legendParsed.items ?? [];
    scaleDetected = legendParsed.scale_detected ?? "unknown";

    console.log(`[ElectraScan v2] Legend found: ${legendFound}, ${legendItems.length} items`);
    legendItems.forEach(item => {
      console.log(`  ${item.symbol_description}: ${item.quantity} ${item.unit} → ${item.mapped_type ?? "not electrical"}`);
    });
  } catch (err) {
    console.warn("[ElectraScan v2] Legend extraction failed, proceeding without legend:", err);
  }

  // ── PASS 2: Detect components on plan ─────────────────────
  console.log("[ElectraScan v2] Pass 2: Detecting components on plan...");
  let rawResponse = "";

  const detectionSystemPrompt = buildDetectionPrompt(legendItems);

  const detectionResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: detectionSystemPrompt,
    messages: [{
      role: "user",
      content: [
        ...imageBlocks,
        {
          type: "text",
          text: `Drawing: ${file.name}. Version: ${drawingVersion}. ${pageCount} page(s). Detect all electrical components room by room. Use the legend quantities as your verification target.`,
        },
      ],
    }],
  });

  rawResponse = detectionResponse.content[0].type === "text" ? detectionResponse.content[0].text : "";

  let parsedDetection: { scale_detected?: string; components: any[] };
  try {
    parsedDetection = JSON.parse(extractJSON(rawResponse));
    if (scaleDetected === "unknown" && parsedDetection.scale_detected) {
      scaleDetected = parsedDetection.scale_detected;
    }
  } catch (err) {
    console.error("[ElectraScan v2] Failed to parse detection JSON:", rawResponse);
    throw new Error("Failed to parse component detection response.");
  }

  // ── Enrich + risk flags ──────────────────────────────────
  const components = enrichComponents(parsedDetection.components ?? [], legendItems);
  const riskFlags = generateRiskFlags(components);
  const estimateSubtotal = components.reduce((s, c) => s + c.line_total, 0);

  console.log(`[ElectraScan v2] Complete: ${components.length} components, $${estimateSubtotal.toLocaleString()} subtotal`);

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

// ─────────────────────────────────────────────
// 8. HELPERS
// ─────────────────────────────────────────────

export function groupByRoom(components: DetectedComponent[]): Record<string, DetectedComponent[]> {
  return components.reduce((acc, c) => {
    const room = c.room || "Unknown";
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

export function getComponentSummary(components: DetectedComponent[]): Record<string, number> {
  return components.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + c.quantity;
    return acc;
  }, {} as Record<string, number>);
}
