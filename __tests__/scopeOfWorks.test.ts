import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES } from "../lib/assemblies";
import {
  COMPLIANCE_NOTE,
  generateScope,
  readScopeFromEstimate,
  scopeLineItem,
} from "../lib/scopeOfWorks";

describe("scope of works", () => {
  const items = [
    { desc: "Recessed downlight", qty: 4, room: "Kitchen", category: "Lighting", unitPrice: 85, conf: 0.92, status: "confirmed" },
    { desc: "Recessed downlight", qty: 2, room: "Kitchen", category: "Lighting", unitPrice: 85, conf: 0.9, status: "confirmed" },
    { desc: "Light sensor", qty: 1, room: "Hall", category: "Switching", conf: 0.42, status: "ai" },
    { desc: "Pendant tbc", qty: 1, room: "Hall", category: "Lighting", unitPrice: 0, status: "ai" },
  ];

  it("groups inclusions by room and keeps the Australian defaults", () => {
    const scope = generateScope({
      items,
      assemblies: DEFAULT_ASSEMBLIES,
      legend: [{ symbol: "DL", description: "Recessed downlight", quantity: 6, kind: "legend" }],
      schedules: [{ symbol: "DB", description: "Distribution board", quantity: 1, kind: "schedule" }],
    });
    const kitchen = scope.inclusions.find(section => section.heading === "Kitchen");
    expect(kitchen?.lines).toEqual(["6 × Recessed downlight"]);
    expect(scope.inclusions.some(section => section.heading === "Drawing legend")).toBe(true);
    expect(scope.inclusions.some(section => section.heading === "Schedules")).toBe(true);
    expect(scope.exclusions.some(line => /patching/i.test(line) && /painting/i.test(line))).toBe(true);
    expect(scope.exclusions.some(line => /NBN/i.test(line))).toBe(true);
    expect(scope.assumptions.length).toBeGreaterThan(0);
    expect(scope.compliance).toBe(COMPLIANCE_NOTE);
    expect(scope.compliance).toContain("AS/NZS 3000");
    expect(scope.clarifications.some(line => line.includes("Light sensor") && line.includes("42%"))).toBe(true);
    expect(scope.clarifications.some(line => line.includes("Pendant tbc") && /no price/i.test(line))).toBe(true);
    expect(scope.clarifications.some(line => /to be confirmed/i.test(line))).toBe(true);
  });

  it("round-trips through the estimate column and the line-item copy", () => {
    const scope = generateScope({ items: [items[0]], assemblies: DEFAULT_ASSEMBLIES });
    expect(readScopeFromEstimate({ scope_of_works: scope })?.compliance).toContain("AS/NZS 3000");
    const line = scopeLineItem(scope);
    expect(readScopeFromEstimate({ line_items: [line] })?.exclusions).toEqual(scope.exclusions);
  });
});
