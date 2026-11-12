import { describe, expect, it } from "vitest";
import { DEFAULT_ASSEMBLIES } from "../lib/assemblies";
import { priceItem, takeoffLabourBudget } from "../lib/quoteSource";
import { legendFlags } from "../lib/legendMatch";
import { confidenceQueue, correctionFrom, scanRecap } from "../lib/reviewQueue";
import { applySupplierPrices, parseSupplierCsv } from "../lib/supplierLink";
import { accountingPush, draftInvoice, toMyobCsv, toXeroCsv } from "../lib/invoiceExport";
import { compareJobCost, JOB_STAGES } from "../lib/jobTracker";

describe("one pricing source", () => {
  const downlight = { desc: "Recessed downlight", symbol: "LT", qty: 3, unitPrice: 200, rateCode: "" };

  it("uses an explicit rate code and ignores the assembly and the stored price", () => {
    const priced = priceItem(
      { ...downlight, rateCode: "LT-1" },
      [{ code: "LT-1", description: "LED downlight", rate: 80, labour: 45 }],
      DEFAULT_ASSEMBLIES,
    );
    expect(priced.source).toBe("rate");
    expect(priced.materialUnit).toBe(80);
    expect(priced.labourUnit).toBe(45);
    expect(priced.sellUnit).toBe(125);
  });

  it("prices the same uncoded line from the assembly on every screen", () => {
    const library = [{ code: "LT-001", description: "LED downlight 10W", rate: 65, labour: 40 }];
    const takeoff = priceItem(downlight, library, DEFAULT_ASSEMBLIES);
    const approvals = priceItem(downlight, library, DEFAULT_ASSEMBLIES);
    expect(takeoff).toEqual(approvals);
    expect(takeoff.source).toBe("assembly");
    expect(takeoff.sellUnit).toBe(85);
    expect(takeoff.materialUnit + takeoff.labourUnit).toBe(85);
  });

  it("keeps the stored price when a rate code is not in the library yet", () => {
    const priced = priceItem(
      { desc: "Kitchen double GPO", symbol: "GPO", qty: 4, unitPrice: 120, rateCode: "GPO-D" },
      [],
      DEFAULT_ASSEMBLIES,
    );
    expect(priced.source).toBe("stored");
    expect(priced.sellUnit).toBe(120);
  });

  it("uses the workspace price list ahead of the assembly default", () => {
    const priced = priceItem(
      downlight,
      [],
      DEFAULT_ASSEMBLIES,
      110,
      [{ code: "DL-90", description: "Recessed downlight", unit: "ea", cost: 18, assemblyId: "downlight" }],
    );
    expect(priced.source).toBe("price-list");
    expect(priced.materialUnit).toBe(18);
    expect(priced.labourUnit).toBe(38.5);
    expect(priced.sellUnit).toBe(56.5);
  });

  it("keeps an explicit rate code ahead of the price list", () => {
    const priced = priceItem(
      { ...downlight, rateCode: "LT-1" },
      [{ code: "LT-1", description: "LED downlight", rate: 80, labour: 45 }],
      DEFAULT_ASSEMBLIES,
      110,
      [{ code: "LT-1", description: "Recessed downlight", unit: "ea", cost: 9, assemblyId: "downlight" }],
    );
    expect(priced.source).toBe("rate");
    expect(priced.sellUnit).toBe(125);
  });

  it("does not let a rate-library keyword replace a stored price", () => {
    const priced = priceItem(
      { desc: "Pendant", symbol: "EL", unitPrice: 200, rateCode: "" },
      [{ code: "LT-001", description: "LED downlight light", rate: 65, labour: 40 }],
      DEFAULT_ASSEMBLIES,
    );
    expect(priced.source).toBe("stored");
    expect(priced.sellUnit).toBe(200);
  });
});

describe("legend flags", () => {
  it("flags a detection missing from the legend and a legend row missing on the plan", () => {
    const flags = legendFlags(
      [
        { symbol: "DL", description: "Recessed downlight", quantity: 4, kind: "legend" },
        { symbol: "DB", description: "Distribution board", quantity: 1, kind: "schedule" },
      ],
      [{ symbol: "GPO", desc: "Double GPO", qty: 2 }],
    );
    expect(flags.map(flag => flag.kind).sort()).toEqual(["missing_on_plan", "missing_on_plan", "not_in_legend"]);
  });
});

