import { describe, it, expect } from "vitest";
import { computeQuoteTotals, lineTotal, AU_GST_RATE } from "../lib/quoteTotals";

describe("computeQuoteTotals (AU GST)", () => {
  it("applies margin on ex-GST subtotal, then 10% GST", () => {
    // 10 × $260 GPO = $2,600; 15% margin; 10% GST
    const t = computeQuoteTotals(2600, 15);
    expect(t.subtotal).toBe(2600);
    expect(t.marginAmount).toBe(390);
    expect(t.gst).toBe(299);
    expect(t.total).toBe(3289);
    expect(t.gstRatePct).toBe(AU_GST_RATE * 100);
  });

  it("matches the Sirius screenshot arithmetic when given that subtotal + 18%", () => {
    // Live Quote used Math.round; we round cents. 116985 * 0.18 = 21057.3
    const t = computeQuoteTotals(116985, 18);
    expect(t.marginAmount).toBe(21057.3);
    expect(t.gst).toBe(13804.23);
    expect(t.total).toBe(151846.53);
  });

  it("does not apply GST to the raw subtotal (margin-first)", () => {
    const t = computeQuoteTotals(1000, 10);
    expect(t.gst).toBe(110); // 10% of 1100, not 10% of 1000
    expect(t.total).toBe(1210);
  });
});

describe("lineTotal", () => {
  it("is qty × unit price", () => {
    expect(lineTotal(6, 260)).toBe(1560);
  });

  it("treats a realistic page of GPOs as thousands, not tens of thousands", () => {
    // Damien: ~6 GPO visible on page 3/5. Even 5 pages × 6 × $260 = $7,800.
    const fivePages = lineTotal(6 * 5, 260);
    expect(fivePages).toBe(7800);
    expect(fivePages).toBeLessThan(20000);
  });
});
