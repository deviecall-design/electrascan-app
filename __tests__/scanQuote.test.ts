import { describe, it, expect, vi } from "vitest";
import { mapLegendItem } from "../vesh_catalogue";
import { categoryFor, capQuantitiesToLegend, sumCategory, formatQtyRate, quoteVisibleLines } from "../lib/scanQuote";

vi.mock("../services/supabaseClient", () => ({
  supabase: { from: () => ({}) },
}));

import { nextReference, currentReferencePrefix, isCanonicalEstimateRef } from "../services/estimateReferenceService";

describe("GPO catalogue matching", () => {
  it("prices a generic double power point at the standard $260 SKU, not Zetr $525", () => {
    const item = mapLegendItem("Double power point");
    expect(item).not.toBeNull();
    expect(item!.id).toBe("GPO_DOUBLE_STANDARD");
    expect(item!.price).toBe(260);
  });

  it("still prices an explicit Zetr 13 GPO at $525", () => {
    const item = mapLegendItem("Zetr 13 series double powerpoint");
    expect(item).not.toBeNull();
    expect(item!.id).toBe("GPO_DOUBLE_ZETR13_WHITE");
    expect(item!.price).toBe(525);
  });

  it("does not treat a cooktop as a GPO", () => {
    const item = mapLegendItem("20amp cooktop");
    expect(item).not.toBeNull();
    expect(item!.id).toBe("COOKTOP_20AMP");
    expect(categoryFor(item!.componentType)).toBe("Appliance circuits");
    expect(categoryFor(item!.componentType)).not.toBe("Power outlets");
  });

  it("does not roll heated towel rails into Power outlets", () => {
    expect(categoryFor("HEATED_TOWEL_RAIL")).toBe("Specialist & automation");
    expect(categoryFor("GPO_DOUBLE")).toBe("Power outlets");
  });
});

describe("Power outlets sanity", () => {
  it("does not produce a $70k power category from a handful of standard GPOs", () => {
    const items = [
      { category: "Power outlets", qty: 30, unitPrice: 260 },
      { category: "Lighting", qty: 40, unitPrice: 200 },
    ];
    expect(sumCategory(items, "Power outlets")).toBe(7800);
    expect(sumCategory(items, "Power outlets")).toBeLessThan(20000);
  });
});

describe("quote qty × rate visibility", () => {
  it("shows 6 × $260 rather than a lumped $70k category", () => {
    expect(formatQtyRate(6, 260)).toBe("6 × $260");
    const groups = quoteVisibleLines([
      { category: "Power outlets", desc: "Double GPO", qty: 6, unitPrice: 260 },
      { category: "Power outlets", desc: "Zetr 13 GPO", qty: 2, unitPrice: 525 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].total).toBe(6 * 260 + 2 * 525);
    expect(groups[0].lines[0].qty).toBe(6);
    expect(groups[0].total).toBeLessThan(20000);
  });
});

describe("capQuantitiesToLegend", () => {
  it("scales room rows back to the legend total when Pass 2 repeats the legend qty", () => {
    const rows = [
      { legendKey: "GPO_DOUBLE", quantity: 80, room: "A" },
      { legendKey: "GPO_DOUBLE", quantity: 80, room: "B" },
      { legendKey: "GPO_DOUBLE", quantity: 80, room: "C" },
    ];
    const capped = capQuantitiesToLegend(rows, { gpo_double: 80 });
    const sum = capped.reduce((s, r) => s + r.quantity, 0);
    expect(sum).toBeCloseTo(80, 5);
  });
});

describe("estimate references EST-YYMM-XXXX", () => {
  it("starts at 0001 when nothing exists", () => {
    expect(nextReference("EST-2609-", null)).toBe("EST-2609-0001");
  });

  it("increments the sequence without colliding", () => {
    expect(nextReference("EST-2609-", "EST-2609-0142")).toBe("EST-2609-0143");
  });

  it("does not follow the Bondi mock EST-2026-NNNN convention", () => {
    const prefix = currentReferencePrefix(new Date("2026-09-15T00:00:00Z"));
    expect(prefix).toBe("EST-2609-");
    expect(prefix).not.toContain("2026-014");
  });
});

describe("isCanonicalEstimateRef", () => {
  it("accepts EST-YYMM-XXXX", () => {
    expect(isCanonicalEstimateRef("EST-2609-0001")).toBe(true);
  });

  it("rejects the three live-walk formats that are not the allocator", () => {
    expect(isCanonicalEstimateRef("EST-2026-0142")).toBe(false);
    expect(isCanonicalEstimateRef("EST-2026-497-001")).toBe(false);
    expect(isCanonicalEstimateRef("EST-26-001-v3")).toBe(false);
  });
});
