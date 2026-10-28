import React, { useEffect, useMemo, useState } from "react";
import { FileDown, Send } from "lucide-react";
import { C, FONT, RADIUS } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import { fetchRateLibrary, type RateRow } from "../../services/supabaseData";
import { persistQuoteFromScan } from "../../services/persistQuote";
import { downloadEstimatePDF } from "../../utils/estimatePdf";
import { getActiveCompanyProfile } from "../../services/companyProfile";
import { computeQuoteTotals, formatAud } from "../../lib/quoteTotals";
import {
  GROUP_LABEL,
  billableItems,
  costSplit,
  formatVerified,
  groupForItem,
  verifiedPercent,
  type RateLike,
} from "../../lib/takeoff";
import type { StoredDetectedItem } from "../../lib/scanRecord";
import {
  DEFAULT_SUPPLIER_NAME,
  materialsCsv,
  materialsMailto,
  type MaterialLine,
  type MaterialStatus,
} from "../../lib/materialsRequest";
import { downloadMaterialsPdf } from "../../utils/materialsPdf";
import { fetchWorkspaceSettings } from "../../services/workspaceSettings";

interface Props {
  items: StoredDetectedItem[];
  reference?: string | null;
  jobName: string;
  siteAddress: string;
  clientName?: string;
  drawingFile?: string;
  scanId?: string;
  marginPct: number;
  minVerifiedPct: number | null;
  onBack: () => void;
  onSaved: (reference: string) => void;
}

interface OrderLine {
  description: string;
  category: string;
  qty: number;
  materialUnit: number;
  labourUnit: number;
}

function orderLines(items: StoredDetectedItem[], rates: RateLike[]): { lines: OrderLine[]; usingDetected: boolean } {
  const confirmed = items.filter(item => (item.status === "confirmed" || item.status === "added") && item.qty > 0);
  const source = confirmed.length > 0 ? confirmed : billableItems(items);
  return {
    usingDetected: confirmed.length === 0 && source.length > 0,
    lines: source.map(item => {
      const split = costSplit(item, rates);
      return {
        description: item.desc || "Item",
        category: item.category || GROUP_LABEL[groupForItem(item)],
        qty: item.qty,
        materialUnit: split.material,
        labourUnit: split.labour,
      };
    }),
  };
}

