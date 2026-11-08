import { describe, expect, it } from "vitest";
import { estimateTotal, formatGstMoney } from "../lib/estimateTotal";

describe("estimateTotal", () => {
  it("uses priced lines and the estimate margin, not a stale saved value", () => {
    const total = estimateTotal({
      items: [{ qty: 1, unitPrice: 33785, status: "confirmed" }],
      subtotal: 23134,
      marginPct: 25,
      value: 31809.25,
    });
    expect(total.basis).toBe("lines");
    expect(total.sellExGst).toBe(33785);
    expect(total.incGst).toBe(46454.38);
    expect(total.contractExGst).toBe(42231.25);
    expect(formatGstMoney(total.incGst, "inc")).toBe("$46,454.38 inc GST");
    expect(formatGstMoney(total.sellExGst, "ex")).toBe("$33,785.00 ex GST");
  });

  it("uses the saved subtotal when there are no priced lines", () => {
    const total = estimateTotal({ subtotal: 23134, marginPct: 25, value: 1 });
    expect(total.basis).toBe("subtotal");
    expect(total.incGst).toBe(31809.25);
  });
});