describe("confidence review", () => {
  const items = [
    { id: 1, desc: "Sure", qty: 1, conf: 0.95, status: "ai" },
    { id: 2, desc: "Unsure", qty: 2, conf: 0.4, status: "ai" },
    { id: 3, desc: "Done", qty: 1, conf: 0.2, status: "confirmed" },
  ];

  it("puts the least sure open detection first and records the original value", () => {
    expect(confidenceQueue(items).map(item => item.desc)).toEqual(["Unsure", "Sure"]);
    const correction = correctionFrom(items[1], "fixed", { qty: 4, desc: "Double GPO" });
    expect(correction.originalDesc).toBe("Unsure");
    expect(correction.originalQty).toBe(2);
    expect(correction.correctedQty).toBe(4);
    const recap = scanRecap(items, { pageCount: 6 });
    expect(recap.pagesRead).toBe(6);
    expect(recap.waiting).toBe(2);
    expect(recap.anomalies.some(line => line.includes("Unsure"))).toBe(true);
  });
});

describe("supplier round trip", () => {
  it("prices only the lines that were requested", () => {
    const priced = applySupplierPrices(
      [{ product: "Double GPO", qty: 4, unit: "ea" }],
      [
        ...parseSupplierCsv("Product,Qty,Unit price,Availability\nDouble GPO,4,12.50,in stock\nSecret catalogue row,1,1,stock"),
      ],
    );
    expect(priced).toEqual([
      { product: "Double GPO", qty: 4, unit: "ea", supplierUnitPrice: 12.5, availability: "in stock" },
    ]);
  });
});

describe("draft invoices", () => {
  it("builds a draft and both import files without pushing", () => {
    const invoice = draftInvoice({
      source: "milestone",
      sourceRef: "deposit",
      jobName: "Harbour",
      clientName: "Harbour St",
      description: "Deposit on signing",
      amountExGst: 1000,
    });
    expect(invoice.status).toBe("draft");
    expect(invoice.tax).toBe(100);
    expect(toXeroCsv([invoice])).toContain("*ContactName");
    expect(toXeroCsv([invoice])).toContain("Harbour St");
    expect(toMyobCsv([invoice])).toContain("Co./Last Name");
    expect(accountingPush({ xeroConfigured: false, myobConfigured: false })).toEqual({
      xero: "missing_keys",
      myob: "missing_keys",
    });
  });
});

describe("takeoff labour budget", () => {
  it("uses the tenant tradesman rate instead of $110/h", () => {
    const assembly = {
      ...DEFAULT_ASSEMBLIES[0],
      id: "est-2611-0003",
      symbols: ["JOB"],
      keywords: ["arnesen"],
      labourHours: 36.55,
      sellPrice: 40000,
      materials: [],
    };
    const item = { symbol: "JOB", desc: "Arnesen", qty: 1, status: "confirmed" };
    const card = [{ id: "tradesman", name: "Tradesman", rate: 140, chargeType: "hourly" as const, overtimeMultiplier: null, isDefault: true }];
    expect(takeoffLabourBudget([item], [assembly], 110, null)).toEqual({ hours: 36.55, dollars: 4020.5 });
    expect(takeoffLabourBudget([item], [assembly], 110, card)).toEqual({ hours: 36.55, dollars: 5117 });
  });
});

describe("job tracker", () => {
  it("warns when actual cost slips the quoted margin", () => {
    expect(JOB_STAGES).toContain("invoicing");
    const healthy = compareJobCost({ quotedSell: 1000, actualMaterials: 400, actualHours: 2, labourRate: 110 });
    expect(healthy.slip).toBe(false);
    const slipped = compareJobCost({ quotedSell: 1000, quotedMarginPct: 15, actualMaterials: 900, actualHours: 1 });
    expect(slipped.slip).toBe(true);
    expect(slipped.warning).toMatch(/slipped/);
  });
});
