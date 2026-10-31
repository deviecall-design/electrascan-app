import { describe, expect, it } from "vitest";
import {
  addSymbol,
  canSendQuote,
  countUnpriced,
  formatVerified,
  groupTakeoff,
  isUnpricedLine,
  priceTakeoff,
  setItemQty,
  setLibraryRate,
  setManualPrice,
  setStatus,
  takeoffTotals,
  unpricedNote,
  verifiedPercent,
} from "../lib/takeoff";
import { materialsCsv, materialsFromTakeoff, materialsMailto, stripSupplierPrices } from "../lib/materialsRequest";
import { readDetectedItems } from "../lib/scanRecord";
import type { StoredDetectedItem } from "../lib/scanRecord";

const gpo: StoredDetectedItem = {
  id: 1,
  symbol: "GPO",
  qty: 4,
  desc: "Kitchen double GPO",
  rateCode: "GPO-D",
  conf: 0.7,
  x: 20,
  y: 30,
  unitPrice: 50,
  status: "ai",
};

describe("takeoff totals", () => {
  it("prices a group from the rate library and recalculates GST when the count changes", () => {
    const priced = priceTakeoff([gpo], [{ code: "GPO-D", description: "Double GPO", rate: 120 }]);
    expect(groupTakeoff(priced)[0]).toMatchObject({ label: "GPOs", count: 4, rate: 120, lineTotal: 480 });
    const changed = setItemQty(priced, 1, 2);
    const totals = takeoffTotals(changed, 15);
    expect(takeoffTotals(priced, 15).subtotal).toBe(480);
    expect(totals.subtotal).toBe(240);
    expect(totals.gst).toBeGreaterThan(0);
    expect(totals.total).toBeGreaterThan(totals.subtotal);
  });

  it("drops a rejected detection from the quote and counts verification", () => {
    const rows = priceTakeoff([
      gpo,
      { ...gpo, id: 2, qty: 1, desc: "Smoke alarm", symbol: "SA", detectedType: "SMOKE_DETECTOR", rateCode: "", unitPrice: 80, status: "confirmed" },
    ], [{ code: "SA-1", description: "Smoke alarm", rate: 80 }]);
    const rejected = setStatus(rows, 1, "rejected");
    expect(groupTakeoff(rejected).find(group => group.label === "GPOs")?.count).toBe(0);
    expect(takeoffTotals(rejected, 0).subtotal).toBe(80);
    expect(verifiedPercent(rejected)).toBe(100);
    expect(formatVerified(rows)).toBe("Takeoff 20% verified");
    expect(canSendQuote(rows, null)).toBe(true);
    expect(canSendQuote(rows, 50)).toBe(false);
  });

  it("adds a missed symbol as manually added", () => {
    const next = addSymbol([], "downlight", { x: 40, y: 50 }, [{ code: "LT-1", description: "LED downlight", rate: 90 }]);
    expect(next[0]).toMatchObject({ status: "added", qty: 1, group: "downlight", unitPrice: 90 });
    expect(verifiedPercent(next)).toBe(100);
  });

  it("keeps status when a scan is read back", () => {
    const rows = readDetectedItems([{ ...gpo, status: "confirmed", priceSource: "manual", marks: [{ x: 12, y: 18 }] }]);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].priceSource).toBe("manual");
    expect(rows[0].marks).toEqual([{ x: 12, y: 18 }]);
  });

  it("excludes AI guesses that have no rate-library match from subtotal, margin and GST", () => {
    const rates = [{ code: "GPO-D", description: "Double GPO", rate: 120 }];
    const guesses = [
      { ...gpo, id: 2, symbol: "FN", desc: "Exhaust fan", detectedType: "EXHAUST_FAN", rateCode: "", unitPrice: 215, group: "other" },
      { ...gpo, id: 3, symbol: "DC", desc: "Automation hub", detectedType: "AUTOMATION_HUB", rateCode: "", unitPrice: 1200, group: "other" },
      { ...gpo, id: 4, symbol: "EX", desc: "Heated towel rail", detectedType: "HEATED_TOWEL_RAIL", rateCode: "", unitPrice: 450, group: "other" },
      { ...gpo, id: 5, symbol: "EX", desc: "Underfloor heating", detectedType: "UNDERFLOOR_HEAT", rateCode: "", unitPrice: 450, group: "other" },
      { ...gpo, id: 6, symbol: "SA", desc: "Intercom", detectedType: "SECURITY_INTERCOM", rateCode: "", unitPrice: 250, group: "other" },
    ];
    const priced = priceTakeoff([gpo, ...guesses], rates);
    expect(priced.filter(row => isUnpricedLine(row)).map(row => row.desc)).toEqual([
      "Exhaust fan",
      "Automation hub",
      "Heated towel rail",
      "Underfloor heating",
      "Intercom",
    ]);
    expect(countUnpriced(priced)).toBe(5);
    expect(unpricedNote(5)).toBe("5 items unpriced: add rates to include");
    const totals = takeoffTotals(priced, 15, rates);
    expect(totals.subtotal).toBe(480);
    expect(totals.marginAmount).toBe(72);
    expect(totals.gst).toBe(55.2);
    expect(totals.total).toBe(607.2);
    const other = groupTakeoff(priced).find(group => group.id === "other");
    expect(other?.lineTotal).toBe(0);
  });

  it("includes an unmatched line once the user sets a price or a library rate", () => {
    const fan = { ...gpo, id: 2, qty: 1, symbol: "FN", desc: "Exhaust fan", detectedType: "EXHAUST_FAN", rateCode: "", unitPrice: 215, group: "other" };
    const library = [{ code: "FN-1", description: "Exhaust fan", rate: 240, labour: 30 }];
    expect(takeoffTotals(priceTakeoff([fan], library), 0, library).subtotal).toBe(0);

    const typed = setManualPrice([fan], fan.id, 180);
    expect(takeoffTotals(typed, 0, library).subtotal).toBe(180);
    expect(priceTakeoff(typed, library)[0].priceSource).toBe("manual");
    expect(priceTakeoff(typed, library)[0].unitPrice).toBe(180);

    const rated = setLibraryRate([fan], fan.id, library[0]);
    expect(takeoffTotals(rated, 0, library).subtotal).toBe(240);
    expect(isUnpricedLine(priceTakeoff(rated, library)[0], library)).toBe(false);
  });

  it("does not price an unmatched line at a sibling rate", () => {
    const rows = priceTakeoff([
      { ...gpo, id: 2, symbol: "FN", desc: "Exhaust fan", detectedType: "EXHAUST_FAN", rateCode: "", unitPrice: 215, group: "other" },
      { ...gpo, id: 6, qty: 1, symbol: "SA", desc: "Intercom", detectedType: "SECURITY_INTERCOM", rateCode: "IC-1", unitPrice: 250, group: "other" },
    ], [{ code: "IC-1", description: "Intercom", rate: 300 }]);
    expect(groupTakeoff(rows).find(group => group.id === "other")?.lineTotal).toBe(300);
  });
});

