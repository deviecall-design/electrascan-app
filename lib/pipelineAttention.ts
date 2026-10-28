import { readDetectedItems } from "./scanRecord";
import { formatQuotedValue } from "./estimateMoney";
import { linesFromDetected, materialsExGst } from "./variationDiff";

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
    if (!scan.id) continue;
    const name = scan.file_name || scan.client || "Scan";
    const lines = linesFromDetected(scan.detected_items);
    const unquoted = !("estimate_ref" in scan) || !(scan as { estimate_ref?: string | null }).estimate_ref;
    if (unquoted && lines.length > 0) {
      items.push({
        id: `review-${scan.id}`,
        text: `${name}: ${lines.length} items, ${formatQuotedValue(materialsExGst(lines))} materials, quote not sent`,
        to: `/detection/${scan.id}`,
        tone: "warning",
      });
    }
    const low = readDetectedItems(scan.detected_items).filter(item => item.conf > 0 && item.conf < 0.85).length;
    if (low > 0) {
      items.push({
        id: `scan-${scan.id}`,
        text: `${name}: ${low} low-confidence mark${low === 1 ? "" : "s"}`,
        to: `/detection/${scan.id}`,
        tone: "warning",
      });
    }
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
