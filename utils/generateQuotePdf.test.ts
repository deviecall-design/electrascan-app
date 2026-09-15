import { describe, expect, it } from "vitest";
import { VESH_ELECTRICAL_CONFIG } from "../types/tenant";
import { generateQuotePdf } from "./generateQuotePdf";
import type { QuoteDocument } from "./quoteExport";

const quote: QuoteDocument = {
  tenant: {
    ...VESH_ELECTRICAL_CONFIG,
    logoUrl: null,
    name: "Vesh Electrical",
    abn: "12 345 678 901",
    address: "7/108 Old Pittwater Road, Brookvale NSW 2100",
    contactPhone: "02 9905 0000",
    contactEmail: "admin@veshelectrical.com.au",
  },
  reference: "EST-2604-0007",
  projectName: "Bondi Tower Residences",
  clientName: "Allen Build",
  address: "12 Hall St, Bondi NSW",
  date: "15 April 2026",
  status: "DRAFT — Subject to change",
  marginPct: 15,
  gstRate: 10,
  lineItems: [
    { description: "Double GPO", category: "Power", qty: 8, unit: "EA", unitPrice: 85 },
  ],
  totals: {
    subtotal: 680,
    marginAmount: 102,
    subtotalWithMargin: 782,
    gst: 78.2,
    total: 860.2,
  },
};

describe("generateQuotePdf", () => {
  it("returns a real PDF blob with a branded filename", async () => {
    const { blob, filename } = await generateQuotePdf(quote);
    expect(filename).toBe("EST-2604-0007.pdf");
    expect(blob.size).toBeGreaterThan(500);
    const header = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer;
        resolve(new TextDecoder().decode(new Uint8Array(buf).slice(0, 5)));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    expect(header).toBe("%PDF-");
  });
});
