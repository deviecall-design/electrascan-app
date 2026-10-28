import { describe, expect, it } from "vitest";
import {
  addSymbol,
  canSendQuote,
  formatVerified,
  groupTakeoff,
  priceTakeoff,
  setItemQty,
  setStatus,
  takeoffTotals,
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
    ], []);
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
    const rows = readDetectedItems([{ ...gpo, status: "confirmed", marks: [{ x: 12, y: 18 }] }]);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].marks).toEqual([{ x: 12, y: 18 }]);
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
