/**
 * Branded PDF export for ElectraScan estimates and variation reports.
 *
 * White-label: every PDF renders the tenant's CompanyProfile (logo, ABN,
 * contact, licence). When a CompanyProfile has no `logoUrl`, the bundled
 * placeholder SVG is used instead.
 *
 * Uses jsPDF (already in package.json). No SVG-to-PDF plugin required —
 * logos are rasterised to PNG via an offscreen <canvas> at export time.
 *
 * NOTE: a separate utility `utils/pdfExport.ts` handles PDF *markup* export
 * from the takeoff canvas (uses pdf-lib). This file is unrelated to that.
 */

import jsPDF from "jspdf";
import { CompanyProfile } from "../services/companyProfile";

// ─── Types ──────────────────────────────────────────────────────────────
export interface EstimateLineItem {
  description: string;
  room?: string;
  qty: number;
  unitPrice: number;
}

export interface EstimatePDFInput {
  company: CompanyProfile;
  estimateNumber: string;          // "EST-2026-497-001"
  date: string;                    // "16/04/2026"
  drawingFile?: string;            // "Mark Arnesen Quoted Plans 6.03.2026.pdf"
  projectName: string;             // "Mark Arnesen"
  projectAddress?: string;         // "8/110 North Steyne, Manly"
  clientName?: string;             // "Linda Habak Design"
  items: EstimateLineItem[];
  marginPercent: number;           // 15
}

export interface VariationPDFInput {
  company: CompanyProfile;
  variationNumber: string;         // "EST-2026-497-002" (the incremented id)
  baseEstimateNumber: string;      // "EST-2026-497-001"
  date: string;
  projectName: string;
  projectAddress?: string;
  clientName?: string;
  baseTotal: number;               // subtotal ex GST of the base estimate
  variationItems: {
    description: string;
    prevQty: number;
    newQty: number;
    unitPrice: number;
    change: "added" | "removed" | "increased" | "decreased";
  }[];
  risks?: { level: "high" | "medium" | "info"; title: string; description: string }[];
}

// ─── Layout constants ───────────────────────────────────────────────────
const C = {
  navy: "#0F1E35",
  blue: "#1D6EFD",
  green: "#00C48C",
  amber: "#FFB020",
  red: "#FF4D4D",
  text: "#1E293B",
  muted: "#5C7A9E",
  border: "#CBD5E1",
  lightBg: "#F8FAFC",
};

const PAGE = {
  width: 210,    // A4 mm
  height: 297,
  marginX: 15,
  marginTop: 15,
  marginBottom: 20,
};

