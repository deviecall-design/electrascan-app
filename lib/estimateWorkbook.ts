/**
 * Excel round-trip for one estimate.
 * SheetJS writes the workbook. Totals are recomputed with priceItem and quoteTotals.
 */

import * as XLSX from "xlsx";
import { groupEstimateLines, scaleMemberQtys } from "./groupEstimateLines";
import { priceItem } from "./quoteSource";
import { computeQuoteTotals, lineTotal, type QuoteTotals } from "./quoteTotals";

export const WORKBOOK_VERSION = "1";

export interface WorkbookLine {
  lineKey: string;
  estimateId: string;
  category: string;
  room: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  unitCost: number;
  sellRate: number;
  notes: string;
}

export interface WorkbookDetection {
  id: number;
  desc: string;
  qty: number;
  unitPrice?: number;
  category?: string;
  room?: string;
  rateCode?: string;
  symbol?: string;
  status?: string;
  manualPrice?: boolean;
  materialUnit?: number;
  labourUnit?: number;
  unit?: string;
  notes?: string;
  conf?: number;
  x?: number;
  y?: number;
}

export interface WorkbookChange {
  lineKey: string;
  description: string;
  field: "qty" | "unitCost" | "sellRate" | "notes";
  before: string;
  after: string;
}

export interface WorkbookPreview {
  changes: WorkbookChange[];
  added: WorkbookLine[];
  removed: WorkbookLine[];
  before: QuoteTotals;
  after: QuoteTotals;
  next: WorkbookDetection[];
}

const HEADERS = [
  "Line key",
  "Estimate ID",
  "Category",
  "Room",
  "Code",
  "Description",
  "Unit",
  "Qty (edit)",
  "Unit cost (edit)",
  "Sell rate (edit)",
  "Line total",
  "Notes (edit)",
];

const INSTRUCTIONS = "Edit only the columns marked (edit): Qty, Unit cost, Sell rate, and Notes. Leave the line key and estimate ID unchanged. Upload this file to the same estimate. A locked or sent estimate cannot be changed from Excel.";

