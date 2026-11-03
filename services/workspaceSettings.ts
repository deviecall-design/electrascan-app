import { clampMargin, loadDefaultMargin, saveDefaultMargin } from "../lib/margin";

export interface WorkspaceSettings {
  minVerifiedPct: number | null;
  supplierName: string;
  supplierEmail: string;
  defaultMarginPct: number;
}

const DEFAULTS: WorkspaceSettings = {
  minVerifiedPct: null,
  supplierName: "Lawrence & Hanson",
  supplierEmail: "",
  defaultMarginPct: 15,
};

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const res = await fetch("/api/beta/settings");
    if (!res.ok) return { ...DEFAULTS, defaultMarginPct: loadDefaultMargin() };
    const json = await res.json();
    const stored = typeof json.defaultMarginPct === "number" ? clampMargin(json.defaultMarginPct) : null;
    if (stored != null) saveDefaultMargin(stored);
    return {
      minVerifiedPct: typeof json.minVerifiedPct === "number" ? json.minVerifiedPct : null,
      supplierName: json.supplierName || DEFAULTS.supplierName,
      supplierEmail: json.supplierEmail || "",
      defaultMarginPct: stored ?? loadDefaultMargin(),
    };
  } catch {
    return { ...DEFAULTS, defaultMarginPct: loadDefaultMargin() };
  }
}

export async function saveWorkspaceSettings(input: WorkspaceSettings): Promise<{ ok: boolean; error?: string; marginStored?: boolean }> {
  const defaultMarginPct = saveDefaultMargin(input.defaultMarginPct);
  const res = await fetch("/api/beta/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      minVerifiedPct: input.minVerifiedPct,
      supplierName: input.supplierName,
      supplierEmail: input.supplierEmail,
      defaultMarginPct,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || "Could not save workspace settings. The margin is kept in this browser." };
  return { ok: true, marginStored: json.marginStored !== false };
}
