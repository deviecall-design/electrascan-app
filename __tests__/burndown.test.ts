import { describe, expect, it } from "vitest";
import {
  burnPercent,
  burnTone,
  burndownWeeks,
  milestoneWeekIndex,
  paymentSchedule,
  quoteContract,
  spendAheadWarning,
  sumActuals,
} from "../lib/burndown";

describe("job burndown", () => {
  it("uses the quote total as the contract and colours the burn", () => {
    const contract = quoteContract(1000, 15);
    expect(contract.total).toBeGreaterThan(1000);
    expect(burnPercent(contract.total * 0.8, contract.total)).toBe(80);
    expect(burnTone(80)).toBe("amber");
    expect(burnTone(95)).toBe("red");
    expect(burnTone(40)).toBe("ok");
  });

  it("spreads the plan across the job dates and keeps actuals cumulative", () => {
    const weeks = burndownWeeks({
      contract: 1000,
      plannedHours: 40,
      start: "2026-11-02",
      end: "2026-11-16",
      today: "2026-11-10",
      actuals: [
        { jobId: "harbour", date: "2026-11-03", materials: 100, labourHours: 4, labourCost: 200, note: "" },
        { jobId: "harbour", date: "2026-11-09", materials: 50, labourHours: 2, labourCost: 100, note: "rough-in" },
      ],
    });
    expect(weeks.length).toBeGreaterThan(1);
    expect(weeks[0].plannedSpend).toBeLessThan(weeks[weeks.length - 1].plannedSpend);
    expect(weeks[weeks.length - 1].plannedSpend).toBe(1000);
    const logged = weeks.filter(week => week.actualSpend != null);
    expect(logged[logged.length - 1].actualSpend).toBe(450);
    expect(sumActuals([
      { jobId: "harbour", date: "2026-11-03", materials: 100, labourHours: 4, labourCost: 200, note: "" },
    ]).cost).toBe(300);
  });

  it("warns when spend runs ahead of the invoiced milestones", () => {
    const schedule = paymentSchedule(10000);
    expect(schedule[0].id).toBe("deposit");
    expect(schedule.reduce((sum, row) => sum + row.pct, 0)).toBe(100);
    expect(milestoneWeekIndex(0, schedule.length, 8)).toBeGreaterThanOrEqual(0);
    const warning = spendAheadWarning(60, [
      { pct: 10, status: "invoiced" },
      { pct: 20, status: "not_due" },
    ]);
    expect(warning).toMatch(/60%/);
    expect(warning).toMatch(/10%/);
    expect(spendAheadWarning(20, [{ pct: 10, status: "paid" }])).toBeNull();
  });
});