// ─── Helpers ────────────────────────────────────────────────────────────
const money = (n: number) =>
  `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Load an image URL and rasterise to a PNG data URL.
 * Handles SVG, PNG, JPG — anything the browser can draw to a canvas.
 * Returns null if the image fails to load (CORS, 404, etc.); caller
 * should fall back to a text-only header.
 */
async function imageUrlToDataUrl(url: string, targetW = 240, targetH = 80): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
          return;
        }
        const scale = Math.min(targetW / img.width, targetH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (targetW - w) / 2;
        const y = (targetH - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ─── Header block (branded) ─────────────────────────────────────────────
async function drawHeader(
  doc: jsPDF,
  company: CompanyProfile,
  documentTitle: string,
  documentNumber: string,
  date: string,
  drawingFile?: string
): Promise<number> {
  // Logo (top-left)
  const logoUrl = company.logoUrl ?? "/logo-placeholder.svg";
  const logoData = await imageUrlToDataUrl(logoUrl, 240, 80);
  if (logoData) {
    doc.addImage(logoData, "PNG", PAGE.marginX, PAGE.marginTop, 40, 13);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...hexToRgb(C.navy));
    doc.text(company.name, PAGE.marginX, PAGE.marginTop + 8);
  }

  // Company contact block (top-right, right-aligned)
  const rightEdge = PAGE.width - PAGE.marginX;
  let y = PAGE.marginTop + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...hexToRgb(C.navy));
  doc.text(company.name, rightEdge, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(C.muted));
  y += 4;
  doc.text(`ABN ${company.abn}  |  Licence ${company.licence}`, rightEdge, y, { align: "right" });
  y += 3.5;
  doc.text(company.address, rightEdge, y, { align: "right" });
  y += 3.5;
  doc.text(`${company.phone}  |  ${company.email}`, rightEdge, y, { align: "right" });

  // Divider
  const dividerY = PAGE.marginTop + 22;
  doc.setDrawColor(...hexToRgb(C.border));
  doc.setLineWidth(0.2);
  doc.line(PAGE.marginX, dividerY, rightEdge, dividerY);

  // Document title + number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...hexToRgb(C.navy));
  doc.text(documentTitle, PAGE.marginX, dividerY + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...hexToRgb(company.accentColor ?? C.blue));
  doc.text(documentNumber, rightEdge, dividerY + 10, { align: "right" });

  // Date + drawing reference (sub-line)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(C.muted));
  const subLineParts = [`Date: ${date}`];
  if (drawingFile) subLineParts.push(`Drawing: ${drawingFile}`);
  doc.text(subLineParts.join("    "), PAGE.marginX, dividerY + 16);

  return dividerY + 22; // Y position where body content should start
}

// ─── Project/client block ───────────────────────────────────────────────
function drawProjectBlock(
  doc: jsPDF,
  startY: number,
  projectName: string,
  projectAddress?: string,
  clientName?: string
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text("PROJECT", PAGE.marginX, startY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...hexToRgb(C.text));
  doc.text(projectName, PAGE.marginX, startY + 5);

  let y = startY + 5;
  if (projectAddress) {
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(C.muted));
    doc.text(projectAddress, PAGE.marginX, y);
  }
  if (clientName) {
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(C.muted));
    doc.text(`Client: ${clientName}`, PAGE.marginX, y);
  }
  return y + 6;
}

// ─── Line items table (estimate) ────────────────────────────────────────
function drawEstimateTable(doc: jsPDF, startY: number, items: EstimateLineItem[]): number {
  const rightEdge = PAGE.width - PAGE.marginX;
  const colX = {
    item: PAGE.marginX + 2,
    qty: 130,
    rate: 155,
    total: rightEdge - 2,
  };

  // Header
  doc.setFillColor(...hexToRgb(C.lightBg));
  doc.rect(PAGE.marginX, startY, rightEdge - PAGE.marginX, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text("ITEM", colX.item, startY + 5.5);
  doc.text("QTY", colX.qty, startY + 5.5, { align: "right" });
  doc.text("RATE", colX.rate, startY + 5.5, { align: "right" });
  doc.text("TOTAL", colX.total, startY + 5.5, { align: "right" });

  let y = startY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  items.forEach((it, idx) => {
    // Page break
    if (y > PAGE.height - PAGE.marginBottom - 60) {
      doc.addPage();
      y = PAGE.marginTop;
    }
    const rowH = 7;
    if (idx % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(PAGE.marginX, y, rightEdge - PAGE.marginX, rowH, "F");
    }
    const lineTotal = it.qty * it.unitPrice;
    doc.setTextColor(...hexToRgb(C.text));
    doc.text(it.description, colX.item, y + 5);
    doc.text(String(it.qty), colX.qty, y + 5, { align: "right" });
    doc.text(money(it.unitPrice), colX.rate, y + 5, { align: "right" });
    doc.text(money(lineTotal), colX.total, y + 5, { align: "right" });
    y += rowH;
  });

  doc.setDrawColor(...hexToRgb(C.border));
  doc.setLineWidth(0.2);
  doc.line(PAGE.marginX, y, rightEdge, y);
  return y + 3;
}

// ─── Totals block (estimate) ────────────────────────────────────────────
function drawTotals(
  doc: jsPDF,
  startY: number,
  subtotal: number,
  marginPercent: number
): number {
  const rightEdge = PAGE.width - PAGE.marginX;
  const labelX = 120;
  const valueX = rightEdge - 2;

  const marginAmt = subtotal * (marginPercent / 100);
  const subM = subtotal + marginAmt;
  const gst = subM * 0.1;
  const total = subM + gst;

  const rows: [string, string, string][] = [
    ["Subtotal ex GST", money(subtotal), C.text],
    [`Margin (${marginPercent}%)`, `+ ${money(marginAmt)}`, C.amber],
    ["Subtotal with margin", money(subM), C.text],
    ["GST (10%)", money(gst), C.muted],
  ];

  let y = startY + 4;
  rows.forEach(([label, value, color]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(C.muted));
    doc.text(label, labelX, y, { align: "left" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRgb(color));
    doc.text(value, valueX, y, { align: "right" });
    y += 5;
  });

  y += 2;
  doc.setDrawColor(...hexToRgb(C.border));
  doc.line(labelX, y, rightEdge, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...hexToRgb(C.text));
  doc.text("TOTAL INC GST", labelX, y);
  doc.setFontSize(14);
  doc.setTextColor(...hexToRgb(C.green));
  doc.text(money(total), valueX, y, { align: "right" });
  return y + 8;
}

// ─── Footer (terms + licence) ───────────────────────────────────────────
function drawFooter(doc: jsPDF, company: CompanyProfile) {
  const y = PAGE.height - PAGE.marginBottom;
  doc.setDrawColor(...hexToRgb(C.border));
  doc.setLineWidth(0.2);
  doc.line(PAGE.marginX, y - 12, PAGE.width - PAGE.marginX, y - 12);

  if (company.termsText) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(C.muted));
    const wrapped = doc.splitTextToSize(company.termsText, PAGE.width - PAGE.marginX * 2);
    doc.text(wrapped, PAGE.marginX, y - 9);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text(
    `${company.name}  |  ABN ${company.abn}  |  Licence ${company.licence}`,
    PAGE.width / 2,
    y - 2,
    { align: "center" }
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

export async function generateEstimatePDF(input: EstimatePDFInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const bodyStartY = await drawHeader(
    doc,
    input.company,
    "ELECTRICAL ESTIMATE",
    input.estimateNumber,
    input.date,
    input.drawingFile
  );
  const afterProjectY = drawProjectBlock(
    doc,
    bodyStartY,
    input.projectName,
    input.projectAddress,
    input.clientName
  );
  const afterTableY = drawEstimateTable(doc, afterProjectY, input.items);

  const subtotal = input.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  drawTotals(doc, afterTableY, subtotal, input.marginPercent);

  drawFooter(doc, input.company);

  return doc.output("blob");
}

/** Triggers a browser download of the estimate PDF. */
export async function downloadEstimatePDF(input: EstimatePDFInput): Promise<void> {
  const blob = await generateEstimatePDF(input);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${input.estimateNumber}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function generateVariationPDF(input: VariationPDFInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const bodyStartY = await drawHeader(
    doc,
    input.company,
    "VARIATION REPORT",
    input.variationNumber,
    input.date
  );

  // Sub-line: base estimate being revised
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text(`Variation from base estimate ${input.baseEstimateNumber}`, PAGE.marginX, bodyStartY);

  const afterProjectY = drawProjectBlock(
    doc,
    bodyStartY + 6,
    input.projectName,
    input.projectAddress,
    input.clientName
  );

  // ── Variation table ──
  const rightEdge = PAGE.width - PAGE.marginX;
  const colX = {
    item: PAGE.marginX + 2,
    prev: 110,
    next: 130,
    rate: 155,
    impact: rightEdge - 2,
  };

  let y = afterProjectY;
  doc.setFillColor(...hexToRgb(C.lightBg));
  doc.rect(PAGE.marginX, y, rightEdge - PAGE.marginX, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text("ITEM", colX.item, y + 5.5);
  doc.text("PREV", colX.prev, y + 5.5, { align: "right" });
  doc.text("NEW", colX.next, y + 5.5, { align: "right" });
  doc.text("RATE", colX.rate, y + 5.5, { align: "right" });
  doc.text("IMPACT", colX.impact, y + 5.5, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let totalDelta = 0;

  input.variationItems.forEach((it, idx) => {
    if (y > PAGE.height - PAGE.marginBottom - 60) {
      doc.addPage();
      y = PAGE.marginTop;
    }
    const rowH = 7;
    if (idx % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(PAGE.marginX, y, rightEdge - PAGE.marginX, rowH, "F");
    }
    const delta = (it.newQty - it.prevQty) * it.unitPrice;
    totalDelta += delta;

    const tag =
      it.change === "added" ? "+ " :
      it.change === "removed" ? "- " :
      it.change === "increased" ? "^ " :
      "v ";

    doc.setTextColor(...hexToRgb(C.text));
    doc.text(tag + it.description, colX.item, y + 5);
    doc.text(String(it.prevQty || "-"), colX.prev, y + 5, { align: "right" });
    doc.text(String(it.newQty || "-"), colX.next, y + 5, { align: "right" });
    doc.text(money(it.unitPrice), colX.rate, y + 5, { align: "right" });

    const impactColor = delta > 0 ? C.red : delta < 0 ? C.green : C.muted;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRgb(impactColor));
    doc.text(
      (delta >= 0 ? "+" : "-") + money(Math.abs(delta)),
      colX.impact,
      y + 5,
      { align: "right" }
    );
    doc.setFont("helvetica", "normal");
    y += rowH;
  });

  doc.setDrawColor(...hexToRgb(C.border));
  doc.setLineWidth(0.2);
  doc.line(PAGE.marginX, y, rightEdge, y);
  y += 4;

  // ── Totals block (variation) ──
  const newTotal = input.baseTotal + totalDelta;
  const pct = input.baseTotal > 0 ? (totalDelta / input.baseTotal) * 100 : 0;
  const labelX = 120;
  const valueX = rightEdge - 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text(`Base total (${input.baseEstimateNumber}) ex GST`, labelX, y + 4, { align: "left" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRgb(C.text));
  doc.text(money(input.baseTotal), valueX, y + 4, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hexToRgb(C.muted));
  doc.text(`Variation (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`, labelX, y + 4, { align: "left" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRgb(totalDelta >= 0 ? C.red : C.green));
  doc.text(
    (totalDelta >= 0 ? "+" : "-") + money(Math.abs(totalDelta)),
    valueX,
    y + 4,
    { align: "right" }
  );
  y += 5;

  y += 2;
  doc.setDrawColor(...hexToRgb(C.border));
  doc.line(labelX, y, rightEdge, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...hexToRgb(C.text));
  doc.text("NEW TOTAL EX GST", labelX, y);
  doc.setFontSize(14);
  doc.setTextColor(...hexToRgb(C.green));
  doc.text(money(newTotal), valueX, y, { align: "right" });
  y += 10;

  // ── Risks ──
  if (input.risks && input.risks.length > 0) {
    if (y > PAGE.height - PAGE.marginBottom - 40) {
      doc.addPage();
      y = PAGE.marginTop;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...hexToRgb(C.muted));
    doc.text("RISK FLAGS", PAGE.marginX, y);
    y += 5;

    input.risks.forEach((r) => {
      const riskColor = r.level === "high" ? C.red : r.level === "medium" ? C.amber : C.blue;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...hexToRgb(riskColor));
      doc.text(`[${r.level.toUpperCase()}] ${r.title}`, PAGE.marginX, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...hexToRgb(C.muted));
      const wrapped = doc.splitTextToSize(r.description, PAGE.width - PAGE.marginX * 2);
      doc.text(wrapped, PAGE.marginX, y);
      y += wrapped.length * 3.5 + 3;
    });
  }

  drawFooter(doc, input.company);
  return doc.output("blob");
}

/** Triggers a browser download of the variation report PDF. */
export async function downloadVariationPDF(input: VariationPDFInput): Promise<void> {
  const blob = await generateVariationPDF(input);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Variation_${input.variationNumber}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
