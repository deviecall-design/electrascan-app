export interface WorkspaceSettings {
  minVerifiedPct: number | null;
  supplierName: string;
  supplierEmail: string;
}

const DEFAULTS: WorkspaceSettings = {
  minVerifiedPct: null,
  supplierName: "Lawrence & Hanson",
  supplierEmail: "",
};

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const res = await fetch("/api/beta/settings");
    if (!res.ok) return DEFAULTS;
    const json = await res.json();
    return {
      minVerifiedPct: typeof json.minVerifiedPct === "number" ? json.minVerifiedPct : null,
      supplierName: json.supplierName || DEFAULTS.supplierName,
      supplierEmail: json.supplierEmail || "",
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveWorkspaceSettings(input: WorkspaceSettings): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/beta/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      minVerifiedPct: input.minVerifiedPct,
      supplierName: input.supplierName,
      supplierEmail: input.supplierEmail,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || "Could not save workspace settings." };
  return { ok: true };
}
