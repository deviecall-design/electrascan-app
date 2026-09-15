import { describe, expect, it } from "vitest";
import { resolveDashboardKpis } from "./resolveDashboardKpis";
import type { DashboardKpis } from "../services/dashboardKpiService";

const localEmpty = {
  estimatesThisMonth: 0,
  pendingValue: 0,
  winRate: null,
  avgDays: null,
};

const localDrafts = {
  estimatesThisMonth: 3,
  pendingValue: 42000,
  winRate: 50,
  avgDays: 1.2,
};

const liveEmpty: DashboardKpis = {
  estimatesThisMonth: 0,
  pendingValue: 0,
  winRate: null,
  avgScanToQuoteHours: null,
  source: "empty",
};

const liveRows: DashboardKpis = {
  estimatesThisMonth: 8,
  pendingValue: 90000,
  winRate: 70,
  avgScanToQuoteHours: 6,
  source: "supabase",
};

describe("resolveDashboardKpis", () => {
  it("stays in loading without exposing cloud zeros", () => {
    const stats = resolveDashboardKpis("loading", liveEmpty, localDrafts);
    expect(stats.source).toBe("loading");
    expect(stats.estimatesThisMonth).toBe(3);
  });

  it("does not let an empty cloud table wipe local drafts", () => {
    const stats = resolveDashboardKpis("ready", liveEmpty, localDrafts);
    expect(stats.source).toBe("local");
    expect(stats.estimatesThisMonth).toBe(3);
    expect(stats.pendingValue).toBe(42000);
    expect(stats.winRate).toBe(50);
  });

  it("shows an honest empty state when both sources are empty", () => {
    const stats = resolveDashboardKpis("ready", liveEmpty, localEmpty);
    expect(stats.source).toBe("empty");
    expect(stats.estimatesThisMonth).toBe(0);
    expect(stats.avgScanToQuote).toBe("—");
  });

  it("uses live supabase rows when they exist", () => {
    const stats = resolveDashboardKpis("ready", liveRows, localDrafts);
    expect(stats.source).toBe("supabase");
    expect(stats.estimatesThisMonth).toBe(8);
    expect(stats.avgScanToQuote).toBe("6.0h");
  });

  it("falls back to local drafts on error", () => {
    const stats = resolveDashboardKpis("error", null, localDrafts);
    expect(stats.source).toBe("error");
    expect(stats.pendingValue).toBe(42000);
  });
});
