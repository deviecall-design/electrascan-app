import { describe, expect, it } from "vitest";
import { buildLedger, categoryOverrun, ledgerRows, priceTimesheet, remainingAt, weekHours } from "../lib/jobLedger";

describe("job ledger", () => {
  it("deducts weekly costs from the contract and flags burn that runs ahead of plan", () => {
    const ledger = buildLedger({
      baselineExGst: 1000,
      start: "2026-11-02",
      end: "2026-11-16",
      today: "2026-11-10",
      costs: [
        { id: "1", date: "2026-11-03", kind: "timesheet", amount: 400, hours: 2, roleName: "Tradesman" },
        { id: "2", date: "2026-11-04", kind: "supplier", amount: 300, supplier: "TLE", reference: "INV-1" },
        { id: "3", date: "2026-11-11", kind: "other", amount: 50, note: "Tip fees" },
      ],
      claims: [
        { id: "c1", date: "2026-11-02", label: "Deposit", amount: 100, status: "paid", kind: "claim" },
        { id: "c2", date: "2026-11-11", label: "Progress", amount: 200, status: "invoiced", kind: "invoice" },
        { id: "c3", date: "2026-11-16", label: "Retention", amount: 50, status: "unpaid", kind: "claim" },
      ],
    });
    expect(ledger.weeks).toHaveLength(3);
    expect(ledger.weeks[0].labour).toBe(400);
    expect(ledger.weeks[0].supplier).toBe(300);
    expect(ledger.weeks[0].cost).toBe(700);
    expect(ledger.weeks[0].remaining).toBe(300);
    expect(ledger.weeks[0].ahead).toBe(true);
    expect(ledger.weeks[1].other).toBe(50);
    expect(ledger.weeks[1].cumulativeCost).toBe(750);
    expect(ledger.weeks[2].claims).toBe(0);
    expect(ledger.weeks[0].claims).toBe(100);
    expect(ledger.weeks[0].pace).toBe("behind");
    expect(ledgerRows(ledger.weeks)[3][5]).toBe(0);
    expect(ledger.summary.claimedToDate).toBe(300);
    expect(ledger.summary.paidToDate).toBe(100);
    expect(ledger.summary.remaining).toBe(250);
  });

  it("prices a timesheet from the role rate", () => {
    expect(priceTimesheet(2, { id: "t", name: "Tradesman", rate: 140, chargeType: "hourly", overtimeMultiplier: null, isDefault: true }, 110)).toBe(280);
    expect(priceTimesheet(2, null, 110)).toBe(220);
  });

  it("keeps the remaining-budget view and leaves future weeks blank", () => {
    const ledger = buildLedger({
      baselineExGst: 1000,
      start: "2026-11-02",
      end: "2026-11-16",
      today: "2026-11-10",
      costs: [{ id: "1", date: "2026-11-03", kind: "timesheet", amount: 400, hours: 8 }],
      claims: [],
    });
    const first = remainingAt(ledger.weeks[0], 1000, "2026-11-10");
    const last = remainingAt(ledger.weeks[2], 1000, "2026-11-10");
    expect(first.planned).toBeCloseTo(666.67, 1);
    expect(first.actual).toBe(600);
    expect(first.pace).toBe("on-plan");
    expect(first.ahead).toBe(false);
    expect(last.actual).toBeNull();
    expect(last.pace).toBe("future");
    expect(weekHours(ledger.weeks[0].items, 30, 3)).toEqual({ planned: 10, actual: 8 });
  });

  it("leaves ready-to-claim amounts out of the weekly claims column", () => {
    const ledger = buildLedger({
      baselineExGst: 30000,
      start: "2026-11-02",
      end: "2026-11-09",
      today: "2026-11-12",
      costs: [],
      claims: [
        { id: "ready-a", date: "2026-11-02", label: "Rough-in", amount: 21116, status: "unpaid", kind: "claim" },
        { id: "ready-b", date: "2026-11-09", label: "First fix", amount: 8446.25, status: "unpaid", kind: "claim" },
        { id: "invoiced", date: "2026-11-02", label: "Deposit", amount: 12669, status: "invoiced", kind: "claim" },
        { id: "draft", date: "2026-11-09", label: "Progress", amount: 500, status: "draft", kind: "claim" },
      ],
    });
    expect(ledger.weeks[0].claims).toBe(12669);
    expect(ledger.weeks[1].claims).toBe(500);
    expect(ledger.summary.claimedToDate).toBe(13169);
    expect(ledgerRows(ledger.weeks).map(row => row[5])).toEqual(["Claims", 12669, 500]);
  });

  it("labels a week ahead, behind, or over budget outside a 2% or $100 band", () => {
    const ledger = buildLedger({
      baselineExGst: 10000,
      start: "2026-11-02",
      end: "2026-11-09",
      today: "2026-11-12",
      costs: [
        { id: "low", date: "2026-11-02", kind: "other", amount: 1000 },
        { id: "high", date: "2026-11-09", kind: "other", amount: 12000 },
      ],
      claims: [],
    });
    const early = remainingAt(ledger.weeks[0], 10000, "2026-11-12");
    const late = remainingAt(ledger.weeks[1], 10000, "2026-11-12");
    expect(early.pace).toBe("ahead");
    expect(late.pace).toBe("over-budget");
  });

  it("drops the EST-2611-0003 overrun by the rate-card labour gap", () => {
    const atFallback = 16551.5;
    const fallbackBudget = 4020.5;
    const cardBudget = 5117;
    expect(categoryOverrun({
      labourSpent: 20000,
      labourBudget: cardBudget,
      materialsSpent: 0,
      materialsBudget: 30000,
      otherSpent: atFallback - (20000 - fallbackBudget),
    })).toBe(15455);
  });
});
