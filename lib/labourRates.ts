/**
 * A contractor's labour rate card. Roles belong to the workspace.
 * No card means the quote keeps the single electrician rate from assemblies.
 * Example figures are never stored here.
 */

import { matchAssembly, type Assembly } from "./assemblies";

export type LabourChargeType = "hourly" | "minimum" | "callout";

export interface LabourRole {
  id: string;
  name: string;
  /** Always stored ex GST. An inc-GST entry is divided by 1.1 before it is saved. */
  rate: number;
  /** Hourly role, a fixed minimum charge, or a fixed call-out fee. */
  chargeType: LabourChargeType;
  /** Applied only when an hourly share is marked overtime. */
  overtimeMultiplier: number | null;
  isDefault: boolean;
}

export interface LabourShare {
  roleId: string;
  hours: number;
  overtime?: boolean;
}

export interface LabourLine {
  roleId: string;
  roleName: string;
  hours: number;
  rate: number;
  multiplier: number;
  amount: number;
  chargeType: LabourChargeType;
}

const GST = 1.1;

export function exGst(incGstAmount: number): number {
  return round(Math.max(0, incGstAmount) / GST);
}

export function incGst(exGstAmount: number): number {
  return round(Math.max(0, exGstAmount) * GST);
}

export function isHourlyCharge(chargeType: LabourChargeType | undefined): boolean {
  return chargeType !== "minimum" && chargeType !== "callout";
}

const KEY = "es-labour-rates-v1";
export const LABOUR_RATES_MIGRATION = "20261108010000_labour_rate_cards.sql";

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalizeRoles(roles: LabourRole[]): LabourRole[] {
  const clean = roles
    .map(role => ({
      id: (role.id || "").trim() || `role-${Math.random().toString(36).slice(2, 10)}`,
      name: (role.name || "").trim().slice(0, 120),
      rate: round(Math.max(0, Number(role.rate) || 0)),
      chargeType: role.chargeType === "minimum" || role.chargeType === "callout" ? role.chargeType : "hourly",
      overtimeMultiplier: role.overtimeMultiplier && role.overtimeMultiplier > 0 ? round(role.overtimeMultiplier) : null,
      isDefault: Boolean(role.isDefault),
    }))
    .filter(role => role.name);
  const hourly = clean.filter(role => role.chargeType === "hourly");
  if (!clean.some(role => role.isDefault)) {
    const fallback = hourly[0] || clean[0];
    if (fallback) fallback.isDefault = true;
  }
  let seen = false;
  for (const role of clean) {
    if (role.isDefault && !seen) {
      seen = true;
      continue;
    }
    role.isDefault = false;
  }
  return clean;
}

/** A card prices labour only after at least one role has an hourly rate. */
export function activeLabourCard(roles: LabourRole[] | null | undefined): LabourRole[] | null {
  const clean = normalizeRoles(roles || []);
  if (!clean.some(role => role.rate > 0)) return null;
  return clean;
}

export function defaultLabourRole(roles: LabourRole[]): LabourRole | null {
  return roles.find(role => role.isDefault) || roles[0] || null;
}

/** Hourly charge-out used when a logged cost is left blank. A fixed fee is not an hourly rate. */
export function defaultHourlyRole(roles: LabourRole[]): LabourRole | null {
  const hourly = roles.filter(role => isHourlyCharge(role.chargeType));
  return hourly.find(role => role.isDefault) || hourly[0] || null;
}

