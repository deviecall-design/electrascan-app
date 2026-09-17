import { describe, it, expect } from "vitest";
import {
  buildPaletteItems,
  filterPaletteItems,
  STATIC_PALETTE_ITEMS,
} from "../lib/commandPalette";

describe("buildPaletteItems", () => {
  it("includes navigation and live scans/estimates only — no sample jobs", () => {
    const items = buildPaletteItems(
      [{ id: "s1", file_name: "Sirius_L2.pdf", client: "4 Sirius" }],
      [{ id: "e1", reference: "EST-2609-0001", client: "4 Sirius" }],
    );
    const labels = items.map(i => i.label);
    expect(labels).toContain("Upload plan");
    expect(labels).toContain("Scans");
    expect(labels).toContain("Sirius_L2.pdf");
    expect(labels).toContain("EST-2609-0001");
    expect(labels.join(" ").toLowerCase()).not.toContain("bondi");
  });
});

describe("filterPaletteItems", () => {
  const items = buildPaletteItems(
    [
      { id: "s1", file_name: "Sirius_L2.pdf", client: "Linda Habak" },
      { id: "s2", file_name: "Switchboard_LV2.pdf", client: "Vesh" },
    ],
    [{ id: "e1", reference: "EST-2609-0001", client: "4 Sirius" }],
  );

  it("returns actions and navigate when the query is empty, capped live rows", () => {
    const shown = filterPaletteItems(items, "");
    expect(shown.some(i => i.group === "Actions")).toBe(true);
    expect(shown.some(i => i.group === "Navigate")).toBe(true);
    expect(shown.find(i => i.label === "Sirius_L2.pdf")).toBeTruthy();
  });

  it("matches a plan filename", () => {
    const shown = filterPaletteItems(items, "sirius");
    expect(shown.map(i => i.label)).toContain("Sirius_L2.pdf");
    expect(shown.map(i => i.label)).not.toContain("Switchboard_LV2.pdf");
  });

  it("matches an estimate reference", () => {
    const shown = filterPaletteItems(items, "EST-2609");
    expect(shown.map(i => i.label)).toEqual(["EST-2609-0001"]);
  });

  it("matches upload-plan keywords", () => {
    const shown = filterPaletteItems(STATIC_PALETTE_ITEMS, "upload drawing");
    expect(shown.some(i => i.to === "/detection/new")).toBe(true);
  });

  it("returns nothing invented when there is no match", () => {
    const shown = filterPaletteItems(items, "bondi towers penthouse");
    expect(shown).toEqual([]);
  });
});
