import { describe, it, expect } from "vitest";
import {
  ariesMarginSuggestion,
  ariesPipelineInsight,
  suggestionLeaksOtherProject,
} from "../lib/ariesSuggestion";

describe("ariesMarginSuggestion", () => {
  it("does not mention Bondi Towers on an unrelated job", () => {
    const text = ariesMarginSuggestion({
      clientName: "4 Sirius",
      marginPct: 18,
    });
    expect(text.toLowerCase()).not.toContain("bondi");
    expect(suggestionLeaksOtherProject(text, "4 Sirius")).toBe(false);
  });

  it("does not mention Bondi when the client is unknown", () => {
    const text = ariesMarginSuggestion({ marginPct: 18 });
    expect(text.toLowerCase()).not.toContain("bondi");
    expect(suggestionLeaksOtherProject(text, "")).toBe(false);
  });

  it("may mention Bondi only when that is the current client", () => {
    const text = ariesMarginSuggestion({
      clientName: "Bondi Tower Residences",
      marginPct: 18,
    });
    expect(text.toLowerCase()).toContain("bondi");
    expect(suggestionLeaksOtherProject(text, "Bondi Tower Residences")).toBe(false);
  });

  it("includes the current margin percent", () => {
    const text = ariesMarginSuggestion({ clientName: "Sirius", marginPct: 15 });
    expect(text).toContain("15%");
  });
});

describe("ariesPipelineInsight", () => {
  it("does not invent a GPO regional-average dollar figure", () => {
    const text = ariesPipelineInsight({
      isLive: true,
      pendingValue: 110390,
      estimateCount: 6,
    });
    expect(text.toLowerCase()).not.toContain("14%");
    expect(text).not.toContain("3,200");
    expect(text.toLowerCase()).not.toContain("bondi");
    expect(text).toContain("110,390");
  });

  it("says sample rows when the Dashboard is on demo data", () => {
    const text = ariesPipelineInsight({
      isLive: false,
      pendingValue: 110390,
      estimateCount: 6,
    });
    expect(text.toLowerCase()).toContain("sample");
    expect(text.toLowerCase()).not.toContain("bondi");
  });
});
