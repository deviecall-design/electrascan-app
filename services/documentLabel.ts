import { rememberDocumentLabel } from "../lib/documentLabel";

export async function saveDocumentLabel(input: {
  label: string;
  reference?: string | null;
  estimateId?: string | null;
  scanId?: string | null;
}): Promise<{ where: "database" | "browser" }> {
  const label = input.label.trim().slice(0, 200);
  if (input.reference) rememberDocumentLabel(`ref:${input.reference}`, label);
  if (input.scanId && input.scanId !== "new") rememberDocumentLabel(`scan:${input.scanId}`, label);

  let where: "database" | "browser" = "browser";
  if (input.reference || input.estimateId) {
    const params = new URLSearchParams();
    if (input.reference) params.set("reference", input.reference);
    if (input.estimateId) params.set("id", input.estimateId);
    const saved = await patch(`/api/beta/estimates?${params}`, { display_label: label });
    if (saved === "database") where = "database";
  }
  if (input.scanId && input.scanId !== "new") {
    const saved = await patch(`/api/beta/scans?id=${encodeURIComponent(input.scanId)}`, { display_label: label });
    if (saved === "database") where = "database";
  }
  return { where };
}

async function patch(url: string, body: { display_label: string }): Promise<"database" | "browser" | "failed"> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return "failed";
    return json.stored === "browser" ? "browser" : "database";
  } catch {
    return "failed";
  }
}