function cents(value: number): number {
  return Math.round(value * 100);
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function lineKeyFor(ids: number[]): string {
  return `det:${[...ids].sort((a, b) => a - b).join(",")}`;
}

export function idsFromLineKey(lineKey: string): number[] {
  if (!lineKey.startsWith("det:")) return [];
  return lineKey.slice(4).split(",").map(part => Number(part)).filter(id => Number.isFinite(id) && id > 0);
}

export function linesFromDetections(items: WorkbookDetection[], estimateId: string): WorkbookLine[] {
  const open = items.filter(item => item.status !== "rejected" && item.qty > 0 && item.desc.trim() && (item.unitPrice ?? 0) > 0);
  const grouped = groupEstimateLines(open.map(item => ({
    description: item.desc,
    qty: item.qty,
    unitPrice: item.unitPrice ?? 0,
    unit: item.unit || "ea",
    category: item.category || "Other",
    code: item.rateCode || "",
    ids: [item.id],
    materialUnit: item.materialUnit,
    labourUnit: item.labourUnit,
    notes: item.notes || "",
    room: "",
  })));
  return grouped.map(line => ({
    lineKey: lineKeyFor(line.ids ?? []),
    estimateId,
    category: line.category || "Other",
    room: "",
    code: line.code || "",
    description: line.description,
    unit: line.unit || "ea",
    qty: line.qty,
    unitCost: typeof line.materialUnit === "number" ? line.materialUnit : line.unitPrice,
    sellRate: line.unitPrice,
    notes: (line as { notes?: string }).notes || "",
  }));
}

export function buildEstimateWorkbook(input: {
  estimateId: string;
  marginPct: number;
  lines: WorkbookLine[];
}): XLSX.WorkBook {
  const aoa: Array<Array<string | number>> = [HEADERS];
  input.lines.forEach(line => {
    aoa.push([
      line.lineKey,
      input.estimateId,
      line.category,
      line.room,
      line.code,
      line.description,
      line.unit || "ea",
      line.qty,
      line.unitCost,
      line.sellRate,
      0,
      line.notes || "",
    ]);
  });
  const lines = XLSX.utils.aoa_to_sheet(aoa);
  input.lines.forEach((_, index) => {
    const row = index + 2;
    const addr = XLSX.utils.encode_cell({ r: index + 1, c: 10 });
    lines[addr] = { t: "n", f: `H${row}*J${row}` };
  });
  lines["!cols"] = [
    { hidden: true, wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 28 },
  ];
  lines["!freeze"] = { xSplit: 0, ySplit: 1 };

  const summary = XLSX.utils.aoa_to_sheet([
    ["Subtotal", 0],
    ["Margin %", input.marginPct],
    ["Margin $", 0],
    ["GST", 0],
    ["Total inc GST", 0],
  ]);
  summary.B1 = { t: "n", f: "SUM(Lines!K2:K500)" };
  summary.B3 = { t: "n", f: "B1*B2/100" };
  summary.B4 = { t: "n", f: "(B1+B3)*0.1" };
  summary.B5 = { t: "n", f: "B1+B3+B4" };

  const info = XLSX.utils.aoa_to_sheet([
    ["Estimate ID", input.estimateId],
    ["Version", WORKBOOK_VERSION],
    ["Instructions", INSTRUCTIONS],
  ]);
  info["!cols"] = [{ wch: 16 }, { wch: 88 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, lines, "Lines");
  XLSX.utils.book_append_sheet(book, summary, "Summary");
  XLSX.utils.book_append_sheet(book, info, "Info");
  return book;
}

export function workbookToArrayBuffer(book: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function sheetRows(sheet: XLSX.WorkSheet | undefined): unknown[][] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
}

export function readEstimateWorkbook(data: ArrayBuffer): { ok: true; estimateId: string; version: string; lines: WorkbookLine[] } | { ok: false; error: string } {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(data, { type: "array" });
  } catch {
    return { ok: false, error: "That file could not be read as an Excel workbook." };
  }
  const linesSheet = book.Sheets.Lines;
  const infoSheet = book.Sheets.Info;
  if (!linesSheet || !infoSheet) {
    return { ok: false, error: "This workbook is missing the Lines or Info sheet." };
  }
  const info = sheetRows(infoSheet);
  const estimateId = String(info.find(row => String(row[0]).trim() === "Estimate ID")?.[1] ?? "").trim();
  const version = String(info.find(row => String(row[0]).trim() === "Version")?.[1] ?? "").trim();
  if (!estimateId) return { ok: false, error: "This workbook has no estimate ID." };
  const rows = sheetRows(linesSheet);
  const header = (rows[0] || []).map(cell => String(cell).trim().toLowerCase());
  const at = (name: string) => header.findIndex(cell => cell === name || cell.startsWith(name));
  const keyAt = at("line key");
  const descAt = at("description");
  const qtyAt = at("qty");
  const costAt = at("unit cost");
  const rateAt = at("sell rate");
  if (descAt < 0 || qtyAt < 0 || rateAt < 0) {
    return { ok: false, error: "The Lines sheet is missing description, qty, or sell rate." };
  }
  const lines: WorkbookLine[] = [];
  for (const row of rows.slice(1)) {
    const description = String(row[descAt] ?? "").trim();
    const qty = num(row[qtyAt]);
    if (!description && !(qty > 0)) continue;
    lines.push({
      lineKey: keyAt >= 0 ? String(row[keyAt] ?? "").trim() : "",
      estimateId,
      category: String(row[at("category")] ?? "").trim() || "Other",
      room: String(row[at("room")] ?? "").trim(),
      code: String(row[at("code")] ?? "").trim(),
      description: description || "New line",
      unit: String(row[at("unit")] ?? "").trim() || "ea",
      qty,
      unitCost: costAt >= 0 ? num(row[costAt]) : num(row[rateAt]),
      sellRate: num(row[rateAt]),
      notes: String(row[at("notes")] ?? "").trim(),
    });
  }
  return { ok: true, estimateId, version, lines };
}

function quoteOf(items: WorkbookDetection[], marginPct: number): QuoteTotals {
  const subtotal = items
    .filter(item => item.status !== "rejected" && item.qty > 0)
    .reduce((sum, item) => sum + lineTotal(item.qty, priceItem(item).sellUnit), 0);
  return computeQuoteTotals(subtotal, marginPct);
}

export function planWorkbookApply(items: WorkbookDetection[], uploaded: WorkbookLine[]): {
  next: WorkbookDetection[];
  changes: WorkbookChange[];
  added: WorkbookLine[];
  removed: WorkbookLine[];
} {
  const current = linesFromDetections(items, uploaded[0]?.estimateId || "");
  const currentByKey = new Map(current.map(line => [line.lineKey, line]));
  const seen = new Set<string>();
  const changes: WorkbookChange[] = [];
  const added: WorkbookLine[] = [];
  const patches = new Map<string, WorkbookLine>();

  for (const line of uploaded) {
    if (!line.lineKey || !currentByKey.has(line.lineKey)) {
      added.push(line);
      continue;
    }
    seen.add(line.lineKey);
    const before = currentByKey.get(line.lineKey)!;
    const fields: Array<["qty" | "unitCost" | "sellRate" | "notes", number | string, number | string]> = [
      ["qty", before.qty, line.qty],
      ["unitCost", before.unitCost, line.unitCost],
      ["sellRate", before.sellRate, line.sellRate],
      ["notes", before.notes, line.notes],
    ];
    let dirty = false;
    for (const [field, from, to] of fields) {
      const same = typeof from === "number" && typeof to === "number" ? cents(from) === cents(to) : String(from) === String(to);
      if (same) continue;
      dirty = true;
      changes.push({ lineKey: line.lineKey, description: before.description, field, before: String(from), after: String(to) });
    }
    if (dirty) patches.set(line.lineKey, line);
  }
  const removed = current.filter(line => !seen.has(line.lineKey));

  let next = items.map(item => ({ ...item }));
  for (const [lineKey, line] of patches) {
    const ids = idsFromLineKey(lineKey);
    const members = next.filter(item => ids.includes(item.id));
    const scaled = scaleMemberQtys(members.map(item => item.qty), line.qty);
    const priceChanged = cents(line.sellRate) !== cents(currentByKey.get(lineKey)!.sellRate)
      || cents(line.unitCost) !== cents(currentByKey.get(lineKey)!.unitCost);
    const qtyById = new Map(members.map((item, index) => [item.id, scaled[index] ?? item.qty]));
    next = next.map(item => {
      if (!ids.includes(item.id)) return item;
      const sell = line.sellRate;
      const cost = line.unitCost;
      return {
        ...item,
        qty: qtyById.get(item.id) ?? item.qty,
        notes: line.notes,
        unit: line.unit || item.unit,
        ...(priceChanged ? {
          unitPrice: sell,
          manualPrice: true,
          materialUnit: cost,
          labourUnit: Math.max(0, Math.round((sell - cost) * 100) / 100),
        } : {}),
      };
    });
  }
  for (const line of removed) {
    const ids = new Set(idsFromLineKey(line.lineKey));
    next = next.map(item => ids.has(item.id) ? { ...item, status: "rejected" } : item);
  }
  let nextId = next.reduce((max, item) => Math.max(max, item.id), 0);
  for (const line of added) {
    nextId += 1;
    const sell = line.sellRate;
    const cost = line.unitCost;
    next.push({
      id: nextId,
      symbol: "",
      desc: line.description,
      qty: line.qty,
      unitPrice: sell,
      manualPrice: true,
      materialUnit: cost,
      labourUnit: Math.max(0, Math.round((sell - cost) * 100) / 100),
      category: line.category,
      room: line.room || undefined,
      rateCode: line.code,
      unit: line.unit || "ea",
      notes: line.notes,
      status: "added",
      conf: 1,
      x: 0,
      y: 0,
    });
  }
  return { next, changes, added, removed };
}

export function checkWorkbookUpload(input: {
  estimateId: string;
  marginPct: number;
  items: WorkbookDetection[];
  file: ArrayBuffer;
  locked: boolean;
}): { ok: false; error: string } | ({ ok: true } & WorkbookPreview) {
  if (input.locked) {
    return { ok: false, error: "This estimate is locked, so an Excel upload can't change it." };
  }
  const read = readEstimateWorkbook(input.file);
  if (!read.ok) return read;
  if (read.estimateId !== input.estimateId) {
    return { ok: false, error: `This workbook belongs to ${read.estimateId}, not ${input.estimateId}.` };
  }
  const planned = planWorkbookApply(input.items, read.lines);
  return {
    ok: true,
    ...planned,
    before: quoteOf(input.items, input.marginPct),
    after: quoteOf(planned.next, input.marginPct),
  };
}
