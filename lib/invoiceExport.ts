/**
 * Draft invoices and progress claims.
 * Xero and MYOB are exported as CSV until those connections exist.
 * Nothing here sends an invoice.
 */

export interface DraftInvoiceLine {
  description: string;
  qty: number;
  unitAmount: number;
}

export interface DraftInvoice {
  id: string;
  source: "milestone" | "variation";
  sourceRef: string;
  jobName: string;
  clientName: string;
  lines: DraftInvoiceLine[];
  amount: number;
  tax: number;
  status: "draft";
}

export function draftInvoice(input: {
  source: DraftInvoice["source"];
  sourceRef: string;
  jobName: string;
  clientName: string;
  description: string;
  amountExGst: number;
}): DraftInvoice {
  const amount = Math.round(Math.max(0, input.amountExGst) * 100) / 100;
  const tax = Math.round(amount * 0.1 * 100) / 100;
  return {
    id: `${input.source}-${input.sourceRef}`.replace(/\s+/g, "-").slice(0, 80),
    source: input.source,
    sourceRef: input.sourceRef,
    jobName: input.jobName,
    clientName: input.clientName || input.jobName || "Client",
    lines: [{ description: input.description, qty: 1, unitAmount: amount }],
    amount,
    tax,
    status: "draft",
  };
}

function cell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toXeroCsv(invoices: DraftInvoice[]): string {
  const header = ["*ContactName", "*InvoiceNumber", "*InvoiceDate", "*Description", "*Quantity", "*UnitAmount", "*AccountCode", "*TaxType"];
  const today = new Date().toISOString().slice(0, 10);
  const rows = invoices.flatMap(invoice => invoice.lines.map(line => [
    invoice.clientName,
    invoice.id,
    today,
    line.description,
    line.qty,
    line.unitAmount,
    "200",
    "GST on Income",
  ]));
  return [header, ...rows].map(row => row.map(cell).join(",")).join("\n");
}

export function toMyobCsv(invoices: DraftInvoice[]): string {
  const header = ["Co./Last Name", "Invoice No.", "Date", "Description", "Amount", "Tax Code", "Job"];
  const today = new Date().toISOString().slice(0, 10);
  const rows = invoices.flatMap(invoice => invoice.lines.map(line => [
    invoice.clientName,
    invoice.id,
    today,
    line.description,
    line.unitAmount,
    "GST",
    invoice.jobName,
  ]));
  return [header, ...rows].map(row => row.map(cell).join(",")).join("\n");
}

export function accountingPush(status: { xeroConfigured: boolean; myobConfigured: boolean }): {
  xero: "ready" | "missing_keys";
  myob: "missing_keys" | "no_handler";
} {
  return {
    xero: status.xeroConfigured ? "ready" : "missing_keys",
    myob: status.myobConfigured ? "no_handler" : "missing_keys",
  };
}
