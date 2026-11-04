import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildEstimateWorkbook,
  checkWorkbookUpload,
  linesFromDetections,
  workbookToArrayBuffer,
  type WorkbookDetection,
} from "../lib/estimateWorkbook";
import { computeQuoteTotals } from "../lib/quoteTotals";

const estimateId = "EST-2611-0003";

function sensors(): WorkbookDetection[] {
  return [1, 2, 3, 4].map(id => ({
    id,
    desc: "Light sensor",
    qty: 1,
    unitPrice: 55,
    category: "Switching",
    rateCode: "",
    status: "confirmed" as const,
  }));
}

describe("estimate excel round trip", () => {
  it("finds no changes and the same totals when the file is unchanged", () => {
    const items = sensors();
    const lines = linesFromDetections(items, estimateId);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(4);
    expect(lines[0].sellRate).toBe(55);
    const book = buildEstimateWorkbook({ estimateId, marginPct: 25, lines });
    const summary = book.Sheets.Summary;
    expect(summary.B1.f).toBe("SUM(Lines!K2:K500)");
    expect(summary.B3.f).toBe("B1*B2/100");
    expect(summary.B4.f).toBe("(B1+B3)*0.1");
    const file = workbookToArrayBuffer(book);
    const checked = checkWorkbookUpload({ estimateId, marginPct: 25, items, file, locked: false });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.changes).toEqual([]);
    expect(checked.added).toEqual([]);
    expect(checked.removed).toEqual([]);
    expect(checked.after).toEqual(checked.before);
    expect(checked.before).toEqual(computeQuoteTotals(220, 25));
  });

  it("applies an edited quantity and sell rate across the detections", () => {
    const items = sensors();
    const lines = linesFromDetections(items, estimateId);
    const book = buildEstimateWorkbook({ estimateId, marginPct: 25, lines });
    const sheet = book.Sheets.Lines;
    const qty = XLSX.utils.encode_cell({ r: 1, c: 7 });
    const rate = XLSX.utils.encode_cell({ r: 1, c: 9 });
    sheet[qty] = { t: "n", v: 6 };
    sheet[rate] = { t: "n", v: 60 };
    const checked = checkWorkbookUpload({
      estimateId,
      marginPct: 25,
      items,
      file: workbookToArrayBuffer(book),
      locked: false,
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.changes.map(change => change.field).sort()).toEqual(["qty", "sellRate"]);
    expect(checked.after).toEqual(computeQuoteTotals(360, 25));
    expect(checked.next.map(item => item.qty).sort()).toEqual([1, 1, 2, 2]);
    expect(checked.next.every(item => item.manualPrice && item.unitPrice === 60)).toBe(true);
  });

  it("rejects a workbook for a different estimate and a locked estimate", () => {
    const items = sensors();
    const lines = linesFromDetections(items, "EST-9999-0001");
    const file = workbookToArrayBuffer(buildEstimateWorkbook({ estimateId: "EST-9999-0001", marginPct: 25, lines }));
    const mismatch = checkWorkbookUpload({ estimateId, marginPct: 25, items, file, locked: false });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error).toBe("This workbook belongs to EST-9999-0001, not EST-2611-0003.");
    const own = workbookToArrayBuffer(buildEstimateWorkbook({
      estimateId,
      marginPct: 25,
      lines: linesFromDetections(items, estimateId),
    }));
    const locked = checkWorkbookUpload({ estimateId, marginPct: 25, items, file: own, locked: true });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toMatch(/locked/);
  });
});
