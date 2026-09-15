import type { TenantConfig } from "../types/tenant";
import type { Project, ProjectEstimate } from "../contexts/ProjectContext";
import { estimateTotals } from "../contexts/ProjectContext";

export interface QuoteLineItem {
  description: string;
  category?: string;
  room?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
}

export interface QuoteTotals {
  subtotal: number;
  marginAmount: number;
  materialsCost?: number;
  subtotalWithMargin: number;
  gst: number;
  total: number;
}

export interface QuoteDocument {
  tenant: TenantConfig;
  reference: string;
  projectName: string;
  clientName?: string;
  address?: string;
  date: string;
  status: string;
  drawingFile?: string;
  marginPct: number;
  gstRate: number;
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
}

export function quoteFileName(reference: string, ext: "pdf" | "txt"): string {
  const safe = (reference || "estimate").replace(/[^a-zA-Z0-9-]/g, "-");
  return `${safe}.${ext}`;
}

export function quoteFromProjectEstimate(
  tenant: TenantConfig,
  project: Project,
  estimate: ProjectEstimate,
): QuoteDocument {
  const totals = estimateTotals(estimate);
  return {
    tenant,
    reference: estimate.reference || estimate.number,
    projectName: project.name,
    clientName: project.clientName,
    address: project.address,
    date: new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    status: estimate.locked ? "LOCKED / FINALISED" : "DRAFT — Subject to change",
    marginPct: estimate.margin,
    gstRate: estimate.gstRate,
    lineItems: estimate.lineItems.map(li => ({
      description: li.description,
      category: li.category,
      room: li.room,
      qty: li.qty,
      unit: li.unit || "EA",
      unitPrice: li.unitPrice,
    })),
    totals: {
      subtotal: totals.subtotal,
      marginAmount: totals.marginAmount,
      materialsCost: totals.materialsCost,
      subtotalWithMargin: totals.subtotalWithMargin,
      gst: totals.gst,
      total: totals.total,
    },
  };
}

export function groupQuoteItems(items: QuoteLineItem[]): Record<string, QuoteLineItem[]> {
  const grouped: Record<string, QuoteLineItem[]> = {};
  for (const li of items) {
    const cat = li.category?.trim() || "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(li);
  }
  return grouped;
}

export function buildQuoteText(doc: QuoteDocument): string {
  const line = (label: string, value: string, pad = 52) =>
    `${label.padEnd(pad)} ${value}`;
  const sep = "─".repeat(70);
  const grouped = groupQuoteItems(doc.lineItems);

  const itemLines: string[] = [];
  Object.entries(grouped).forEach(([cat, items]) => {
    itemLines.push(`\n${cat.toUpperCase()}`);
    itemLines.push("-".repeat(40));
    items.forEach(li => {
      const lTotal = li.qty * li.unitPrice;
      const unit = (li.unit || "EA").padStart(3);
      itemLines.push(
        `${li.description.substring(0, 38).padEnd(40)}` +
          `${String(li.qty).padStart(4)} ${unit}` +
          `  $${li.unitPrice.toFixed(2).padStart(9)}` +
          `  $${lTotal.toFixed(2).padStart(10)}`,
      );
      if (li.room) itemLines.push(`  Location: ${li.room}`);
    });
  });

  const { totals } = doc;
  const lines = [
    `${"-".repeat(70)}`,
    `ELECTRICAL ESTIMATE`,
    `${"-".repeat(70)}`,
    ``,
    `${doc.tenant.name}`,
    doc.tenant.address ? `${doc.tenant.address}` : "",
    doc.tenant.abn ? `ABN: ${doc.tenant.abn}` : "",
    doc.tenant.contactPhone ? `Phone: ${doc.tenant.contactPhone}` : "",
    doc.tenant.contactEmail ? `Email: ${doc.tenant.contactEmail}` : "",
    ``,
    sep,
    line("REFERENCE:", doc.reference),
    line("PROJECT:", doc.projectName || "—"),
    line("CLIENT:", doc.clientName || "—"),
    line("ADDRESS:", doc.address || "—"),
    line("DATE:", doc.date),
    line("STATUS:", doc.status),
    ...(doc.drawingFile ? [line("DRAWING:", doc.drawingFile)] : []),
    sep,
    ``,
    `DESCRIPTION                               QTY         UNIT PRICE    LINE TOTAL`,
    sep,
    ...itemLines,
    ``,
    sep,
    line("Subtotal (ex GST):", `$${totals.subtotal.toFixed(2)}`),
    line(`Margin (${doc.marginPct}%):`, `$${totals.marginAmount.toFixed(2)}`),
    ...(totals.materialsCost && totals.materialsCost > 0
      ? [line("Materials (cable/conduit):", `$${totals.materialsCost.toFixed(2)}`)]
      : []),
    line("Subtotal with margin:", `$${totals.subtotalWithMargin.toFixed(2)}`),
    line(`GST (${doc.gstRate}%):`, `$${totals.gst.toFixed(2)}`),
    sep,
    line("TOTAL INC GST:", `$${totals.total.toFixed(2)}`),
    sep,
    ``,
    `This estimate is valid for 30 days from the date issued.`,
    `Prices are in Australian Dollars (AUD) and are exclusive of GST`,
    `unless otherwise stated. All work subject to site inspection.`,
  ].filter(l => l !== null && l !== undefined);

  return lines.join("\n");
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
