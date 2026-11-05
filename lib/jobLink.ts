/**
 * How a job is named and opened.
 * A blank client or the placeholder "Client not set" falls back to the drawing name.
 * Burndown opens from an estimate reference, an estimate id, or a scan id.
 */

import { lineTotal } from "./quoteTotals";

const PLACEHOLDER = /^client not set$/i;

export function nameFromDrawing(fileName: string | null | undefined): string {
  let name = (fileName || "").replace(/\.pdf$/i, "").trim();
  if (!name) return "";
  name = name.replace(/\s+copy$/i, "");
  name = name.replace(/\(\d{1,2}\.\d{1,2}\.\d{2,4}\)/g, "");
  name = name.replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, "");
  name = name.replace(/^\d+\.\s*/, "");
  name = name.replace(/\s*[-–]\s*(electrical\s+)?plans\b.*$/i, "");
  name = name.replace(/\bquoted plans\b/i, "");
  name = name.replace(/\belectrical plans\b/i, "");
  return name.replace(/\s+/g, " ").replace(/[-–]\s*$/, "").trim();
}

export function displayClient(input: {
  client?: string | null;
  projectName?: string | null;
  drawingFile?: string | null;
  fileName?: string | null;
}): string {
  const given = (input.client || "").trim();
  if (given && !PLACEHOLDER.test(given)) return given;
  return nameFromDrawing(input.projectName || input.drawingFile || input.fileName) || "Client not set";
}

export function quotedSellExGst(items: Array<{ qty?: number; unitPrice?: number; status?: string }>): number {
  return items.reduce((sum, item) => {
    if (item.status === "rejected" || !(item.qty && item.qty > 0) || !((item.unitPrice ?? 0) > 0)) return sum;
    return sum + lineTotal(item.qty, item.unitPrice ?? 0);
  }, 0);
}

export interface JobEstimateRef {
  id?: string | null;
  reference?: string | null;
  ref?: string | null;
  client?: string | null;
  project_name?: string | null;
  drawing_file?: string | null;
}

export interface JobScanRef {
  id?: string | null;
  client?: string | null;
  file_name?: string | null;
  estimate_ref?: string | null;
}

function same(a: string | null | undefined, b: string): boolean {
  return (a || "").trim().toLowerCase() === b.trim().toLowerCase();
}

export function resolveJobTarget<E extends JobEstimateRef, S extends JobScanRef>(
  param: string,
  scans: S[],
  estimates: E[],
): { estimate: E | null; scans: S[] } {
  const key = param.trim();
  const byRef = estimates.find(row => row.id === key || same(row.reference, key) || same(row.ref, key)) ?? null;
  const scanById = scans.find(scan => scan.id === key) ?? null;
  const estimate = byRef
    ?? (scanById?.estimate_ref
      ? estimates.find(row => same(row.reference, scanById.estimate_ref) || same(row.ref, scanById.estimate_ref)) ?? null
      : null);
  const ref = estimate?.reference || estimate?.ref || scanById?.estimate_ref || "";
  const matched = scans.filter(scan =>
    scan.id === key
    || (ref && same(scan.estimate_ref, ref))
    || same(scan.estimate_ref, key)
  );
  return { estimate, scans: matched.length ? matched : scanById ? [scanById] : [] };
}
