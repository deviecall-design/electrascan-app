import { describe, expect, it } from "vitest";
import { diffTakeoffLines, pickVariationPair } from "../lib/variationDiff";

describe("variation diff", () => {
  it("reports added, removed, and quantity changes from real line items", () => {
    const changes = diffTakeoffLines(
      [
        { description: "LED downlight", qty: 10, unitPrice: 80 },
        { description: "Double GPO", qty: 4, unitPrice: 120 },
      ],
      [
        { description: "LED downlight", qty: 12, unitPrice: 80 },
        { description: "EV charger", qty: 1, unitPrice: 1500 },
      ],
    );
    expect(changes.map(line => line.change).sort()).toEqual(["added", "increased", "removed"]);
    const added = changes.find(line => line.change === "added");
    expect(added?.delta).toBe(1500);
  });

  it("does not invent a pair when fewer than two quotes have lines", () => {
    expect(pickVariationPair([{ client: "A", line_items: [] }])).toBeNull();
    const pair = pickVariationPair([
      { client: "A", created_at: "2026-10-01", line_items: [{ description: "GPO", qty: 1, unitPrice: 10 }], reference: "EST-1" },
      { client: "B", created_at: "2026-10-02", line_items: [{ description: "GPO", qty: 2, unitPrice: 10 }], reference: "EST-2" },
      { client: "B", created_at: "2026-10-20", line_items: [{ description: "GPO", qty: 3, unitPrice: 10 }], reference: "EST-3" },
    ]);
    expect(pair?.base.reference).toBe("EST-2");
    expect(pair?.next.reference).toBe("EST-3");
  });
});
