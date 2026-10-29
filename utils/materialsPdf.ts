import jsPDF from "jspdf";
import type { MaterialsDraft } from "../lib/materialsRequest";

/** Supplier materials list. Quantities and brands only — no prices. */
export function downloadMaterialsPdf(draft: MaterialsDraft) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 16;
  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Materials request", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const details = [
    `Supplier: ${draft.supplierName || "Supplier"}`,
    `Job: ${draft.jobName || "—"}`,
    `Site address: ${draft.siteAddress || "—"}`,
    `Required by: ${draft.requiredBy || "—"}`,
    `Status: ${draft.status}`,
  ];
  details.forEach(line => {
    doc.text(line, left, y);
    y += 6;
  });
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Product", left, y);
  doc.text("Qty", 120, y);
  doc.text("Brand", 140, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  draft.lines.forEach(line => {
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    doc.text(line.product.slice(0, 60), left, y);
    doc.text(`${line.qty} ${line.unit}`, 120, y);
    doc.text((line.brand || "—").slice(0, 24), 140, y);
    y += 6;
    if (line.notes) {
      doc.setFontSize(9);
      doc.text(line.notes.slice(0, 90), left + 2, y);
      doc.setFontSize(11);
      y += 5;
    }
  });
  if (draft.notes.trim()) {
    y += 4;
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(`Notes: ${draft.notes.trim()}`, 180), left, y);
  }
  y += 16;
  doc.setFontSize(9);
  doc.text("Price this list on the contractor's trade terms. This file does not include supplier pricing.", left, Math.min(y, 285));
  const safe = (draft.jobName || "materials").replace(/[^\w.-]+/g, "-").slice(0, 40);
  doc.save(`materials-${safe}.pdf`);
}