export function labourCost(input: {
  hours?: number;
  roleId?: string | null;
  mix?: LabourShare[] | null;
  card: LabourRole[] | null;
  fallbackRate: number;
}): { hours: number; amount: number; lines: LabourLine[] } {
  const mix = (input.mix || []).filter(share => share.hours > 0);
  const hours = mix.length
    ? round(mix.reduce((sum, share) => sum + share.hours, 0))
    : round(Math.max(0, input.hours || 0));
  if (!input.card) {
    return { hours, amount: round(hours * Math.max(0, input.fallbackRate)), lines: [] };
  }
  const fallback = defaultLabourRole(input.card);
  const shares: LabourShare[] = mix.length
    ? mix
    : [{ roleId: input.roleId || fallback?.id || "", hours }];
  const lines: LabourLine[] = [];
  for (const share of shares) {
    const role = input.card.find(item => item.id === share.roleId) || fallback;
    if (!role || !(role.rate > 0)) continue;
    if (!isHourlyCharge(role.chargeType)) {
      lines.push({
        roleId: role.id,
        roleName: role.name,
        hours: 0,
        rate: role.rate,
        multiplier: 1,
        amount: role.rate,
        chargeType: role.chargeType,
      });
      continue;
    }
    if (!(share.hours > 0)) continue;
    const multiplier = share.overtime && role.overtimeMultiplier ? role.overtimeMultiplier : 1;
    lines.push({
      roleId: role.id,
      roleName: role.name,
      hours: round(share.hours),
      rate: role.rate,
      multiplier,
      amount: round(share.hours * role.rate * multiplier),
      chargeType: "hourly",
    });
  }
  return {
    hours: round(lines.reduce((sum, line) => sum + line.hours, 0)),
    amount: round(lines.reduce((sum, line) => sum + line.amount, 0)),
    lines,
  };
}

export function sumLabourByRole(rows: LabourLine[]): LabourLine[] {
  const byRole = new Map<string, LabourLine>();
  for (const row of rows) {
    const key = `${row.roleId}:${row.multiplier}`;
    const existing = byRole.get(key);
    if (!existing) {
      byRole.set(key, { ...row });
      continue;
    }
    existing.hours = round(existing.hours + row.hours);
    existing.amount = round(existing.amount + row.amount);
  }
  return [...byRole.values()];
}

export function labourForItem(
  item: { symbol?: string; desc?: string; detectedType?: string; group?: string; category?: string },
  assemblies: Assembly[],
  card: LabourRole[] | null,
  fallbackRate: number,
): { hours: number; amount: number; lines: LabourLine[] } {
  const assembly = matchAssembly(item, assemblies);
  if (!assembly) return { hours: 0, amount: 0, lines: [] };
  return labourCost({
    hours: assembly.labourHours,
    roleId: assembly.labourRoleId,
    mix: assembly.labourMix,
    card,
    fallbackRate,
  });
}

export function labourNote(lines: LabourLine[]): string {
  return lines
    .map(line => {
      const inc = incGst(line.rate).toFixed(2);
      const ex = line.rate.toFixed(2);
      if (!isHourlyCharge(line.chargeType)) {
        const kind = line.chargeType === "callout" ? "call-out" : "minimum charge";
        return `${line.roleName} ${kind} $${ex} ex GST ($${inc} inc GST)`;
      }
      return `${line.hours} h × ${line.roleName}${line.multiplier !== 1 ? ` × ${line.multiplier}` : ""} @ $${ex}/h ex GST ($${inc} inc GST)`;
    })
    .join(" · ");
}

function csvCells(line: string): string[] {
  return line.split(",").map(cell => cell.trim().replace(/^"|"$/g, ""));
}

function chargeTypeFrom(value: string): LabourChargeType {
  const text = value.toLowerCase();
  if (text.includes("min")) return "minimum";
  if (text.includes("call")) return "callout";
  return "hourly";
}

function enteredIncGst(value: string): boolean {
  const text = value.toLowerCase().replace(/\s+/g, " ");
  if (!text || text.startsWith("ex")) return false;
  return text.includes("inc") || text === "gst";
}

/**
 * CSV columns: role, rate, GST (inc or ex), charge (hourly, minimum, callout),
 * overtime multiplier, default. A missing GST column means the rate is already ex GST.
 * The sample at docs/samples/vesh-rate-card.csv is not loaded by the app.
 */
