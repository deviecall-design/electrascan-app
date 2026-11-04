/**
 * Parse a contractor's own supplier price file.
 * ElectraScan does not ship a supplier catalogue. The file belongs to the workspace.
 */

import type { Assembly } from "./assemblies";

export interface ParsedPriceRow {
  code: string;
  description: string;
  unit: string;
  cost: number;
}

export interface ReviewedPriceRow extends ParsedPriceRow {
  assemblyId: string | null;
  assemblyName: string | null;
  score: number;
  band: "matched" | "review";
  decision: "assembly" | "code" | "skip";
}

export interface StoredContractorPrice {
  code: string;
  description: string;
  unit: string;
  cost: number;
  assemblyId: string | null;
}

function norm(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseCost(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (quoted && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function delimiterOf(header: string): string {
  const counts = [
    ["\t", (header.match(/\t/g) || []).length],
    [";", (header.match(/;/g) || []).length],
    ["|", (header.match(/\|/g) || []).length],
    [",", (header.match(/,/g) || []).length],
  ] as const;
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts.sort((a, b) => b[1] - a[1])[0][0] : ",";
}

function headerIndex(cells: string[], patterns: RegExp[]): number {
  return cells.findIndex(cell => patterns.some(pattern => pattern.test(cell.trim().toLowerCase())));
}

function rowsFromTable(text: string): ParsedPriceRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = delimiterOf(lines[0]);
  const table = lines.map(line => splitRow(line, delimiter));
  const header = table[0].map(cell => cell.toLowerCase());
  const codeAt = headerIndex(header, [/code/, /sku/, /item no/, /product id/]);
  const descAt = headerIndex(header, [/description/, /desc/, /^name$/, /product name/, /item name/]);
  const unitAt = headerIndex(header, [/unit/, /uom/, /u\/m/]);
  const costAt = headerIndex(header, [/cost/, /price/, /nett/, /net/, /amount/, /rate/]);
  const hasHeader = codeAt >= 0 || descAt >= 0 || costAt >= 0;
  const body = hasHeader ? table.slice(1) : table;
  const rows: ParsedPriceRow[] = [];
  for (const cells of body) {
    const code = (codeAt >= 0 ? cells[codeAt] : cells[0] || "").trim();
    const description = (descAt >= 0 ? cells[descAt] : cells[1] || "").trim();
    const unit = (unitAt >= 0 ? cells[unitAt] : "ea").trim() || "ea";
    const cost = parseCost(costAt >= 0 ? cells[costAt] || "" : cells[cells.length - 1] || "");
    if ((!code && !description) || cost == null) continue;
    rows.push({ code, description: description || code, unit, cost });
  }
  return rows;
}

function textOf(node: Element, names: string[]): string {
  const attr = names.map(name => node.getAttribute(name)).find(Boolean);
  if (attr) return attr.trim();
  for (const child of [...node.children]) {
    if (names.includes(child.tagName.toLowerCase())) return (child.textContent || "").trim();
  }
  return "";
}

function rowsFromXml(text: string): ParsedPriceRow[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) return [];
  const rows: ParsedPriceRow[] = [];
  for (const node of [...doc.getElementsByTagName("*")]) {
    const code = textOf(node, ["code", "sku", "productcode", "itemcode"]);
    const description = textOf(node, ["description", "desc", "name", "productname"]);
    const unit = textOf(node, ["unit", "uom"]) || "ea";
    const cost = parseCost(textOf(node, ["cost", "price", "nett", "net", "amount"]));
    if ((!code && !description) || cost == null) continue;
    if (node.children.length === 0 && !node.getAttribute("code") && !node.getAttribute("description") && !node.getAttribute("cost")) continue;
    rows.push({ code, description: description || code, unit, cost });
  }
  return rows;
}

export function parsePriceFile(text: string, fileName = ""): { rows: ParsedPriceRow[]; error: string | null } {
  const source = text.replace(/^\uFEFF/, "").trim();
  if (!source) return { rows: [], error: "That file is empty." };
  if (source.length > 2_000_000) return { rows: [], error: "That file is too large to import." };
  const xml = fileName.toLowerCase().endsWith(".xml") || source.startsWith("<");
  const rows = (xml ? rowsFromXml(source) : rowsFromTable(source)).slice(0, 5000);
  if (rows.length === 0) {
    return { rows: [], error: "No prices found. Use columns for code, description, unit, and cost." };
  }
  return { rows, error: null };
}

export function reviewPriceRows(
  rows: ParsedPriceRow[],
  assemblies: Assembly[],
  rateCodes: string[] = [],
): ReviewedPriceRow[] {
  const codes = new Set(rateCodes.map(code => code.trim().toLowerCase()).filter(Boolean));
  return rows.map(row => {
    const code = row.code.trim().toLowerCase();
    const description = norm(row.description);
    let best: { assembly: Assembly; score: number } | null = null;
    for (const assembly of assemblies) {
      const name = norm(assembly.name);
      let score = 0;
      if (code && (code === assembly.id.toLowerCase() || assembly.symbols.some(symbol => symbol.toLowerCase() === code))) score = 0.95;
      if (description && name && description === name) score = Math.max(score, 0.95);
      for (const keyword of assembly.keywords) {
        const word = norm(keyword);
        if (word.length < 4 || !description.includes(word)) continue;
        score = Math.max(score, Math.min(0.9, 0.45 + word.length / 20));
      }
      if (name && description && (description.includes(name) || name.includes(description)) && name.length >= 4) {
        score = Math.max(score, 0.8);
      }
      if (!best || score > best.score) best = { assembly, score };
    }
    const rateHit = code !== "" && codes.has(code);
    const score = Math.max(best?.score ?? 0, rateHit ? 0.9 : 0);
    const assembly = best && best.score >= 0.72 ? best.assembly : null;
    const band = score >= 0.72 ? "matched" : "review";
    const decision = assembly ? "assembly" : score >= 0.72 ? "code" : "code";
    return {
      ...row,
      assemblyId: assembly?.id ?? null,
      assemblyName: assembly?.name ?? null,
      score,
      band,
      decision: band === "review" ? "code" : decision,
    };
  });
}

export function acceptedPrices(rows: ReviewedPriceRow[]): StoredContractorPrice[] {
  return rows
    .filter(row => row.decision !== "skip" && row.cost > 0 && (row.code.trim() || row.description.trim()))
    .map(row => ({
      code: row.code.trim(),
      description: row.description.trim(),
      unit: row.unit.trim() || "ea",
      cost: row.cost,
      assemblyId: row.decision === "assembly" ? row.assemblyId : null,
    }));
}
