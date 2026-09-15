/**
 * Persist a Quote-step estimate so Dashboard / Estimates can show it.
 *
 * Live bug: StepQuote never called insertEstimate / /api/estimates/create,
 * so a Sirius quote could not appear in pending value.
 *
 * `value` is the GST-inclusive quoted total (see lib/estimateMoney.ts).
 */

import { supabase } from "./supabaseClient";
import { quotePersistFields } from "../lib/estimateMoney";
import { updateScan } from "./supabaseData";
import { getCurrentTenantId } from "../lib/tenants";

export interface PersistQuoteInput {
  client: string;
  projectName?: string | null;
  drawingFile?: string | null;
  subtotal: number;
  marginPct: number;
  lineItems: unknown[];
  status: "draft" | "sent";
  scanId?: string | null;
}

export type PersistQuoteResult =
  | { ok: true; reference: string }
  | { ok: false; error: string };

export async function persistQuoteFromScan(
  input: PersistQuoteInput,
): Promise<PersistQuoteResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return {
      ok: false,
      error: "Sign in to save this quote so it appears on the Dashboard.",
    };
  }

  const money = quotePersistFields(input.subtotal, input.marginPct);
  const tenantId = await getCurrentTenantId();
  const body = {
    client: (input.client || "").trim() || "Client not set",
    project_name: input.projectName ?? null,
    drawing_file: input.drawingFile ?? null,
    status: input.status,
    line_items: input.lineItems,
    days_since_sent: 0,
    tenant_id: tenantId,
    ...money,
  };

  let res: Response;
  try {
    res = await fetch("/api/estimates/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "Could not reach the estimate API." };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof json?.error === "string" ? json.error : `HTTP ${res.status}`;
    return { ok: false, error: detail };
  }

  const reference: string =
    json.reference || json.estimate?.reference || json.estimate?.ref;
  if (!reference) {
    return { ok: false, error: "Estimate saved but no reference was returned." };
  }

  if (input.scanId && input.scanId !== "new") {
    try {
      await updateScan(input.scanId, { estimate_ref: reference });
    } catch {
      // Quote is saved; linking the scan is best-effort for scan-to-quote KPI.
    }
  }

  return { ok: true, reference };
}
