import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES } from "../lib/assemblies";
import { labourCost, labourNote, parseLabourCsv, sumLabourByRole } from "../lib/labourRates";
import { priceItem } from "../lib/quoteSource";

const exampleCard = [
  { id: "trades", name: "Lead Trades", rate: 180, overtimeMultiplier: 1.5, isDefault: true },
  { id: "foreman", name: "Lead Foreman", rate: 220, overtimeMultiplier: 1.5, isDefault: false },
];

describe("labour rate card", () => {
  it("keeps the single electrician rate when no card is saved", () => {
    const downlight = { desc: "Recessed downlight", symbol: "LT", qty: 1, unitPrice: 200, rateCode: "" };
    const before = priceItem(downlight, [], DEFAULT_ASSEMBLIES, 110, [
      { code: "DL-90", description: "Recessed downlight", unit: "ea", cost: 18, assemblyId: "downlight" },
    ]);
    const after = priceItem(downlight, [], DEFAULT_ASSEMBLIES, 110, [
      { code: "DL-90", description: "Recessed downlight", unit: "ea", cost: 18, assemblyId: "downlight" },
    ], null);
    expect(after).toEqual(before);
    expect(after.labourUnit).toBe(38.5);
    expect(after.sellUnit).toBe(56.5);
  });

  it("prices a crew mix by role and leaves an assembly sell price unchanged", () => {
    const [downlight] = DEFAULT_ASSEMBLIES.filter(row => row.id === "downlight");
    const mixed = {
      ...downlight,
      labourMix: [
        { roleId: "trades", hours: 0.2 },
        { roleId: "foreman", hours: 0.15, overtime: true },
      ],
    };
    const cost = labourCost({ hours: mixed.labourHours, mix: mixed.labourMix, card: exampleCard, fallbackRate: 110 });
    expect(cost.lines.map(line => line.amount)).toEqual([36, 49.5]);
    expect(labourNote(cost.lines)).toContain("Lead Trades");
    expect(labourNote(cost.lines)).toContain("× 1.5");
    const priced = priceItem(
      { desc: "Recessed downlight", symbol: "LT", qty: 2 },
      [],
      [mixed],
      110,
      [],
      exampleCard,
    );
    expect(priced.sellUnit).toBe(85);
    expect(priced.labourUnit).toBe(85);
    expect(priced.materialUnit).toBe(0);
    const totals = sumLabourByRole(priced.labourLines);
    expect(totals).toHaveLength(2);
  });

  it("reads a rate-card CSV without treating the rows as saved data", () => {
    const parsed = parseLabourCsv("Role,Rate,Overtime,Default\nLead Trades,180,1.5,yes\nLead Foreman,220,,\n");
    expect(parsed.error).toBeNull();
    expect(parsed.roles.map(role => role.name)).toEqual(["Lead Trades", "Lead Foreman"]);
    expect(parsed.roles[0].isDefault).toBe(true);
    expect(parsed.roles[1].rate).toBe(220);
  });
});
