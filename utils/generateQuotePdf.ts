import { jsPDF } from "jspdf";
import { drawTenantLetterhead, drawTenantFooter } from "../components/PdfLetterhead";
import type { TenantConfig } from "../types/tenant";
import { resolveLogoDataUrl } from "./resolveLogoDataUrl";
import {
  groupQuoteItems,
  quoteFileName,
  type QuoteDocument,
} from "./quoteExport";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_GUARD = 72;

const money = (n: number) =>
  `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function tenantWithEmbeddableLogo(tenant: TenantConfig): Promise<TenantConfig> {
  const resolved = await resolveLogoDataUrl(tenant.logoUrl);
  return { ...tenant, logoUrl: resolved };
}

function ensureSpace(doc: jsPDF, tenant: TenantConfig, y: number, needed: number): number {
  if (y + needed <= PAGE_H - FOOTER_GUARD) return y;
  doc.addPage();
  return drawTenantLetterhead(doc, tenant);
}

export async function generateQuotePdf(
  quote: QuoteDocument,
): Promise<{ blob: Blob; filename: string }> {
  const tenant = await tenantWithEmbeddableLogo(quote.tenant);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = drawTenantLetterhead(doc, tenant);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text("Electrical Estimate", MARGIN, y);
  y += 8;

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, MARGIN + 160, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);

  const meta: [string, string][] = [
    ["Reference", quote.reference],
    ["Project", quote.projectName || "—"],
    ["Client", quote.clientName || "—"],
    ["Address", quote.address || "—"],
    ["Date", quote.date],
    ["Status", quote.status],
  ];
  if (quote.drawingFile) meta.push(["Drawing", quote.drawingFile]);

  for (const [label, value] of meta) {
    y = ensureSpace(doc, tenant, y, 14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const wrapped = doc.splitTextToSize(value, CONTENT_W - 90);
    doc.text(wrapped, MARGIN + 90, y);
    y += Math.max(14, wrapped.length * 12);
  }

  y += 8;
  y = ensureSpace(doc, tenant, y, 28);

  const colDesc = MARGIN;
  const colQty = MARGIN + 300;
  const colRate = MARGIN + 370;
  const colTotal = PAGE_W - MARGIN;

  const drawTableHeader = (at: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN, at, CONTENT_W, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("DESCRIPTION", colDesc + 6, at + 12);
    doc.text("QTY", colQty, at + 12, { align: "right" });
    doc.text("UNIT PRICE", colRate, at + 12, { align: "right" });
    doc.text("LINE TOTAL", colTotal, at + 12, { align: "right" });
    return at + 22;
  };

  y = drawTableHeader(y);

  const grouped = groupQuoteItems(quote.lineItems);
  const categories = Object.keys(grouped);

  if (categories.length === 0) {
    y = ensureSpace(doc, tenant, y, 20);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("No line items on this estimate.", MARGIN + 6, y);
    y += 18;
  }

  for (const cat of categories) {
    y = ensureSpace(doc, tenant, y, 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(59, 130, 246);
    doc.text(cat.toUpperCase(), MARGIN + 6, y);
    y += 12;

    for (const li of grouped[cat]) {
      const descLines = doc.splitTextToSize(li.description || "—", 250);
      const roomLines = li.room
        ? doc.splitTextToSize(`Location: ${li.room}`, 250)
        : [];
      const blockH = Math.max(16, descLines.length * 11 + roomLines.length * 10 + 4);
      const yBefore = y;
      y = ensureSpace(doc, tenant, y, blockH + 4);
      if (y < yBefore) y = drawTableHeader(y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(descLines, colDesc + 6, y);
      if (roomLines.length) {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(roomLines, colDesc + 6, y + descLines.length * 11);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      const qtyLabel = `${li.qty} ${li.unit || "EA"}`;
      doc.text(qtyLabel, colQty, y, { align: "right" });
      doc.text(money(li.unitPrice), colRate, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(money(li.qty * li.unitPrice), colTotal, y, { align: "right" });
      y += blockH;
    }
    y += 4;
  }

  y += 8;
  y = ensureSpace(doc, tenant, y, 110);

  const boxH =
    88 + (quote.totals.materialsCost && quote.totals.materialsCost > 0 ? 14 : 0);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 6, 6, "FD");

  const row = (label: string, value: string, offset: number, bold = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(color ?? [30, 30, 30]));
    doc.text(label, MARGIN + 14, y + offset);
    doc.text(value, PAGE_W - MARGIN - 14, y + offset, { align: "right" });
  };

  let off = 16;
  row("Subtotal (ex GST)", money(quote.totals.subtotal), off);
  off += 14;
  row(`Margin (${quote.marginPct}%)`, money(quote.totals.marginAmount), off);
  off += 14;
  if (quote.totals.materialsCost && quote.totals.materialsCost > 0) {
    row("Materials (cable/conduit)", money(quote.totals.materialsCost), off);
    off += 14;
  }
  row("Subtotal with margin", money(quote.totals.subtotalWithMargin), off);
  off += 14;
  row(`GST (${quote.gstRate}%)`, money(quote.totals.gst), off);
  off += 16;
  row("TOTAL INC GST", money(quote.totals.total), off, true, [16, 185, 129]);

  y += boxH + 20;
  y = ensureSpace(doc, tenant, y, 40);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const notes = doc.splitTextToSize(
    "This estimate is valid for 30 days from the date issued. Prices are in Australian Dollars (AUD). GST is shown separately. All work is subject to site inspection.",
    CONTENT_W,
  );
  doc.text(notes, MARGIN, y);

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    drawTenantFooter(doc, tenant);
  }

  const arrayBuffer = doc.output("arraybuffer");
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  return { blob, filename: quoteFileName(quote.reference, "pdf") };
}
