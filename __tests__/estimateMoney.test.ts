import { describe, it, expect } from "vitest";
import { computeQuoteTotals, DEFAULT_MARGIN_PCT } from "../lib/quoteTotals";
import {
  quotedTotalIncGst,
  sumPendingQuotedValue,
  sumWonQuotedValue,
  winRatePct,
  countEstimatesThisMonth,
  computeDashboardMoneyStats,
  quotePersistFields,
  impliedSubtotalFromIncGst,
  avgScanToQuoteMs,
  estimateDisplayRef,
} from "../lib/estimateMoney";

const NOW = new Date("2026-09-15T00:00:00+10:00");

describe("quotedTotalIncGst", () => {
  it("prefers stored value (GST-inclusive quoted total)", () => {
    expect(
      quotedTotalIncGst({ value: 151846.53, subtotal: 116985, margin_pct: 18 }),
    ).toBe(151846.53);
  });

  it("derives from subtotal + margin when value is missing", () => {
    const derived = quotedTotalIncGst({ subtotal: 2600, margin_pct: 15, value: 0 });
    expect(derived).toBe(computeQuoteTotals(2600, 15).total);
  });
});

describe("quotePersistFields", () => {
  it("writes value as the same total the Quote letterhead shows", () => {
    const fields = quotePersistFields(116985, 18);
    const letterhead = computeQuoteTotals(116985, 18);
    expect(fields.subtotal).toBe(letterhead.subtotal);
    expect(fields.value).toBe(letterhead.total);
    expect(fields.margin_pct).toBe(18);
  });
});

describe("pipeline sums", () => {
  const rows = [
    { status: "sent", value: 28450, created_at: "2026-09-13T00:00:00Z" },
    { status: "approved", value: 14900, created_at: "2026-09-10T00:00:00Z" },
    { status: "viewed", value: 62300, created_at: "2026-09-09T00:00:00Z" },
    { status: "draft", value: 8120, created_at: "2026-09-07T00:00:00Z" },
    { status: "sent", value: 19640, created_at: "2026-09-02T00:00:00Z" },
  ];

  it("pending is sent + viewed GST-inclusive totals, not drafts", () => {
    // Live Bondi mock greeting: 28450 + 62300 + 19640 = 110390
    expect(sumPendingQuotedValue(rows)).toBe(110390);
  });

  it("win value is approved only", () => {
    expect(sumWonQuotedValue(rows)).toBe(14900);
  });

  it("does not treat pending as a lost job in win rate", () => {
    // One approved, zero rejected → 100%, not 1/4 = 25%
    expect(winRatePct(rows, { now: NOW })).toBe(100);
  });

  it("returns null win rate when nothing is closed", () => {
    expect(
      winRatePct(
        [{ status: "sent", value: 1000, created_at: "2026-09-01T00:00:00Z" }],
        { now: NOW },
      ),
    ).toBeNull();
  });

  it("counts this month from created_at", () => {
    expect(countEstimatesThisMonth(rows, NOW)).toBe(5);
  });
});

describe("computeDashboardMoneyStats", () => {
  it("keeps greeting pending and KPI pending identical", () => {
    const estimates = [
      { status: "sent", value: 28450, created_at: "2026-09-13T00:00:00Z" },
      { status: "viewed", value: 62300, created_at: "2026-09-09T00:00:00Z" },
    ];
    const stats = computeDashboardMoneyStats(estimates, [], NOW);
    expect(stats.pendingValue).toBe(sumPendingQuotedValue(estimates));
    expect(stats.pendingValue).toBe(90750);
  });
});

describe("impliedSubtotalFromIncGst", () => {
  it("round-trips through computeQuoteTotals at the company default margin", () => {
    const listed = 28450;
    const sub = impliedSubtotalFromIncGst(listed, DEFAULT_MARGIN_PCT);
    const back = computeQuoteTotals(sub, DEFAULT_MARGIN_PCT).total;
    expect(Math.abs(back - listed)).toBeLessThan(0.02);
  });
});

describe("avgScanToQuoteMs", () => {
  it("matches scans.estimate_ref to estimates.reference (not only ref)", () => {
    const ms = avgScanToQuoteMs(
      [{ estimate_ref: "EST-2609-0001", started_at: "2026-09-15T00:00:00Z" }],
      [
        {
          reference: "EST-2609-0001",
          created_at: "2026-09-15T02:00:00Z",
        },
      ],
    );
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });
});

describe("estimateDisplayRef", () => {
  it("prefers the sequential reference column", () => {
    expect(
      estimateDisplayRef({ ref: "legacy", reference: "EST-2609-0001" }),
    ).toBe("EST-2609-0001");
  });
});
