import { describe, expect, it } from "vitest";
import {
  diffTakeoffLines,
  linesFromDetected,
  materialsExGst,
  pickVariationPair,
  reviewTakeoffIncGst,
  variationChain,
} from "../lib/variationDiff";

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

  it("prices a revised takeoff from the scan and ignores rejected hits", () => {
    const lines = linesFromDetected([
      { id: 1, symbol: "LT", qty: 3, desc: "Downlight", rateCode: "LT-1", conf: 0.9, x: 1, y: 1, unitPrice: 200, status: "confirmed" },
      { id: 2, symbol: "GPO", qty: 1, desc: "False GPO", rateCode: "", conf: 0.4, x: 1, y: 1, unitPrice: 80, status: "rejected" },
    ]);
    expect(materialsExGst(lines)).toBe(600);
    const revised = diffTakeoffLines(lines, [{ description: "Double GPO", qty: 2, unitPrice: 120 }]);
    expect(revised.find(line => line.change === "removed")?.description).toBe("Downlight");
    expect(revised.find(line => line.change === "added")?.delta).toBe(240);
  });

  it("splits added and removed lines into materials and labour", () => {
    const added = diffTakeoffLines(
      [{ description: "Downlight", qty: 2, unitPrice: 200, materialUnit: 200, labourUnit: 40 }],
      [
        { description: "Downlight", qty: 2, unitPrice: 200, materialUnit: 200, labourUnit: 40 },
        { description: "Double GPO", qty: 1, unitPrice: 120, materialUnit: 85, labourUnit: 45 },
      ],
    ).find(line => line.change === "added");
    expect(added?.materialDelta).toBe(85);
    expect(added?.labourDelta).toBe(45);
    expect(added?.delta).toBe(130);

    const removed = diffTakeoffLines(
      [{ description: "Downlight", qty: 2, unitPrice: 200, materialUnit: 200, labourUnit: 40 }],
      [],
    )[0];
    expect(removed.change).toBe("removed");
    expect(removed.materialDelta).toBe(-400);
    expect(removed.labourDelta).toBe(-80);
    expect(removed.delta).toBe(-480);
  });

  it("keeps successive plans for one job in order and drops rejected hits", () => {
    const chain = variationChain([
      {
        client: "Mark Arnesen",
        started_at: "2026-10-02T00:00:00.000Z",
        detected_items: [
          { id: 1, symbol: "GPO", qty: 1, desc: "Double GPO", rateCode: "GPO-D", conf: 1, x: 0, y: 0, unitPrice: 120, materialUnit: 85, labourUnit: 45 },
        ],
      },
      {
        client: "Other job",
        started_at: "2026-10-03T00:00:00.000Z",
        detected_items: [
          { id: 1, symbol: "LT", qty: 9, desc: "Other light", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 10 },
        ],
      },
      {
        client: "Mark Arnesen",
        started_at: "2026-10-01T00:00:00.000Z",
        detected_items: [
          { id: 1, symbol: "LT", qty: 2, desc: "Downlight", rateCode: "LT-1", conf: 1, x: 0, y: 0, unitPrice: 200, status: "confirmed" },
          { id: 2, symbol: "GPO", qty: 1, desc: "False GPO", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 80, status: "rejected" },
        ],
      },
    ], "mark arnesen");

    expect(chain).toHaveLength(2);
    expect(chain[0].changes).toEqual([]);
    expect(chain[0].lines.map(line => line.description)).toEqual(["Downlight"]);
    expect(chain[0].materials).toBe(400);
    expect(chain[1].changes.map(line => line.change).sort()).toEqual(["added", "removed"]);
    const gone = chain[1].changes.find(line => line.change === "removed");
    expect(gone?.description).toBe("Downlight");
    expect(gone?.materialDelta).toBe(-400);
    expect(chain[1].labour).toBe(45);
  });

  it("prices unquoted takeoffs for the dashboard without counting sent quotes as pending", () => {
    const value = reviewTakeoffIncGst([
      {
        estimate_ref: null,
        detected_items: [
          { id: 1, symbol: "LT", qty: 1, desc: "Downlight", rateCode: "LT-1", conf: 1, x: 0, y: 0, unitPrice: 100 },
          { id: 9, symbol: "FN", qty: 2, desc: "Exhaust fan", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 215 },
        ],
      },
      {
        estimate_ref: "EST-1",
        detected_items: [
          { id: 2, symbol: "GPO", qty: 4, desc: "GPO", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 500 },
        ],
      },
    ]);
    expect(value).toBe(126.5);
  });

  it("keeps a stored rate price when the library rate differs, and drops an AI guess", () => {
    const lines = linesFromDetected([
      { id: 1, symbol: "LT", qty: 2, desc: "Downlight", rateCode: "LT-1", conf: 1, x: 0, y: 0, unitPrice: 200 },
      { id: 2, symbol: "FN", qty: 1, desc: "Exhaust fan", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 215 },
    ], [{ code: "LT-1", description: "LED downlight", rate: 50 }]);
    expect(lines).toEqual([
      expect.objectContaining({ description: "Downlight", qty: 2, unitPrice: 200 }),
    ]);
    expect(materialsExGst(lines)).toBe(400);
  });

  it("leaves AI-guessed lines with no rate code out of materials", () => {
    const lines = linesFromDetected([
      { id: 1, symbol: "LT", qty: 2, desc: "Downlight", rateCode: "LT-1", conf: 1, x: 0, y: 0, unitPrice: 80 },
      { id: 2, symbol: "FN", qty: 4, desc: "Exhaust fan", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 215 },
      { id: 3, symbol: "EX", qty: 1, desc: "Heated towel rail", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 450, priceSource: "manual" },
    ]);
    expect(lines.map(line => line.description)).toEqual(["Downlight", "Heated towel rail"]);
    expect(materialsExGst(lines)).toBe(610);
  });
});
