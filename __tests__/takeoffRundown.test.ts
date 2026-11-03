import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES } from "../lib/assemblies";
import { takeoffRundown } from "../lib/takeoffRundown";
import type { StoredDetectedItem } from "../lib/scanRecord";

const base = {
  symbol: "EL",
  rateCode: "",
  conf: 0.8,
  x: 0,
  y: 0,
  status: "ai" as const,
};

function row(partial: Partial<StoredDetectedItem> & { id: number; desc: string; qty: number }): StoredDetectedItem {
  return { ...base, ...partial };
}

describe("takeoff rundown", () => {
  it("puts lines with no assembly, rate, or price in the gap list", () => {
    const rundown = takeoffRundown([
      row({ id: 1, desc: "Mystery fitting", qty: 2 }),
      row({ id: 2, desc: "Kitchen double GPO", symbol: "GPO", qty: 4, unitPrice: 120, rateCode: "GPO-D" }),
      row({ id: 3, desc: "Rejected blank", qty: 1, status: "rejected" }),
    ], [], DEFAULT_ASSEMBLIES);
    expect(rundown.scanned).toBe(2);
    expect(rundown.unpriced).toBe(1);
    expect(rundown.priced).toBe(1);
    expect(rundown.gaps.map(gap => gap.item.desc)).toEqual(["Mystery fitting"]);
    expect(rundown.total).toBe(480);
    expect(rundown.groups.find(group => group.category === "Power")?.rows[0].lineTotal).toBe(480);
  });

  it("prices a typed amount ahead of an assembly", () => {
    const rundown = takeoffRundown([
      row({ id: 1, desc: "Recessed downlight", symbol: "LT", qty: 1, unitPrice: 50, manualPrice: true }),
    ], [], DEFAULT_ASSEMBLIES);
    expect(rundown.unpriced).toBe(0);
    expect(rundown.total).toBe(50);
  });
});
