import { describe, it, expect } from "vitest";
import {
  parseLegendLabel,
  inferReviewKind,
  suggestReviewItem,
  inferAnalyzeType,
  mapComponentToReviewFields,
  getConfidenceMeta,
  getConfidenceState,
  shouldQueueForReview,
  formatDetectionLabel,
  symbolForDetection,
  displayRoom,
  groupSuggestionsByCategory,
} from "../lib/reviewClassification";

describe("parseLegendLabel", () => {
  it("splits a legend code from the title", () => {
    expect(parseLegendLabel("Edb: electrical distribution board")).toEqual({
      code: "EDB",
      title: "Electrical Distribution Board",
    });
  });

  it("strips the generic Electrical: prefix and trailing as-spec noise", () => {
    expect(parseLegendLabel("Electrical: data point as spec.")).toEqual({
      title: "Data Point",
    });
    expect(parseLegendLabel("Electrical: switch, type as noted.")).toEqual({
      title: "Switch",
    });
  });
});

describe("inferReviewKind — description wins over a wrong LT/downlight type", () => {
  it("does not classify an EDB as lighting just because Detect defaulted to DOWNLIGHT", () => {
    expect(
      inferReviewKind("Edb: electrical distribution board", "LT", "DOWNLIGHT_RECESSED"),
    ).toBe("switchboard");
    expect(symbolForDetection("Edb: electrical distribution board", "DOWNLIGHT_RECESSED", "LT")).toBe(
      "EDB",
    );
  });

  it("maps the Sirius-plan review rows to the right kind", () => {
    expect(inferReviewKind("Electrical: data point as spec.", "DC")).toBe("data");
    expect(inferReviewKind("Electrical: exhaust fan, as spec.", "FN")).toBe("ventilation");
    expect(inferReviewKind("Electrical: external lighting motion sensor", "EX")).toBe("sensor");
    expect(inferReviewKind("Electrical: smoke detector, type as noted.", "SA")).toBe("safety");
    expect(inferReviewKind("Electrical: switch, type as noted.", "SW")).toBe("switching");
  });

  it("keeps real lights as lighting", () => {
    expect(inferReviewKind("Recessed downlight", "LT", "DOWNLIGHT_RECESSED")).toBe("lighting");
  });
});

describe("suggestReviewItem", () => {
  it("does not default an EDB to Power (GPO) / downlight copy / $200", () => {
    const suggestion = suggestReviewItem({
      description: "Edb: electrical distribution board",
      symbol: "LT",
      detectedType: "DOWNLIGHT_RECESSED",
      qty: 1,
    });
    expect(suggestion.category).toBe("Switchboard");
    expect(suggestion.category).not.toBe("Power (GPO, switches)");
    expect(suggestion.placeholder).toBe("e.g. 12-way distribution board");
    expect(suggestion.placeholder).not.toContain("downlight");
    expect(suggestion.rate).toBe(1800);
    expect(suggestion.symbol).toBe("EDB");
    expect(suggestion.label).toBe("Electrical Distribution Board");
  });

  it("prefers a real unit price from detection over the kind default", () => {
    const suggestion = suggestReviewItem({
      description: "Electrical: data point as spec.",
      symbol: "DC",
      unitPrice: 360,
    });
    expect(suggestion.category).toBe("AV / Data");
    expect(suggestion.rate).toBe(360);
    expect(suggestion.placeholder).toMatch(/Cat6/i);
  });
});

describe("inferAnalyzeType", () => {
  it("returns SWITCHBOARD_MAIN for a distribution board before the downlight default", () => {
    expect(inferAnalyzeType("electrical distribution board")?.componentType).toBe(
      "SWITCHBOARD_MAIN",
    );
    expect(inferAnalyzeType("EDB: main switchboard")?.componentType).toBe("SWITCHBOARD_MAIN");
    expect(inferAnalyzeType("sub-board")?.componentType).toBe("SWITCHBOARD_SUB");
  });

  it("returns null for unknown text so Detect can keep its own fallback", () => {
    expect(inferAnalyzeType("miscellaneous builder note")).toBeNull();
  });
});

