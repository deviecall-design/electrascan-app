/**
 * Scan rows written to `scans` and read back on the review screen.
 * Shape matches what ScanDetailScreen keeps in memory after detection.
 */

export type DetectionStatus = "ai" | "confirmed" | "added" | "rejected";

export interface PlanMark {
  x: number;
  y: number;
}

export interface StoredDetectedItem {
  id: number;
  symbol: string;
  qty: number;
  desc: string;
  rateCode: string;
  conf: number;
  x: number;
  y: number;
  unitPrice?: number;
  /** Catalogue or library material price, ex GST. Omitted falls back to unitPrice. */
  materialUnit?: number;
  /** Labour allowance from the rate library, ex GST. Omitted means none was stored. */
  labourUnit?: number;
  category?: string;
  room?: string;
  detectedType?: string;
  /** AI-detected until the user confirms, rejects, or adds it. */
  status?: DetectionStatus;
  /** Display group such as gpo, downlight, data, smoke, switchboard. */
  group?: string;
  /** One plan position per counted symbol. Percent of the preview, 0–100. */
  marks?: PlanMark[];
}

export type ScanStage = "upload" | "review" | "quote" | "sign" | "complete";

export interface ScanWrite {
  file_name: string;
  client: string | null;
  stage: ScanStage;
  items_detected: number;
  progress: number;
  detected_items: StoredDetectedItem[];
}

const STAGE_PROGRESS: Record<ScanStage, number> = {
  upload: 15,
  review: 55,
  quote: 80,
  sign: 90,
  complete: 100,
};

export function buildScanWrite(input: {
  fileName: string;
  client?: string | null;
  stage: ScanStage;
  items: StoredDetectedItem[];
}): ScanWrite {
  return {
    file_name: input.fileName.trim() || "Untitled scan",
    client: input.client?.trim() || null,
    stage: input.stage,
    items_detected: input.items.length,
    progress: STAGE_PROGRESS[input.stage],
    detected_items: input.items,
  };
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readMarks(raw: unknown[]): PlanMark[] {
  const marks: PlanMark[] = [];
  raw.forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    const mark = entry as Record<string, unknown>;
    const x = num(mark.x);
    const y = num(mark.y);
    if (x == null || y == null) return;
    marks.push({ x, y });
  });
  return marks;
}

export function readDetectedItems(raw: unknown): StoredDetectedItem[] {
  if (!Array.isArray(raw)) return [];
  const items: StoredDetectedItem[] = [];
  raw.forEach((row, index) => {
    if (!row || typeof row !== "object") return;
    const record = row as Record<string, unknown>;
    const qty = num(record.qty);
    if (qty == null) return;
    const unitPrice = num(record.unitPrice);
    items.push({
      id: num(record.id) ?? index + 1,
      symbol: typeof record.symbol === "string" ? record.symbol : "",
      qty,
      desc: typeof record.desc === "string"
        ? record.desc
        : typeof record.description === "string"
          ? record.description
          : "Detected item",
      rateCode: typeof record.rateCode === "string"
        ? record.rateCode
        : typeof record.rate_code === "string"
          ? record.rate_code
          : "",
      conf: num(record.conf) ?? 0,
      x: num(record.x) ?? 0,
      y: num(record.y) ?? 0,
      ...(unitPrice != null ? { unitPrice } : {}),
      ...(num(record.materialUnit) != null ? { materialUnit: num(record.materialUnit) } : {}),
      ...(num(record.labourUnit) != null ? { labourUnit: num(record.labourUnit) } : {}),
      ...(typeof record.category === "string" ? { category: record.category } : {}),
      ...(typeof record.room === "string" ? { room: record.room } : {}),
      ...(typeof record.detectedType === "string" ? { detectedType: record.detectedType } : {}),
      ...(record.status === "ai" || record.status === "confirmed" || record.status === "added" || record.status === "rejected"
        ? { status: record.status }
        : {}),
      ...(typeof record.group === "string" ? { group: record.group } : {}),
      ...(Array.isArray(record.marks) ? { marks: readMarks(record.marks) } : {}),
    });
  });
  return items;
}

/** List / dashboard label. Quoted once an estimate is linked or the quote step is done. */
export function scanListStatus(scan: {
  stage?: string | null;
  estimate_ref?: string | null;
  detected_items?: unknown;
}): "Quoted" | "Needs review" | "Reviewed" | "In progress" {
  if (scan.estimate_ref || scan.stage === "quote" || scan.stage === "sign" || scan.stage === "complete") {
    return "Quoted";
  }
  const items = readDetectedItems(scan.detected_items);
  if (items.some(item => item.conf > 0 && item.conf < 0.85)) return "Needs review";
  if (items.length > 0) return "Reviewed";
  return "In progress";
}

const planFiles = new Map<string, File>();

export function rememberScanFile(scanId: string, file: File) {
  planFiles.set(scanId, file);
}

export function recallScanFile(scanId: string): File | null {
  return planFiles.get(scanId) ?? null;
}