export default function SignOrderStep({
  items,
  reference,
  jobName,
  siteAddress,
  clientName,
  drawingFile,
  scanId,
  marginPct,
  minVerifiedPct,
  onBack,
  onSaved,
}: Props) {
  const company = getActiveCompanyProfile();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [quoteRef, setQuoteRef] = useState(reference || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docusignReady, setDocusignReady] = useState(false);
  const [docusignMissing, setDocusignMissing] = useState<string[]>(["DOCUSIGN_PRIVATE_KEY"]);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [supplierEmail, setSupplierEmail] = useState("");
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>([]);
  const [materialStatus, setMaterialStatus] = useState<MaterialStatus>("draft");

  useEffect(() => {
    setQuoteRef(reference || "");
  }, [reference]);

  useEffect(() => {
    let cancelled = false;
    fetchRateLibrary().then(result => {
      if (!cancelled && Array.isArray(result?.data)) setRates(result.data as RateRow[]);
    }).catch(() => undefined);
    fetch("/api/integrations/status").then(res => res.json()).then(json => {
      if (cancelled || !json?.docusign) return;
      setDocusignReady(Boolean(json.docusign.configured));
      setDocusignMissing(json.docusign.missing || []);
    }).catch(() => undefined);
    fetchWorkspaceSettings().then(settings => {
      if (!cancelled) setSupplierEmail(settings.supplierEmail || "");
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const priced = useMemo(() => orderLines(items, rates), [items, rates]);
  const groups = useMemo(() => {
    const map = new Map<string, OrderLine[]>();
    for (const line of priced.lines) {
      const list = map.get(line.category) ?? [];
      list.push(line);
      map.set(line.category, list);
    }
    return [...map.entries()].map(([category, lines]) => ({
      category,
      lines,
      materials: lines.reduce((sum, line) => sum + line.qty * line.materialUnit, 0),
      labour: lines.reduce((sum, line) => sum + line.qty * line.labourUnit, 0),
    }));
  }, [priced.lines]);

  const materialsSub = groups.reduce((sum, group) => sum + group.materials, 0);
  const labourSub = groups.reduce((sum, group) => sum + group.labour, 0);
  const subtotal = materialsSub + labourSub;
  const totals = computeQuoteTotals(subtotal, marginPct);
  const verified = verifiedPercent(items);
  const verifiedLabel = formatVerified(items);
  const belowMinimum = minVerifiedPct != null && verified < minVerifiedPct;

  useEffect(() => {
    setMaterialLines(priced.lines.map(line => ({
      product: line.description,
      qty: line.qty,
      brand: "",
      unit: "ea",
      notes: "",
    })));
  }, [priced.lines]);

  const materialCost = new Map(priced.lines.map(line => [line.description, line.materialUnit]));

  async function saveQuote() {
    if (priced.lines.length === 0) {
      setSaveError("There are no lines to save.");
      return;
    }
    if (belowMinimum) {
      setSaveError(`This workspace requires ${minVerifiedPct}% verified before a quote can be saved.`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await persistQuoteFromScan({
      client: clientName || jobName || "Client not set",
      projectName: jobName,
      drawingFile: drawingFile ?? null,
      subtotal: totals.subtotal,
      marginPct,
      lineItems: [
        ...priced.lines.map(line => ({
          description: line.description,
          category: line.category,
          qty: line.qty,
          unitPrice: line.materialUnit + line.labourUnit,
          materialUnit: line.materialUnit,
          labourUnit: line.labourUnit,
        })),
        { description: "Takeoff verified", qty: 0, unitPrice: 0, meta: "takeoff", verifiedPct: verified },
      ],
      status: "sent",
      scanId,
      verifiedPct: verified,
    });
    setSaving(false);
    if (result.ok === false) {
      setSaveError(result.error);
      return;
    }
    setQuoteRef(result.reference);
    onSaved(result.reference);
  }

  async function downloadQuote() {
    setPdfBusy(true);
    try {
      await downloadEstimatePDF({
        company,
        estimateNumber: quoteRef || "EST-DRAFT",
        date: new Date().toLocaleDateString("en-AU"),
        drawingFile,
        projectName: jobName || "Electrical estimate",
        clientName,
        items: priced.lines.map(line => ({
          description: line.description,
          qty: line.qty,
          unitPrice: line.materialUnit + line.labourUnit,
        })),
        marginPercent: marginPct,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function sendForSignature() {
    if (!quoteRef) {
      setSignError("Save the quote first, then send it for signature.");
      return;
    }
    if (!signerName.trim() || !signerEmail.trim()) {
      setSignError("Signer name and email are required.");
      return;
    }
    setSending(true);
    setSignError(null);
    try {
      const res = await fetch("/api/docusign/envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerEmail: signerEmail.trim(),
          signerName: signerName.trim(),
          estimateRef: quoteRef,
          projectName: jobName,
          estimateValue: totals.total,
          documentBase64: "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "DocuSign did not send the envelope.");
      setEnvelopeId(json.envelopeId || "sent");
    } catch (err) {
      setSignError(err instanceof Error ? err.message : "Could not send for signature.");
    } finally {
      setSending(false);
    }
  }

  const mailto = materialsMailto({
    jobName,
    siteAddress,
    requiredBy: "",
    supplierName: DEFAULT_SUPPLIER_NAME,
    supplierEmail,
    notes: "Estimated from our rate library. Please price on our trade terms.",
    lines: materialLines,
    status: materialStatus,
  });

  return (
    <div className="es-split anim-in">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontFamily: FONT.heading, fontSize: 20 }}>Quote breakdown</h2>
            <strong style={{ color: C.orange }}>{verifiedLabel}</strong>
          </div>
          {priced.usingDetected && (
            <p style={{ color: C.amber, fontSize: 14 }}>No lines are confirmed yet. Showing the detected counts. Confirm them on review when you can.</p>
          )}
          {groups.map(group => (
            <section key={group.category} style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>{group.category}</span>
                <span style={{ fontFamily: FONT.mono }}>{formatAud(group.materials + group.labour, true)}</span>
              </div>
              {group.lines.map(line => (
                <div key={line.description} className="es-sign-line" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) repeat(3, minmax(72px, auto))", gap: 8, padding: "10px 0", borderTop: `1px solid ${C.border}`, fontSize: 14 }}>
                  <span>{line.description}</span>
                  <span style={{ fontFamily: FONT.mono }}>{line.qty}</span>
                  <span style={{ fontFamily: FONT.mono }}>Labour {formatAud(line.qty * line.labourUnit, true)}</span>
                  <span style={{ fontFamily: FONT.mono }}>Materials {formatAud(line.qty * line.materialUnit, true)}</span>
                </div>
              ))}
            </section>
          ))}
          {groups.length === 0 && <p style={{ color: C.textMuted }}>This scan has no priced lines yet.</p>}
          <div style={{ marginTop: 16, borderTop: `2px solid ${C.text}`, paddingTop: 10 }}>
            <Money label="Materials" value={materialsSub} />
            <Money label="Labour" value={labourSub} />
            <Money label="Subtotal ex GST" value={totals.subtotal} />
            <Money label={`Margin (${totals.marginPct}%)`} value={totals.marginAmount} />
            <Money label={`GST (${totals.gstRatePct}%)`} value={totals.gst} />
            <Money label="Total inc GST" value={totals.total} strong />
          </div>
        </Card>

        <Card style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 8px", fontFamily: FONT.heading, fontSize: 18 }}>Materials</h2>
          <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
            Products and quantities for {DEFAULT_SUPPLIER_NAME}. The cost is our rate-library estimate. {DEFAULT_SUPPLIER_NAME} prices it on trade terms. Nothing is emailed until you send the draft yourself.
          </p>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Estimated materials {formatAud(materialLines.reduce((sum, line) => sum + line.qty * (materialCost.get(line.product) || 0), 0), true)}</div>
          {materialLines.map((line, index) => (
            <div key={`${line.product}-${index}`} className="es-sign-line" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) 88px minmax(100px, 1fr) minmax(100px, 1fr)", gap: 8, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
              <span>
                {line.product}
                <span style={{ display: "block", color: C.textMuted, fontSize: 12 }}>{formatAud((materialCost.get(line.product) || 0) * line.qty, true)}</span>
              </span>
              <input aria-label={`Quantity for ${line.product}`} inputMode="numeric" value={line.qty} onChange={event => updateMaterial(index, { qty: Number(event.target.value) || 0 })} style={inputStyle} />
              <input aria-label={`Brand for ${line.product}`} value={line.brand} placeholder="Brand" onChange={event => updateMaterial(index, { brand: event.target.value })} style={inputStyle} />
              <input aria-label={`Notes for ${line.product}`} value={line.notes} placeholder="Notes" onChange={event => updateMaterial(index, { notes: event.target.value })} style={inputStyle} />
            </div>
          ))}
          <label style={{ display: "block", marginTop: 12, fontSize: 13, color: C.textMuted }}>
            Supplier email
            <input aria-label="Supplier email" type="email" value={supplierEmail} placeholder="orders@lawrenceandhanson.com.au" onChange={event => setSupplierEmail(event.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
          </label>
          <p style={{ fontSize: 13, color: C.textMuted }}>Materials request: {materialStatus}. Signature: {envelopeId ? `sent ${envelopeId}` : "not sent"}.</p>
          {materialsOpen && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <GhostButton onClick={() => downloadMaterialsPdf({
                jobName, siteAddress, requiredBy: "", supplierName: DEFAULT_SUPPLIER_NAME, supplierEmail, notes: "", lines: materialLines, status: materialStatus,
              })}>Export PDF</GhostButton>
              <GhostButton onClick={() => downloadCsv(materialLines, jobName, siteAddress)}>Export CSV</GhostButton>
              {mailto ? (
                <a href={mailto} onClick={() => setMaterialStatus("draft")} style={linkButton}>Open email draft</a>
              ) : (
                <span style={{ color: C.amber, fontSize: 14 }}>Add the supplier email, then open the draft yourself.</span>
              )}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>Total inc GST</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 32, fontWeight: 700 }}>${formatAud(totals.total, true)}</div>
          <div style={{ color: C.orange, fontWeight: 600, marginTop: 6 }}>{verifiedLabel}</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>Quote {quoteRef || "not saved yet"}</div>
        </Card>
        {!quoteRef && (
          <PrimaryButton onClick={saveQuote} disabled={saving || priced.lines.length === 0 || belowMinimum}>
            {saving ? "Saving…" : "Save quote"}
          </PrimaryButton>
        )}
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Signer name
          <input aria-label="Signer name" value={signerName} onChange={event => setSignerName(event.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Signer email
          <input aria-label="Signer email" type="email" inputMode="email" value={signerEmail} onChange={event => setSignerEmail(event.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
        </label>
        <PrimaryButton icon={<Send size={16} />} onClick={sendForSignature} disabled={!docusignReady || !quoteRef || sending || Boolean(envelopeId)}>
          {envelopeId ? "Signature sent" : sending ? "Sending…" : "Send for signature"}
        </PrimaryButton>
        {!docusignReady && (
          <p style={{ margin: 0, color: C.amber, fontSize: 13 }}>Send for signature needs {docusignMissing.join(", ") || "DOCUSIGN_PRIVATE_KEY"} on Vercel. The button stays off until then.</p>
        )}
        {!quoteRef && docusignReady && (
          <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>Save the quote, then send it for signature.</p>
        )}
        {signError && <p style={{ margin: 0, color: C.red, fontSize: 13 }}>{signError}</p>}
        <GhostButton onClick={() => setMaterialsOpen(true)}>Send materials to supplier</GhostButton>
        <GhostButton icon={<FileDown size={16} />} onClick={downloadQuote} disabled={pdfBusy || priced.lines.length === 0}>
          {pdfBusy ? "Preparing PDF…" : "Download quote PDF"}
        </GhostButton>
        <GhostButton onClick={onBack}>Back to price & send</GhostButton>
        {saveError && <p style={{ margin: 0, color: C.red, fontSize: 13 }}>{saveError}</p>}
        {belowMinimum && <p style={{ margin: 0, color: C.amber, fontSize: 13 }}>Verified takeoff is {verified}%. This workspace asks for {minVerifiedPct}% before saving.</p>}
      </div>
    </div>
  );

  function updateMaterial(index: number, patch: Partial<MaterialLine>) {
    setMaterialLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
}

function downloadCsv(lines: MaterialLine[], jobName: string, siteAddress: string) {
  const blob = new Blob([materialsCsv({ jobName, siteAddress, requiredBy: "", lines })], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "materials-request.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: strong ? 700 : 500 }}>
      <span>{label}</span>
      <span style={{ fontFamily: FONT.mono }}>${formatAud(value, true)}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: RADIUS.md,
  border: `1px solid ${C.border}`,
  padding: "8px 10px",
  background: C.bg,
  color: C.text,
  fontSize: 16,
  boxSizing: "border-box",
};

const linkButton: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  borderRadius: 12,
  background: C.orange,
  color: "#fff",
  fontWeight: 600,
  textDecoration: "none",
};