describe("confidence bands", () => {
  it("does not label 85% as Low Confidence", () => {
    const mid = getConfidenceMeta(0.85);
    expect(mid.band).toBe("medium");
    expect(mid.label).toBe("Medium confidence");
    expect(mid.label).not.toMatch(/low/i);
    expect(mid.needsReview).toBe(true);
    expect(mid.blocksLock).toBe(false);
    expect(shouldQueueForReview(0.85)).toBe(true);
  });

  it("treats 0–100 detector scores the same as 0–1", () => {
    expect(getConfidenceMeta(85).band).toBe("medium");
    expect(getConfidenceMeta(96).band).toBe("high");
  });

  it("uses honest labels at the other bands", () => {
    expect(getConfidenceMeta(0.96).label).toBe("High confidence");
    expect(getConfidenceMeta(0.65).label).toBe("Low confidence");
    expect(getConfidenceMeta(0.4).label).toBe("Unrecognised");
    expect(getConfidenceMeta(0).label).toBe("No score");
  });

  it("maps bands onto the existing lock-state names", () => {
    expect(getConfidenceState(0.96)).toBe("recognised");
    expect(getConfidenceState(0.85)).toBe("low_confidence");
    expect(getConfidenceState(0.4)).toBe("unrecognised");
    expect(getConfidenceState(0)).toBe("unclear");
  });
});

describe("mapComponentToReviewFields", () => {
  it("turns the Sirius EDB legend row into a switchboard, not a downlight", () => {
    const fields = mapComponentToReviewFields({
      type: "DOWNLIGHT_RECESSED",
      catalogue_item_name: "Edb: electrical distribution board",
      quantity: 1,
      confidence: 85,
      unit_price: 200,
      room: "General",
    });
    expect(fields.symbol).toBe("EDB");
    expect(fields.desc).toBe("Electrical Distribution Board");
    expect(fields.category).toBe("Switchboard");
    expect(fields.quoteCategory).toBe("Distribution board");
    expect(fields.suggestion.placeholder).not.toMatch(/downlight/i);
    expect(fields.suggestion.rate).toBe(1800);
  });

  it("classifies the other Sirius review rows Damien screenshotted", () => {
    const rows = [
      ["Electrical: data point as spec.", "DC", "AV / Data"],
      ["Electrical: exhaust fan, as spec.", "FN", "Ventilation"],
      ["Electrical: external lighting motion sensor", "EX", "Switching & sensors"],
      ["Electrical: smoke detector, type as noted.", "SA", "Safety (smoke, fire)"],
      ["Electrical: switch, type as noted.", "SW", "Switching & sensors"],
    ] as const;
    for (const [name, symbol, category] of rows) {
      const fields = mapComponentToReviewFields({
        catalogue_item_name: name,
        type: "DOWNLIGHT_RECESSED",
      });
      expect(fields.symbol, name).toBe(symbol);
      expect(fields.category, name).toBe(category);
      expect(fields.suggestion.placeholder, name).not.toMatch(/downlight/i);
    }
  });
});

describe("display helpers", () => {
  it("does not show the hardcoded Level 2 placeholder as a real room", () => {
    expect(displayRoom("Level 2")).toBe("Location not set");
    expect(displayRoom("Kitchen")).toBe("Kitchen");
    expect(displayRoom(undefined)).toBe("Location not set");
  });

  it("formats a clean detection label", () => {
    expect(formatDetectionLabel("Edb: electrical distribution board")).toBe(
      "Electrical Distribution Board",
    );
  });

  it("groups queue items by suggested category for bulk actions", () => {
    const groups = groupSuggestionsByCategory([
      { suggestion: suggestReviewItem({ description: "electrical distribution board" }) },
      { suggestion: suggestReviewItem({ description: "data point" }) },
      { suggestion: suggestReviewItem({ description: "Cat6 data point" }) },
    ]);
    expect(groups.map(g => g.category)).toEqual(["Switchboard", "AV / Data"]);
    expect(groups[1].items).toHaveLength(2);
  });
});
