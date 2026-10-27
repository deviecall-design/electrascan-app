import { describe, expect, it } from "vitest";
import { buildScanWrite, readDetectedItems, scanListStatus } from "../lib/scanRecord";

describe("scan records", () => {
  const items = [{
    id: 1, symbol: "GPO", qty: 4, desc: "Double GPO", rateCode: "GPO-D",
    conf: 0.72, x: 0, y: 0, unitPrice: 120,
  }];

  it("writes detected items onto the scan row", () => {
    const row = buildScanWrite({ fileName: "Level 1.pdf", stage: "review", items });
    expect(row.file_name).toBe("Level 1.pdf");
    expect(row.stage).toBe("review");
    expect(row.items_detected).toBe(1);
    expect(row.detected_items).toEqual(items);
    expect(readDetectedItems(row.detected_items)).toEqual(items);
  });

  it("ignores junk stored in detected_items", () => {
    expect(readDetectedItems(null)).toEqual([]);
    expect(readDetectedItems([{ qty: "nope" }, { qty: 2, desc: "Fan" }])).toHaveLength(1);
  });

  it("labels a low-confidence scan as needing review", () => {
    expect(scanListStatus({ stage: "review", detected_items: items })).toBe("Needs review");
    expect(scanListStatus({ stage: "complete", estimate_ref: "EST-2610-0001", detected_items: items })).toBe("Quoted");
  });
});
