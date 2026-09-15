import { describe, expect, it } from "vitest";
import { VESH_ELECTRICAL_CONFIG } from "../types/tenant";
import { buildQuoteText, groupQuoteItems, quoteFileName, type QuoteDocument } from "./quoteExport";

const quote: QuoteDocument = {
  tenant: VESH_ELECTRICAL_CONFIG,
  reference: "EST-2604-0007",
  projectName: "Bondi Tower",
  clientName: "Allen Build",
  address: "12 Hall St, Bondi NSW",
  date: "15 April 2026",
  status: "DRAFT — Subject to change",
  marginPct: 15,
  gstRate: 10,
  lineItems: [
    { description: "Double GPO", category: "Power", room: "Kitchen", qty: 4, unit: "EA", unitPrice: 85 },
    { description: "Downlight", category: "Lighting", qty: 12, unit: "EA", unitPrice: 45 },
  ],
  totals: {
    subtotal: 880,
    marginAmount: 132,
    subtotalWithMargin: 1012,
    gst: 101.2,
    total: 1113.2,
  },
};

describe("quoteExport", () => {
  it("groups line items by category", () => {
    const grouped = groupQuoteItems(quote.lineItems);
    expect(Object.keys(grouped)).toEqual(["Power", "Lighting"]);
    expect(grouped.Power).toHaveLength(1);
  });

  it("prints tenant letterhead fields in the text export", () => {
    const text = buildQuoteText(quote);
    expect(text).toContain("Vesh Electrical");
    expect(text).toContain("ABN: 00 000 000 000");
    expect(text).toContain("EST-2604-0007");
    expect(text).toContain("Bondi Tower");
    expect(text).toContain("TOTAL INC GST");
  });

  it("builds a safe filename", () => {
    expect(quoteFileName("EST-2604-0007", "pdf")).toBe("EST-2604-0007.pdf");
    expect(quoteFileName("weird name.pdf", "txt")).toBe("weird-name-pdf.txt");
  });
});
