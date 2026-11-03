import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { clampMargin, marginForQuote, saveDefaultMargin, loadDefaultMargin } from "../lib/margin";
import { computeQuoteTotals } from "../lib/quoteTotals";

describe("quote margin", () => {
  it("clamps the markup to 0–100", () => {
    expect(clampMargin(-4)).toBe(0);
    expect(clampMargin(150)).toBe(100);
    expect(clampMargin("22.24")).toBe(22.2);
    expect(clampMargin("nope")).toBe(15);
  });

  it("keeps a saved quote margin ahead of the tenant default", () => {
    saveDefaultMargin(30);
    expect(loadDefaultMargin()).toBe(30);
    expect(marginForQuote(18)).toBe(18);
    expect(marginForQuote(null)).toBe(30);
    saveDefaultMargin(15);
  });

  it("recalculates GST when the margin changes", () => {
    const at15 = computeQuoteTotals(1000, 15);
    const at22 = computeQuoteTotals(1000, 22);
    expect(at22.marginAmount).toBe(220);
    expect(at22.total).toBeGreaterThan(at15.total);
    expect(computeQuoteTotals(1000, 150).marginPct).toBe(100);
  });
});

describe("customer-facing names", () => {
  it("does not show Aries, Ares, or a model provider in the visible UI copy", () => {
    const files = [
      "screens/DashboardScreen.tsx",
      "screens/ScanDetailScreen.tsx",
      "app/mockup/page.jsx",
    ];
    for (const file of files) {
      const visible = readFileSync(file, "utf8")
        .replace(/from ["'][^"']+["']/g, "")
        .split("\n")
        .filter(line => {
          const trimmed = line.trim();
          return !trimmed.startsWith("import ")
            && !trimmed.startsWith("//")
            && !trimmed.startsWith("*")
            && !trimmed.startsWith("/*");
        })
        .join("\n");
      expect(visible, file).not.toMatch(/\bAries\b|\bAres\b|\bOpenClaw\b|\bHermes\b|\bClaude\b|\bAnthropic\b/);
    }
  });
});
