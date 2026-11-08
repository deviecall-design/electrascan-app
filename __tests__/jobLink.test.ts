import { describe, expect, it } from "vitest";
import { computeQuoteTotals } from "../lib/quoteTotals";
import { displayClient, quotedSellExGst, resolveJobTarget } from "../lib/jobLink";

describe("job client and burndown route", () => {
  it("reads Mark Arnesen from the drawing when the saved client is the placeholder", () => {
    expect(displayClient({
      client: "Client not set",
      projectName: "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf",
      drawingFile: "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf",
    })).toBe("Mark Arnesen");
    expect(displayClient({
      client: "",
      fileName: "05. 4 Sirius - Electrical Plans (19.12.25).pdf",
    })).toBe("4 Sirius");
    expect(displayClient({ client: "Harbour St", projectName: "Other.pdf" })).toBe("Harbour St");
  });

  it("keeps the Mark Arnesen quote total at the saved sell and margin", () => {
    const sell = quotedSellExGst([
      { qty: 4, unitPrice: 55, status: "confirmed" },
      { qty: 20, unitPrice: 85, status: "confirmed" },
    ]);
    expect(computeQuoteTotals(33785, 25).total).toBe(46454.38);
    expect(sell).toBe(1920);
  });

  it("opens the burndown from an estimate reference or an id", () => {
    const estimates = [{
      id: "est-id",
      reference: "EST-2611-0003",
      client: "Client not set",
      project_name: "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf",
    }];
    const scans = [{
      id: "scan-id",
      client: null,
      file_name: "Mark Arnesen Quoted Plans 6.03.2026 copy.pdf",
      estimate_ref: "EST-2611-0003",
    }];
    expect(resolveJobTarget("EST-2611-0003", scans, estimates).estimate?.id).toBe("est-id");
    expect(resolveJobTarget("est-id", scans, estimates).scans[0].id).toBe("scan-id");
    expect(resolveJobTarget("scan-id", scans, estimates).estimate?.reference).toBe("EST-2611-0003");
  });
});
