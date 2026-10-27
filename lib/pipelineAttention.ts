import { readDetectedItems } from "./scanRecord";

export interface AttentionItem {
  id: string;
  text: string;
  to: string;
  tone: "warning" | "info";
}

export function attentionFromPipeline(
  scans: Array<{ id?: string; file_name?: string; detected_items?: unknown; client?: string | null }>,
  estimates: Array<{ id?: string; reference?: string | null; ref?: string | null; status?: string | null; client?: string | null }>,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const scan of scans) {
    const low = readDetectedItems(scan.detected_items).filter(item => item.conf > 0 && item.conf < 0.85).length;
    if (low === 0 || !scan.id) continue;
    const name = scan.file_name || scan.client || "Scan";
    items.push({
      id: `scan-${scan.id}`,
      text: `${name}: ${low} low-confidence mark${low === 1 ? "" : "s"}`,
      to: `/detection/${scan.id}`,
      tone: "warning",
    });
  }

  for (const estimate of estimates) {
    if (estimate.status !== "viewed") continue;
    const ref = estimate.reference || estimate.ref || "Estimate";
    items.push({
      id: `est-${estimate.id || ref}`,
      text: `${ref} was viewed by the client`,
      to: "/estimate",
      tone: "info",
    });
  }

  return items.slice(0, 6);
}
