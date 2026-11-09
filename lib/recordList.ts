export type RecordListResult =
  | { ok: true; rows: unknown[]; migration: string | null }
  | { ok: false };

/** GET a beta record list. Logs the server message. Callers show a fixed sentence. */
export async function fetchRecordList(url: string): Promise<RecordListResult> {
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[ElectraScan] list failed", url, res.status, body?.error ?? body);
      return { ok: false };
    }
    return {
      ok: true,
      rows: Array.isArray(body?.data) ? body.data : [],
      migration: typeof body?.migration === "string" ? body.migration : null,
    };
  } catch (err) {
    console.error("[ElectraScan] list failed", url, err);
    return { ok: false };
  }
}
