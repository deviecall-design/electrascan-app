import { describe, expect, it } from "vitest";
import { cleanDocumentName, documentLabels } from "../lib/documentLabel";

const file = "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf";

describe("cleanDocumentName", () => {
  it("drops the pdf extension and a trailing copy", () => {
    expect(cleanDocumentName(file)).toBe("Mark Arnesen Quoted Plans 6.03.2026");
    expect(cleanDocumentName("05. 4 Sirius - Electrical Plans (19.12.25).pdf")).toBe("05. 4 Sirius - Electrical Plans (19.12.25)");
    expect(cleanDocumentName("Board copy (2).PDF")).toBe("Board");
  });
});

describe("documentLabels", () => {
  it("keeps the first upload and marks the later copy as v2", () => {
    const labels = documentLabels([
      { estimateId: "a", reference: "EST-2611-0003", fileName: file, createdAt: "2026-11-03T00:00:00Z" },
      { estimateId: "b", reference: "EST-2611-0001", fileName: file, createdAt: "2026-11-01T00:00:00Z" },
    ]);
    expect(labels.byReference["EST-2611-0001"]).toBe("Mark Arnesen Quoted Plans 6.03.2026");
    expect(labels.byReference["EST-2611-0003"]).toBe("Mark Arnesen Quoted Plans 6.03.2026 (v2)");
  });

  it("uses a renamed label as typed and leaves the estimate reference as the key", () => {
    const labels = documentLabels([
      { estimateId: "b", reference: "EST-2611-0001", fileName: file, createdAt: "2026-11-01T00:00:00Z" },
      {
        estimateId: "a",
        reference: "EST-2611-0003",
        fileName: file,
        createdAt: "2026-11-03T00:00:00Z",
        customLabel: "Arnesen revision",
      },
    ]);
    expect(labels.byReference["EST-2611-0003"]).toBe("Arnesen revision");
    expect(labels.byEstimateId.a).toBe("Arnesen revision");
    expect(labels.byReference["EST-2611-0001"]).toBe("Mark Arnesen Quoted Plans 6.03.2026");
  });
});
