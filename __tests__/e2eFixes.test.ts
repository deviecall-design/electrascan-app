import { describe, expect, it } from "vitest";
import { splitCostBreakdown } from "../lib/costBreakdown";
import { formatGstMoney } from "../lib/estimateTotal";
import { bindOpenedEstimate } from "../lib/quotePanel";
import { milestoneWarning, showOverrunAlert } from "../lib/reportMilestone";
import { variationChain } from "../lib/variationDiff";
import { roundCents } from "../lib/quoteTotals";

const lines = [
  { qty: 10, unitPrice: 3378.5 },
];

function signedExGst(amount: number): string {
  return `${amount < 0 ? "−" : "+"}${formatGstMoney(Math.abs(amount), "ex")}`;
}

describe("variation cost impact label", () => {
  it("says ex GST once", () => {
    const label = signedExGst(133.5);
    expect(label).toBe("+$133.50 ex GST");
    expect(label.match(/ex GST/g)).toHaveLength(1);
  });
});

describe("quote cost breakdown", () => {
  it("uses the labour-by-role total and leaves the rest as materials", () => {
    const split = splitCostBreakdown({
      subtotal: 33785,
      margin: 8446.25,
      labourByRole: [{ amount: 3000 }, { amount: 2117 }],
      fallbackLabour: 0,
    });
    expect(split.labour).toBe(5117);
    expect(split.materials).toBe(28668);
    expect(roundCents(split.materials + split.labour + split.margin)).toBe(roundCents(33785 + 8446.25));
  });
});

describe("opened estimate panel", () => {
  const estimates = [
    { id: "old", reference: "EST-2611-0001", margin_pct: 15, subtotal: 23134, value: 31809.25 },
    { id: "new", reference: "EST-2611-0003", margin_pct: 25, subtotal: 23134, value: 31809.25 },
  ];

  it("uses the opened estimate's margin, not the other revision or 15%", () => {
    const bound = bindOpenedEstimate({
      openedRef: "EST-2611-0003",
      scanRef: "EST-2611-0001",
      estimates,
      items: lines,
    });
    expect(bound?.estimateId).toBe("EST-2611-0003");
    expect(bound?.marginPct).toBe(25);
    expect(bound?.incGst).toBe(46454.38);
  });
});

describe("report alerts", () => {
  it("stays quiet when nothing has been spent and contingency remains", () => {
    expect(showOverrunAlert({ overrunAmount: 0, costToDate: 0, plannedToDate: 6000 })).toBe(false);
    expect(milestoneWarning({
      burnPct: 0,
      milestones: [{ label: "Deposit on signing", cumulativePct: 10, status: "pending" }],
    })).toBeNull();
  });

  it("shows an overrun when unplanned cost exists or spend passes the plan", () => {
    expect(showOverrunAlert({ overrunAmount: 40, costToDate: 40, plannedToDate: 6000 })).toBe(true);
    expect(showOverrunAlert({ overrunAmount: 0, costToDate: 7000, plannedToDate: 6000 })).toBe(true);
  });

  it("warns only after burn reaches an unclaimed milestone", () => {
    const milestones = [
      { label: "Deposit on signing", cumulativePct: 10, status: "pending" },
      { label: "First fix complete", cumulativePct: 55, status: "pending" },
    ];
    expect(milestoneWarning({ burnPct: 12, milestones })?.label).toBe("Deposit on signing");
    expect(milestoneWarning({ burnPct: 12, milestones: [{ ...milestones[0], status: "received" }] })).toBeNull();
  });
});

describe("variation net", () => {
  it("equals the revised total minus the base total, and the lines add up", () => {
    const chain = variationChain([
      {
        file_name: "Mark Arnesen plan.pdf",
        started_at: "2026-03-01",
        detected_items: [
          { id: 1, symbol: "GPO", qty: 2, desc: "Double GPO", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 100, materialUnit: 100, labourUnit: 20 },
          { id: 2, symbol: "GPO", qty: 1, desc: "Double GPO", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 100, materialUnit: 100, labourUnit: 20 },
        ],
      },
      {
        file_name: "Mark Arnesen plan.pdf",
        started_at: "2026-04-01",
        detected_items: [
          { id: 1, symbol: "GPO", qty: 4, desc: "Double GPO", rateCode: "", conf: 1, x: 0, y: 0, unitPrice: 110, materialUnit: 110, labourUnit: 25 },
        ],
      },
    ]);
    const base = roundCents(chain[0].materials + chain[0].labour);
    const revised = roundCents(chain[1].materials + chain[1].labour);
    const net = roundCents(revised - base);
    const linesNet = roundCents(chain[1].changes.reduce((sum, line) => sum + line.delta, 0));
    expect(net).toBe(linesNet);
    expect(base).toBe(360);
    expect(revised).toBe(540);
    expect(net).toBe(180);
  });
});
