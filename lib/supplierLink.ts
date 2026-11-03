/**
 * A supplier prices one materials request through a token link.
 * Prices stay on that request. Nothing here is a supplier catalogue.
 */

export const SUPPLIERS = ["Lawrence & Hanson", "Middy's", "Rexel", "MMEM"] as const;

export interface SupplierRequestLine {
  product: string;
  qty: number;
  unit: string;
}

export interface SupplierSubmission {
  product: string;
  qty: number;
  unitPrice: number;
  availability: string;
}

export interface PricedRequestLine extends SupplierRequestLine {
  supplierUnitPrice?: number;
  availability?: string;
}

export function newSupplierToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function supplierPath(token: string): string {
  return `/supplier/${token}`;
}

export function parseSupplierCsv(text: string): SupplierSubmission[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase();
  const start = header.includes("product") ? 1 : 0;
  const rows: SupplierSubmission[] = [];
  for (const line of lines.slice(start)) {
    const cells = line.split(",").map(cell => cell.trim().replace(/^"|"$/g, ""));
    const product = cells[0] || "";
    const qty = Number(cells[1]);
    const unitPrice = Number(cells[2]);
    const availability = cells[3] || "";
    if (!product || !(qty >= 0) || !(unitPrice >= 0)) continue;
    rows.push({ product, qty, unitPrice, availability });
  }
  return rows;
}

/** Copy prices onto the lines that were requested. Extra rows are dropped. */
export function applySupplierPrices(lines: SupplierRequestLine[], submitted: SupplierSubmission[]): PricedRequestLine[] {
  return lines.map(line => {
    const hit = submitted.find(row => row.product.trim().toLowerCase() === line.product.trim().toLowerCase());
    if (!hit) return { ...line };
    return {
      product: line.product,
      qty: line.qty,
      unit: line.unit,
      supplierUnitPrice: hit.unitPrice,
      availability: hit.availability,
    };
  });
}