export function parseLabourCsv(text: string): { roles: LabourRole[]; error: string | null } {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  if (lines.length === 0) return { roles: [], error: "The file has no rows." };
  const headerCells = csvCells(lines[0]).map(cell => cell.toLowerCase());
  const named = headerCells.some(cell => cell === "role" || cell === "name" || cell === "rate" || cell.includes("gst") || cell === "charge");
  const index = (names: string[], fallback: number) => {
    const found = headerCells.findIndex(cell => names.includes(cell));
    return found >= 0 ? found : fallback;
  };
  const nameAt = named ? index(["role", "name"], 0) : 0;
  const rateAt = named ? index(["rate", "hourly rate", "amount"], 1) : 1;
  const gstAt = named ? headerCells.findIndex(cell => cell === "gst" || cell.includes("gst")) : -1;
  const chargeAt = named ? headerCells.findIndex(cell => cell === "charge" || cell === "type") : -1;
  const overtimeAt = named ? headerCells.findIndex(cell => cell.includes("overtime")) : 2;
  const defaultAt = named ? headerCells.findIndex(cell => cell === "default") : 3;
  const roles: LabourRole[] = [];
  for (const line of lines.slice(named ? 1 : 0)) {
    const cells = csvCells(line);
    const name = cells[nameAt] || "";
    const entered = Number(String(cells[rateAt] || "").replace(/[^0-9.]/g, ""));
    const inc = gstAt >= 0 && enteredIncGst(cells[gstAt] || "");
    const rate = inc ? exGst(entered) : round(Math.max(0, entered));
    const overtime = Number(overtimeAt >= 0 ? cells[overtimeAt] : "");
    const isDefault = defaultAt >= 0 && /^(y|yes|true|1|default)$/i.test(cells[defaultAt] || "");
    if (!name || !(rate > 0)) continue;
    roles.push({
      id: `role-${roles.length + 1}`,
      name,
      rate,
      chargeType: chargeAt >= 0 ? chargeTypeFrom(cells[chargeAt] || "") : "hourly",
      overtimeMultiplier: overtime > 0 ? overtime : null,
      isDefault,
    });
  }
  if (roles.length === 0) return { roles: [], error: "No roles with a name and a rate were found." };
  return { roles: normalizeRoles(roles), error: null };
}

export function loadLabourCard(): LabourRole[] | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    return activeLabourCard(Array.isArray(parsed) ? parsed : parsed?.roles);
  } catch {
    return null;
  }
}

export function saveLabourCard(roles: LabourRole[]) {
  const clean = normalizeRoles(roles);
  localStorage.setItem(KEY, JSON.stringify(clean));
}

export async function fetchLabourCard(): Promise<{ roles: LabourRole[]; migration: boolean }> {
  try {
    const res = await fetch("/api/beta/records?kind=labour");
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.migration) return { roles: loadLabourCard() || [], migration: true };
    const latest = Array.isArray(json.data) ? json.data[0] : null;
    const remote = activeLabourCard(latest?.roles);
    if (remote) {
      saveLabourCard(remote);
      return { roles: remote, migration: false };
    }
  } catch {
    /* keep the browser copy */
  }
  return { roles: loadLabourCard() || [], migration: false };
}

export async function storeLabourCard(roles: LabourRole[]): Promise<{ stored: "remote" | "local"; message: string }> {
  const clean = normalizeRoles(roles);
  saveLabourCard(clean);
  try {
    const res = await fetch("/api/beta/records?kind=labour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles: clean, updated_at: new Date().toISOString() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { stored: "local", message: json.error || `Saved in this browser. Apply ${LABOUR_RATES_MIGRATION} to share it.` };
    }
    return { stored: "remote", message: "Labour rates saved for this workspace." };
  } catch {
    return { stored: "local", message: "Saved in this browser. These rates will be used on this device." };
  }
}
