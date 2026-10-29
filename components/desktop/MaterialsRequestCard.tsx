import React, { useEffect, useMemo, useState } from "react";
import { C, FONT, RADIUS } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import type { StoredDetectedItem } from "../../lib/scanRecord";
import {
  DEFAULT_SUPPLIER_NAME,
  MATERIAL_STATUSES,
  materialsCsv,
  materialsFromTakeoff,
  materialsMailto,
  type MaterialLine,
  type MaterialStatus,
  type MaterialsDraft,
} from "../../lib/materialsRequest";
import { downloadMaterialsPdf } from "../../utils/materialsPdf";
import { fetchWorkspaceSettings } from "../../services/workspaceSettings";

/**
 * The user reviews this list and sends the email themselves.
 * Opening the draft does not mark it sent and does not call a mail API.
 */
export default function MaterialsRequestCard({
  estimateRef,
  jobName,
  siteAddress,
  items,
}: {
  estimateRef: string;
  jobName: string;
  siteAddress: string;
  items: StoredDetectedItem[];
}) {
  const seed = useMemo(() => materialsFromTakeoff(items), [items]);
  const [open, setOpen] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MaterialsDraft>({
    jobName,
    siteAddress,
    requiredBy: "",
    supplierName: DEFAULT_SUPPLIER_NAME,
    supplierEmail: "",
    notes: "",
    lines: seed,
    status: "draft",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceSettings().then(settings => {
      if (cancelled) return;
      setDraft(current => ({
        ...current,
        supplierName: settings.supplierName || DEFAULT_SUPPLIER_NAME,
        supplierEmail: settings.supplierEmail || "",
      }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const mailto = materialsMailto(draft);

  function updateLine(index: number, patch: Partial<MaterialLine>) {
    setDraft(current => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
  }

  async function persist(next: MaterialsDraft, id = requestId) {
    const body = {
      estimate_ref: estimateRef,
      job_name: next.jobName,
      site_address: next.siteAddress,
      required_by: next.requiredBy || null,
      supplier_name: next.supplierName,
      supplier_email: next.supplierEmail,
      notes: next.notes,
      lines: next.lines,
      status: next.status,
    };
    const res = await fetch(id ? `/api/beta/materials?id=${encodeURIComponent(id)}` : "/api/beta/materials", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not save the materials request.");
    if (json.data?.id) setRequestId(json.data.id);
    return json.data;
  }

  async function create() {
    setError(null);
    setOpen(true);
    try {
      await persist(draft, null);
      setMessage("Draft saved. Nothing has been emailed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the materials request.");
    }
  }

  async function saveStatus(status: MaterialStatus) {
    const next = { ...draft, status };
    setDraft(next);
    setError(null);
    try {
      await persist(next);
      setMessage(status === "sent" ? "Marked as sent. ElectraScan did not send the email." : `Status saved: ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the status.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([materialsCsv(draft)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "materials-request.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card style={{ padding: 22, marginTop: 16 }}>
      <h2 style={{ margin: "0 0 8px", fontFamily: FONT.heading, fontSize: 18 }}>Materials request</h2>
      <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
        Built from confirmed counts for {draft.supplierName}. Export it or open a draft email, then send it yourself. ElectraScan never emails the supplier.
      </p>
      {!open ? (
        <PrimaryButton onClick={create}>Create materials request</PrimaryButton>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Job name" value={draft.jobName} onChange={jobNameValue => setDraft({ ...draft, jobName: jobNameValue })} />
          <Field label="Site address" value={draft.siteAddress} onChange={site => setDraft({ ...draft, siteAddress: site })} />
          <label style={{ fontSize: 13, color: C.textMuted }}>
            Required by
            <input type="date" value={draft.requiredBy} onChange={event => setDraft({ ...draft, requiredBy: event.target.value })} style={inputStyle} />
          </label>
          <Field label="Supplier email" value={draft.supplierEmail} onChange={supplierEmail => setDraft({ ...draft, supplierEmail })} />
          <label style={{ fontSize: 13, color: C.textMuted }}>
            Notes
            <textarea value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} style={{ ...inputStyle, minHeight: 72 }} />
          </label>
          <div style={{ overflowX: "auto" }}>
            <table className="es-data-table" style={{ width: "100%", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.textMuted }}>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Brand</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line, index) => (
                  <tr key={`${line.product}-${index}`}>
                    <td data-label="Product">{line.product}</td>
                    <td data-label="Qty">
                      <input aria-label={`Quantity for ${line.product}`} type="number" inputMode="numeric" min={0} value={line.qty} onChange={event => updateLine(index, { qty: Number(event.target.value) })} style={{ ...inputStyle, width: 88 }} />
                    </td>
                    <td data-label="Brand">
                      <input aria-label={`Brand for ${line.product}`} value={line.brand} onChange={event => updateLine(index, { brand: event.target.value })} style={inputStyle} />
                    </td>
                    <td data-label="Notes">
                      <input aria-label={`Notes for ${line.product}`} value={line.notes} onChange={event => updateLine(index, { notes: event.target.value })} style={inputStyle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {draft.lines.length === 0 && <p style={{ color: C.textMuted }}>Confirm detections before building a materials list.</p>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <GhostButton onClick={() => downloadMaterialsPdf(draft)}>Export PDF</GhostButton>
            <GhostButton onClick={downloadCsv}>Export CSV</GhostButton>
            {mailto ? (
              <a href={mailto} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 10, background: C.orange, color: "#fff", fontWeight: 600, textDecoration: "none" }}>
                Review email to {draft.supplierName}
              </a>
            ) : (
              <span style={{ fontSize: 13, color: C.amber }}>Add the supplier email, then open the draft yourself.</span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MATERIAL_STATUSES.map(status => (
              <button
                key={status}
                type="button"
                onClick={() => saveStatus(status)}
                style={{
                  minHeight: 36,
                  borderRadius: 999,
                  padding: "0 12px",
                  border: `1px solid ${draft.status === status ? C.orange : C.border}`,
                  background: draft.status === status ? C.orangeSoft : "#fff",
                  textTransform: "capitalize",
                  fontWeight: 600,
                }}
              >
                {status}
              </button>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: C.textSubtle }}>
            Status on this job: {draft.status}. Lawrence &amp; Hanson prices the list on Vesh&apos;s trade terms. Supplier prices are not stored.
          </p>
        </div>
      )}
      {message && <p style={{ color: C.green, fontSize: 13 }}>{message}</p>}
      {error && <p style={{ color: C.red, fontSize: 13 }}>{error}</p>}
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ fontSize: 13, color: C.textMuted }}>
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} style={inputStyle} />
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 40,
  marginTop: 4,
  borderRadius: RADIUS.md,
  border: `1px solid ${C.border}`,
  padding: "8px 10px",
  font: "inherit",
  color: C.text,
};
