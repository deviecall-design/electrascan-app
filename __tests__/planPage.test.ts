import { describe, it, expect } from "vitest";
import { planPageLabel } from "../lib/planPage";

describe("planPageLabel", () => {
  it("uses the uploaded filename and real page count, not Level 2 · Page 3/5", () => {
    expect(planPageLabel("05. 4 Sirius – Electrical Plans (27.07.26) (1).pdf", 0, 5))
      .toBe("05. 4 Sirius – Electrical Plans (27.07.26) (1).pdf · Page 1/5");
    expect(planPageLabel("Switchboard_LV2_rev3.pdf", 2, 5)).not.toContain("Level 2");
  });

  it("falls back to Source drawing when the name is missing", () => {
    expect(planPageLabel(undefined, 0, 1)).toBe("Source drawing · Page 1/1");
  });
});
