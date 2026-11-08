import { describe, expect, it } from "vitest";
import { buildLedger, priceTimesheet } from "../lib/jobLedger";

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
    expect(ledger.weeks[2].claims).toBe(50);
    expect(ledger.summary.claimedToDate).toBe(300);
    expect(ledger.summary.paidToDate).toBe(100);
    expect(ledger.summary.remaining).toBe(250);
  });

  it("prices a timesheet from the role rate", () => {
    expect(priceTimesheet(2, { id: "t", name: "Tradesman", rate: 140, chargeType: "hourly", overtimeMultiplier: null, isDefault: true }, 110)).toBe(280);
    expect(priceTimesheet(2, null, 110)).toBe(220);
  });
});
