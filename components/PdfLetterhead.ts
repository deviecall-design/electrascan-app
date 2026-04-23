import type { jsPDF } from "jspdf";
import type { TenantConfig } from "../contexts/TenantContext";

const PAGE_W = 595; // A4 width in pt
const MARGIN = 40;

interface LetterheadOptions {
  footerNote?: string;
}

// Draws the tenant letterhead at the top of the current page. Returns the y
// coordinate where document content should start.
export function drawTenantLetterhead(
  doc: jsPDF,
  tenant: TenantConfig,
  _opts: LetterheadOptions = {},
): number {
  const logoBoxW = 72;
  const logoBoxH = 48;
  let y = MARGIN;

  if (tenant.logoUrl) {
    try {
      const fmt = tenant.logoUrl.startsWith("data:image/svg")
        ? "SVG"
        : tenant.logoUrl.startsWith("data:image/png")
          ? "PNG"
          : tenant.logoUrl.startsWith("data:image/jpeg") || tenant.logoUrl.startsWith("data:image/jpg")
            ? "JPEG"
            : "PNG";
      // SVG is not natively supported by jsPDF; fall back to skipping.
      if (fmt !== "SVG") {
        doc.addImage(tenant.logoUrl, fmt, MARGIN, y, logoBoxW, logoBoxH);
      }
    } catch {
      // ignore — a bad logo shouldn't block the export
    }
  }

  const textX = tenant.logoUrl ? MARGIN + logoBoxW + 14 : MARGIN;
  let textY = y + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(tenant.tradingName || "", textX, textY);
  textY += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  if (tenant.abn) {
    doc.text(`ABN: ${tenant.abn}`, textX, textY);
    textY += 11;
  }
  const contactParts = [tenant.address, tenant.contactPhone, tenant.contactEmail].filter(Boolean);
  if (contactParts.length) {
    const contactLine = contactParts.join("  ·  ");
    const wrapped = doc.splitTextToSize(contactLine, PAGE_W - textX - MARGIN);
    doc.text(wrapped, textX, textY);
    textY += wrapped.length * 11;
  }

  const ruleY = Math.max(y + logoBoxH + 6, textY + 4);
  doc.setDrawColor(210, 214, 220);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, ruleY, PAGE_W - MARGIN, ruleY);

  // Reset colour so body text styling is predictable
  doc.setTextColor(30, 30, 30);
  doc.setLineWidth(1);

  return ruleY + 18;
}

// Draws a company-branded footer with optional note (e.g. "Internal document").
// Safe to call once at the end of the current page.
export function drawTenantFooter(
  doc: jsPDF,
  tenant: TenantConfig,
  opts: { footerNote?: string } = {},
) {
  const pageHeight = (doc.internal.pageSize as { getHeight?: () => number }).getHeight
    ? (doc.internal.pageSize as unknown as { getHeight: () => number }).getHeight()
    : 842;
  const y = pageHeight - 36;

  doc.setDrawColor(210, 214, 220);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y - 14, PAGE_W - MARGIN, y - 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);

  const left = [tenant.tradingName, tenant.abn ? `ABN ${tenant.abn}` : ""].filter(Boolean).join("  ·  ");
  if (left) doc.text(left, MARGIN, y);

  const right = [tenant.contactPhone, tenant.contactEmail].filter(Boolean).join("  ·  ");
  if (right) doc.text(right, PAGE_W - MARGIN, y, { align: "right" });

  if (opts.footerNote) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 90, 20);
    doc.text(opts.footerNote, PAGE_W / 2, y + 12, { align: "center" });
  }

  doc.setTextColor(30, 30, 30);
}
