import { describe, it, expect } from "vitest";
import { applyReviewResolutions, type ReviewableLine } from "../lib/reviewedLines";
import { computeQuoteTotals } from "../lib/quoteTotals";

const RAW: ReviewableLine[] = [
  {
    id: 1,
    symbol: "GPO",
    qty: 2,
    desc: "Double power outlet",
    rateCode: "",
    conf: 0.96,
    x: 0,
    y: 0,
    unitPrice: 260,
    category: "Power outlets",
  },
  {
    id: 2,
    symbol: "DC",
    qty: 1,
    desc: "Electrical: data point as spec.",
    rateCode: "",
    conf: 0.8,
    x: 0,
    y: 0,
    unitPrice: 999,
    category: "Data & comms",
  },
  {
    id: 3,
    symbol: "LT",
    qty: 1,
    desc: "Edb: electrical distribution board",
    rateCode: "",
    conf: 0.4,
    x: 0,
    y: 0,
    unitPrice: 0,
    category: "Lighting",
  },
];

function subtotal(lines: ReviewableLine[]): number {
  return lines
    .filter(line => !("excluded" in line) || !(line as { excluded?: boolean }).excluded)
    .reduce((sum, line) => sum + line.qty * (line.unitPrice ?? 0), 0);
}

describe("applyReviewResolutions", () => {
  it("changes the quote subtotal when a $0 line is classified and a priced line is not in scope", () => {
    const rawSubtotal = subtotal(RAW);
    expect(rawSubtotal).toBe(1519);

    const reviewed = applyReviewResolutions(RAW, [
      {
        id: 3,
        action: "classify",
        classifyData: {
          category: "Switchboard",
          description: "Electrical Distribution Board",
          qty: 1,
          rate: 1800,
          symbol: "EDB",
        },
      },
      { id: 2, action: "not_in_scope" },
    ]);

    const kept = reviewed.filter(line => !line.excluded);
    const reviewedSubtotal = kept.reduce((sum, line) => sum + line.qty * (line.unitPrice ?? 0), 0);

    expect(reviewed.find(line => line.id === 2)?.excluded).toBe(true);
    expect(reviewed.find(line => line.id === 3)).toMatchObject({
      desc: "Electrical Distribution Board",
      symbol: "EDB",
      qty: 1,
      unitPrice: 1800,
      excluded: false,
    });
    expect(reviewedSubtotal).toBe(2320);
    expect(reviewedSubtotal).not.toBe(rawSubtotal);
    expect(computeQuoteTotals(reviewedSubtotal, 15).total).not.toBe(
      computeQuoteTotals(rawSubtotal, 15).total,
    );
  });

  it("keeps a flagged line at the detected price", () => {
    const reviewed = applyReviewResolutions(RAW, [{ id: 1, action: "flag_site" }]);
    expect(reviewed.find(line => line.id === 1)).toMatchObject({
      unitPrice: 260,
      qty: 2,
      excluded: false,
      flagged: true,
    });
  });
});
