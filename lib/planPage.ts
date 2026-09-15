/**
 * Chrome for the Detect-step drawing pane.
 *
 * May 2026 production (fc11733) mounted App.tsx and labelled the scan with the
 * real filename. The desktop Detect step later hardcoded "Level 2 · Page 3/5"
 * on a fake OFFICE A SVG. Page labels must come from the uploaded file.
 */

export function planPageLabel(
  fileName: string | undefined,
  pageIndex: number,
  pageCount: number,
): string {
  const name = (fileName ?? "").trim() || "Source drawing";
  if (!Number.isFinite(pageCount) || pageCount <= 0) return name;
  const n = Math.min(Math.max(pageIndex, 0), pageCount - 1) + 1;
  return `${name} · Page ${n}/${pageCount}`;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
