/**
 * The uploaded plan's file name is the label people see.
 * The EST reference stays the unique key and is shown beside the name.
 * A second upload of the same file gets a short version suffix.
 */

export interface DocumentRecord {
  estimateId?: string | null;
  scanId?: string | null;
  reference?: string | null;
  fileName?: string | null;
  createdAt?: string | null;
  customLabel?: string | null;
}

export interface DocumentLabelIndex {
  byEstimateId: Record<string, string>;
  byReference: Record<string, string>;
  byScanId: Record<string, string>;
}

const LOCAL_KEY = "es-doc-labels:v1";

export function cleanDocumentName(fileName: string | null | undefined): string {
  let name = String(fileName || "").trim().replace(/\\/g, "/").split("/").pop() || "";
  name = name.replace(/\.(pdf|png)$/i, "").trim();
  name = name.replace(/\s+copy(?:\s*\(\d+\))?$/i, "");
  name = name.replace(/\s*\(copy\)$/i, "");
  return name.replace(/\s+/g, " ").trim();
}

export function downloadStem(label: string, fallback: string): string {
  const stem = label.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return (stem || fallback).slice(0, 140);
}

function stamp(value: string | null | undefined): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function documentLabels(records: DocumentRecord[]): DocumentLabelIndex {
  const sorted = records.map((record, index) => ({ record, index })).sort((a, b) => {
    const time = stamp(a.record.createdAt) - stamp(b.record.createdAt);
    if (time !== 0) return time;
    const ref = (a.record.reference || "").localeCompare(b.record.reference || "");
    if (ref !== 0) return ref;
    return a.index - b.index;
  });
  const used = new Set<string>();
  const index: DocumentLabelIndex = { byEstimateId: {}, byReference: {}, byScanId: {} };
  for (const { record } of sorted) {
    const custom = (record.customLabel || "").trim();
    const base = custom || cleanDocumentName(record.fileName) || (record.reference || "").trim() || "Untitled plan";
    const label = custom ? claimExact(used, custom) : claimVersion(used, base);
    if (record.estimateId) index.byEstimateId[record.estimateId] = label;
    if (record.reference) index.byReference[record.reference] = label;
    if (record.scanId) index.byScanId[record.scanId] = label;
  }
  return index;
}

function claimExact(used: Set<string>, label: string): string {
  used.add(label.toLowerCase());
  return label;
}

function claimVersion(used: Set<string>, base: string): string {
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }
  let version = 2;
  let next = `${base} (v${version})`;
  while (used.has(next.toLowerCase())) {
    version += 1;
    next = `${base} (v${version})`;
  }
  used.add(next.toLowerCase());
  return next;
}

export function readLocalDocumentLabels(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberDocumentLabel(key: string, label: string) {
  if (typeof localStorage === "undefined" || !key) return;
  const all = readLocalDocumentLabels();
  all[key] = label.trim().slice(0, 200);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}

function picked(local: Record<string, string>, keys: string[], stored: string): string {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(local, key)) return local[key] || "";
  }
  return stored;
}

export function recordsFromRows(
  estimates: Array<Record<string, unknown>> = [],
  scans: Array<Record<string, unknown>> = [],
  local: Record<string, string> = readLocalDocumentLabels(),
): DocumentRecord[] {
  const records: DocumentRecord[] = [];
  const linkedScans = new Set<string>();
  for (const row of estimates) {
    const reference = String(row.reference || row.ref || "");
    const scan = scans.find(item => reference && String(item.estimate_ref || "") === reference);
    const scanId = scan?.id ? String(scan.id) : "";
    if (scanId) linkedScans.add(scanId);
    const stored = String(row.display_label || scan?.display_label || "").trim();
    records.push({
      estimateId: row.id ? String(row.id) : null,
      scanId: scanId || null,
      reference,
      fileName: String(row.drawing_file || scan?.file_name || row.project_name || ""),
      createdAt: String(row.created_at || scan?.started_at || ""),
      customLabel: picked(local, [`ref:${reference}`, scanId ? `scan:${scanId}` : ""], stored),
    });
  }
  for (const scan of scans) {
    const scanId = scan.id ? String(scan.id) : "";
    if (!scanId || linkedScans.has(scanId)) continue;
    const reference = String(scan.estimate_ref || "");
    if (reference && estimates.some(row => String(row.reference || row.ref || "") === reference)) continue;
    records.push({
      scanId,
      reference,
      fileName: String(scan.file_name || ""),
      createdAt: String(scan.started_at || ""),
      customLabel: picked(local, [`scan:${scanId}`, reference ? `ref:${reference}` : ""], String(scan.display_label || "").trim()),
    });
  }
  return records;
}

export function indexRows(
  estimates: Array<Record<string, unknown>> = [],
  scans: Array<Record<string, unknown>> = [],
  local?: Record<string, string>,
): DocumentLabelIndex {
  return documentLabels(recordsFromRows(estimates, scans, local));
}
