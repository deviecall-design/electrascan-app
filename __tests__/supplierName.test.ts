import { describe, expect, it } from "vitest";
import { canonicalSupplierName as fromLib } from "../lib/supplierName";
import { canonicalSupplierName as fromApi } from "../api/_lib/supplierName.js";

describe("canonicalSupplierName", () => {
  it("shows TLE for the old Lawrence & Hanson and L&H labels", () => {
    for (const canonical of [fromLib, fromApi]) {
      expect(canonical("Lawrence & Hanson")).toBe("TLE");
      expect(canonical("  l&h ")).toBe("TLE");
      expect(canonical("L & H")).toBe("TLE");
      expect(canonical("Lawrence and Hanson")).toBe("TLE");
      expect(canonical("")).toBe("TLE");
      expect(canonical("Middy's")).toBe("Middy's");
      expect(canonical("Rexel")).toBe("Rexel");
    }
  });
});