describe("materials request", () => {
  it("lists confirmed counts only and never includes a price", () => {
    const lines = materialsFromTakeoff([
      { ...gpo, status: "confirmed" },
      { ...gpo, id: 2, qty: 2, status: "ai", desc: "Pending GPO" },
      { ...gpo, id: 3, qty: 1, status: "rejected", desc: "False GPO" },
    ]);
    expect(lines).toEqual([
      { product: "Kitchen double GPO", qty: 4, brand: "", unit: "ea", notes: "" },
    ]);
    const csv = materialsCsv({ jobName: "Harbour", siteAddress: "1 Test St", requiredBy: "2026-11-01", lines });
    expect(csv).not.toMatch(/price|discount|\$/i);
    const href = materialsMailto({
      jobName: "Harbour",
      siteAddress: "1 Test St",
      requiredBy: "2026-11-01",
      supplierName: "Lawrence & Hanson",
      supplierEmail: "orders@lh.example",
      notes: "Use our trade account",
      lines,
      status: "draft",
    });
    expect(href?.startsWith("mailto:orders@lh.example")).toBe(true);
    expect(decodeURIComponent(href || "")).not.toMatch(/\$|discount/);
    expect(stripSupplierPrices({ product: "GPO", qty: 2, price: 99, discount: 10, brand: "Clipsal" })).toEqual({
      product: "GPO",
      qty: 2,
      brand: "Clipsal",
      unit: "ea",
      notes: "",
    });
  });
});
