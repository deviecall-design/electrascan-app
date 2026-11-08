import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES } from "../lib/assemblies";
import { exGst, incGst, isHourlyCharge, labourCost, labourNote, parseLabourCsv, sumLabourByRole } from "../lib/labourRates";
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
    expect(parsed.roles[0].chargeType).toBe("hourly");
    expect(parsed.roles[1].rate).toBe(220);
  });

  it("stores an inc-GST rate ex GST and prices a fixed charge once", () => {
    expect(exGst(154)).toBe(140);
    expect(incGst(140)).toBe(154);
    expect(exGst(86.9)).toBe(79);
    const parsed = parseLabourCsv("Role,Rate,GST,Charge,Overtime,Default\nTradesman,154.00,inc,hourly,,yes\nMinimum charge,297.00,inc,minimum,,\n");
    expect(parsed.roles[0].rate).toBe(140);
    expect(parsed.roles[1].rate).toBe(270);
    expect(parsed.roles[1].chargeType).toBe("minimum");
    const fixed = labourCost({ hours: 1.5, roleId: parsed.roles[1].id, card: parsed.roles, fallbackRate: 110 });
    expect(fixed.amount).toBe(270);
    expect(fixed.hours).toBe(0);
    expect(labourNote(fixed.lines)).toContain("297.00 inc GST");
  });

  it("reads the Vesh sample card as inc GST and leaves apprentice grades hourly", () => {
    const text = readFileSync("docs/samples/vesh-rate-card.csv", "utf8");
    expect(text).toContain("TODO: Confirm Home Automation Programming");
    expect(text).toContain("does not insert it into the database");
    const parsed = parseLabourCsv(text);
    expect(parsed.error).toBeNull();
    const byName = Object.fromEntries(parsed.roles.map(role => [role.name, role]));
    expect(byName["Service call"]).toMatchObject({ rate: 200, chargeType: "hourly", isDefault: true });
    expect(byName["Tradesman"]).toMatchObject({ rate: 140, chargeType: "hourly" });
    expect(byName["1st+2nd year Apprentice"]).toMatchObject({ rate: 79, chargeType: "hourly" });
    expect(byName["3rd year Apprentice"]).toMatchObject({ rate: 99, chargeType: "hourly" });
    expect(byName["4th year Apprentice"]).toMatchObject({ rate: 120, chargeType: "hourly" });
    expect(byName["Minimum charge (tradesman service call + 1/2 hr)"]).toMatchObject({ rate: 270, chargeType: "minimum" });
    expect(byName["Weekend/after hours call-out fee only"]).toMatchObject({ rate: 250, chargeType: "callout" });
    expect(byName["Consultancy"]).toMatchObject({ rate: 250, chargeType: "hourly" });
    expect(byName["Home Automation Programming"]).toMatchObject({ rate: 185, chargeType: "hourly" });
    const apprentices = parsed.roles.filter(role => role.name.includes("Apprentice"));
    expect(apprentices.every(role => isHourlyCharge(role.chargeType))).toBe(true);
    const mix = labourCost({
      mix: [
        { roleId: byName["Tradesman"].id, hours: 1 },
        { roleId: byName["4th year Apprentice"].id, hours: 1 },
      ],
      card: parsed.roles,
      fallbackRate: 110,
    });
    expect(mix.lines.map(line => line.amount)).toEqual([140, 120]);
  });
});
