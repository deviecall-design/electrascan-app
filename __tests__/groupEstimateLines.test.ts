import { describe, expect, it } from "vitest";
import { priceItem } from "../lib/quoteSource";
import { computeQuoteTotals } from "../lib/quoteTotals";
import {
  estimateSubtotal,
  groupEstimateLines,
  groupedMatchesUngrouped,
  scaleMemberQtys,
} from "../lib/groupEstimateLines";

describe("group estimate lines", () => {
  const sensors = [
    { description: "Light sensor", qty: 1, unitPrice: 55, category: "Lighting", code: "", room: "Hall" },
    { description: "Light sensor", qty: 1, unitPrice: 55, category: "Lighting", code: "", room: "Hall" },
    { description: "Light sensor", qty: 1, unitPrice: 55, category: "Lighting", code: "", room: "Hall" },
    { description: "Light sensor", qty: 1, unitPrice: 55, category: "Lighting", code: "", room: "Hall" },
    { description: "Light sensor", qty: 1, unitPrice: 80, category: "Lighting", code: "", room: "Hall" },
  ];

  it("merges identical lines and keeps a different price separate", () => {
    const grouped = groupEstimateLines(sensors);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ description: "Light sensor", qty: 4, unitPrice: 55 });
    expect(grouped[0].qty * grouped[0].unitPrice).toBe(220);
    expect(grouped[1]).toMatchObject({ qty: 1, unitPrice: 80 });
  });

  it("keeps the quote total the same after grouping", () => {
    const priced = sensors.map(line => {
      const quote = priceItem({
        desc: line.description,
        unitPrice: line.unitPrice,
        qty: line.qty,
        rateCode: line.code,
        category: line.category,
      });
      return { ...line, unitPrice: quote.sellUnit };
    });
    expect(groupedMatchesUngrouped(priced, 25)).toBe(true);
    const before = computeQuoteTotals(estimateSubtotal(priced), 25);
    const after = computeQuoteTotals(estimateSubtotal(groupEstimateLines(priced)), 25);
    expect(after).toEqual(before);
    expect(after.subtotal).toBe(before.subtotal);
    expect(after.total).toBe(before.total);
  });

  it("merges a flat estimate across rooms and keeps a room section split", () => {
    const flat = [
      { description: "Light sensor", qty: 1, unitPrice: 55, category: "Switching & dimming" },
      { description: "Light sensor", qty: 1, unitPrice: 55, category: "Switching & dimming" },
    ];
    expect(groupEstimateLines(flat)).toHaveLength(1);
    const sectioned = flat.map((line, index) => ({ ...line, room: index === 0 ? "Hallway" : "Laundry" }));
    expect(groupEstimateLines(sectioned)).toHaveLength(2);
  });

  it("keeps a different labour split on its own line and still matches the total", () => {
    const split = [
      { description: "Light sensor", qty: 1, unitPrice: 55, materialUnit: 40, labourUnit: 15 },
      { description: "Light sensor", qty: 1, unitPrice: 55, materialUnit: 30, labourUnit: 25 },
    ];
    expect(groupEstimateLines(split)).toHaveLength(2);
    const awkward = [
      { description: "Cable", qty: 1, unitPrice: 10.333 },
      { description: "Cable", qty: 1, unitPrice: 10.333 },
      { description: "Cable", qty: 1, unitPrice: 10.333 },
    ];
    const grouped = groupEstimateLines(awkward);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].lineAmount).toBe(estimateSubtotal(awkward));
    expect(computeQuoteTotals(estimateSubtotal(grouped), 25)).toEqual(computeQuoteTotals(estimateSubtotal(awkward), 25));
  });

  it("spreads a grouped quantity back across the detections", () => {
    expect(scaleMemberQtys([1, 1, 1, 1], 6)).toEqual([1, 1, 2, 2]);
    expect(scaleMemberQtys([1, 1, 1, 1], 4)).toEqual([1, 1, 1, 1]);
  });
});
