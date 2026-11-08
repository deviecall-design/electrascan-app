import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchRateLibrary, fetchScans, insertScan } from "../services/supabaseData";
import { detectElectricalComponents } from "../analyze_pdf";
import { mapDetectionToQuoteItems } from "../lib/scanQuote";
import { buildScanWrite, type StoredDetectedItem } from "../lib/scanRecord";
import { publicDetectionFailure } from "../lib/detectionCopy";
import { costSplit, type RateLike } from "../lib/takeoff";
import {
  linesFromDetected,
  variationChain,
  variationProjectKey,
  type VariationLine,
} from "../lib/variationDiff";
import { formatQuotedValue } from "../lib/estimateMoney";
import { formatGstMoney } from "../lib/estimateTotal";
import { roundCents } from "../lib/quoteTotals";
import { draftInvoice, toMyobCsv, toXeroCsv } from "../lib/invoiceExport";
import QueryBanner from "../components/QueryBanner";

const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  added: { bg: C.greenSoft, fg: C.green, label: "Added" },
  removed: { bg: C.redSoft, fg: C.red, label: "Removed" },
  increased: { bg: C.amberSoft, fg: C.amber, label: "Changed" },
  decreased: { bg: C.amberSoft, fg: C.amber, label: "Changed" },
};

interface ChainScan {
  id: string;
  file_name?: string;
  client?: string | null;
  revision_of?: string | null;
  started_at?: string | null;
  detected_items?: unknown;
}

function signedMoney(amount: number) {
  return `${amount < 0 ? "−" : "+"}${formatQuotedValue(Math.abs(amount))}`;
}

function signedGst(amount: number) {
  return `${amount < 0 ? "−" : "+"}${formatGstMoney(Math.abs(amount), "ex")}`;
}

export default function VariationReportScreen() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: rates } = useSupabaseQuery(fetchRateLibrary);
  const [project, setProject] = useState<string | null>(null);
  const [addedScans, setAddedScans] = useState<ChainScan[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const rateRows = rates as RateLike[];
  const known = scans.filter((scan: { detected_items?: unknown }) => linesFromDetected(scan.detected_items).length > 0);
  const pool: ChainScan[] = [...known, ...addedScans];
  const projectKeys = [...new Set(pool.map(scan => variationProjectKey(scan)))];
  const newest = [...pool].sort((a, b) => Date.parse(a.started_at || "") - Date.parse(b.started_at || "")).at(-1);
  const activeKey = project && projectKeys.includes(project) ? project : (newest ? variationProjectKey(newest) : "unassigned");
  const versions = variationChain(pool, activeKey, rateRows);
  const latest = versions.length > 1 ? versions[versions.length - 1] : null;
  const materialNet = latest ? latest.changes.reduce((sum, line) => sum + line.materialDelta, 0) : 0;
  const labourNet = latest ? latest.changes.reduce((sum, line) => sum + line.labourDelta, 0) : 0;

  async function onRevisedPlan(file: File) {
    const base = versions[versions.length - 1]?.scan;
    if (!base) {
      setUploadError("Save a scan before comparing a revised plan.");
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const detected = await detectElectricalComponents(file, "001");
      const items: StoredDetectedItem[] = mapDetectionToQuoteItems(detected.components).map(item => {
        const draft: StoredDetectedItem = {
          ...item,
          status: "ai",
          materialUnit: typeof item.unitPrice === "number" ? item.unitPrice : 0,
          labourUnit: 0,
        };
        const labour = rateRows.length > 0 ? costSplit(draft, rateRows).labour : 0;
        return { ...draft, labourUnit: labour };
      });
      const write = buildScanWrite({
        fileName: file.name,
        client: base.client ?? null,
        stage: "review",
        items,
      });
      const saved = await insertScan(write);
      const savedId = saved.data && typeof saved.data === "object" && "id" in saved.data
        ? String((saved.data as { id?: string }).id || "")
        : "";
      setAddedScans(prev => [...prev, {
        id: savedId || `local-${Date.now()}`,
        file_name: write.file_name,
        client: write.client,
        revision_of: variationProjectKey(base),
        started_at: new Date().toISOString(),
        detected_items: write.detected_items,
      }]);
      if (saved.error) {
        setUploadError(saved.error.message || "The comparison is on screen. The revised scan was not saved.");
      }
    } catch (err) {
      setUploadError(publicDetectionFailure(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={loading} error={error} noun="variations" />
      <PageHeader
        crumb="Projects"
        title="Variation report"
        sub="Each later plan for the same job is compared with the takeoff before it. Added and removed items show materials and labour."
      />

      {!loading && versions.length === 0 && (
        <EmptyState
          title="No takeoff to compare"
          body="Upload a plan and review the detected items. Then come back and upload the revised drawing."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      )}

      {versions.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <p style={{ color: C.textMuted, marginTop: 0 }}>
              {versions[0].scan.client || "Unassigned takeoff"}
              {" · "}
              {versions[0].scan.file_name || "Original plan"}
              {latest ? ` → ${latest.scan.file_name || "Revised plan"}` : ""}
              {" · "}
              {formatQuotedValue(versions[0].materials)} materials on the original takeoff
            </p>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,application/pdf,image/png"
                style={{ display: "none" }}
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void onRevisedPlan(file);
                  event.target.value = "";
                }}
              />
              {latest && (
                <PrimaryButton onClick={() => {
                  const invoice = draftInvoice({
                    source: "variation",
                    sourceRef: latest.scan.file_name || "variation",
                    jobName: versions[0].scan.client || versions[0].scan.file_name || "Variation",
                    clientName: versions[0].scan.client || "",
                    description: `Variation ${versions.length}`,
                    amountExGst: Math.abs(materialNet + labourNet),
                  });
                  downloadCsvFile("variation-xero.csv", toXeroCsv([invoice]));
                  downloadCsvFile("variation-myob.csv", toMyobCsv([invoice]));
                  fetch("/api/beta/records?kind=invoices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      source: "variation",
                      source_ref: invoice.sourceRef,
                      job_name: invoice.jobName,
                      client_name: invoice.clientName,
                      amount: invoice.amount,
                      tax: invoice.tax,
                      status: "draft",
                      lines: invoice.lines,
                    }),
                  }).catch(() => undefined);
                }}>
                  Draft variation invoice
                </PrimaryButton>
              )}
              <PrimaryButton disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "Reading revised plan…" : "Upload revised plan"}
              </PrimaryButton>
            </div>
          </div>

          {projectKeys.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {projectKeys.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProject(key)}
                  style={{ minHeight: 44, borderRadius: 999, padding: "0 14px", border: `1px solid ${C.border}`, background: activeKey === key ? C.ink : C.bgCard, color: activeKey === key ? "#fff" : C.text, fontWeight: 600 }}
                >
                  {key === "unassigned" ? "Unassigned" : key}
                </button>
              ))}
            </div>
          )}

          {uploadError && <p style={{ color: C.red }}>{uploadError}</p>}

          {latest && (
            <>
              <div style={{ display: "flex", alignItems: "stretch", gap: 12, flexWrap: "wrap", background: "#0D1B2A", color: "#fff", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <VersionBadge code="V001" label="Base estimate" amount={formatGstMoney(roundCents(versions[0].materials + versions[0].labour), "ex")} />
                <div style={{ flex: 1, textAlign: "center", minWidth: 160 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94A3B8" }}>Net variation ex GST</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: roundCents((latest.materials + latest.labour) - (versions[0].materials + versions[0].labour)) >= 0 ? "#FCA5A5" : "#6EE7B7" }}>{signedGst(roundCents((latest.materials + latest.labour) - (versions[0].materials + versions[0].labour)))}</div>
                </div>
                <VersionBadge code={`V${String(versions.length).padStart(3, "0")}`} label="Revised estimate" amount={formatGstMoney(roundCents(latest.materials + latest.labour), "ex")} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                <Chip color="#10B981" text={`${latest.changes.filter(line => line.change === "added").length} added`} />
                <Chip color="#EF4444" text={`${latest.changes.filter(line => line.change === "removed").length} removed`} />
                <Chip color="#F59E0B" text={`${latest.changes.filter(line => line.change === "increased" || line.change === "decreased").length} changed`} />
                <button type="button" onClick={() => window.print()} style={quiet}>Export PDF</button>
                <button type="button" onClick={() => downloadCsvFile("variation.csv", variationCsv(latest.changes))} style={quiet}>Export CSV</button>
              </div>
              <Card style={{ padding: 0, marginBottom: 16, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720, fontSize: 14 }}>
                  <thead>
                    <tr>{["Change type", "Component", "V001 qty", "Later qty", "Cost impact"].map(heading => <th key={heading} style={{ textAlign: "left", padding: 10, background: "#F8FAFC", color: "#94A3B8", fontSize: 11 }}>{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {latest.changes.map(line => (
                      <tr key={`${line.change}-${line.description}`}>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>{TONE[line.change].label}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>{line.description}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>{line.prevQty || "—"}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>{line.newQty || "—"}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, fontWeight: 700 }}>{signedGst(line.delta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>Risk flags</div>
              {latest.changes.filter(line => Math.abs(line.materialDelta + line.labourDelta) >= 200 || line.change === "removed").slice(0, 6).map(line => (
                <Card key={`risk-${line.description}`} style={{ padding: 12, marginBottom: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{TONE[line.change].label} line</div>
                    <div style={{ color: C.textMuted, fontSize: 13 }}>{signedMoney(line.materialDelta + line.labourDelta)} · see the change table</div>
                    {notes[line.description] && <div style={{ marginTop: 4, fontSize: 13 }}>{notes[line.description]}</div>}
                  </div>
                  {noteFor === line.description ? (
                    <input aria-label={`Note for ${line.description}`} value={notes[line.description] || ""} onChange={event => setNotes(current => ({ ...current, [line.description]: event.target.value }))} onBlur={() => setNoteFor(null)} style={{ minHeight: 44, fontSize: 16, borderRadius: 8, border: `1px solid ${C.border}`, padding: "0 8px" }} />
                  ) : (
                    <button type="button" onClick={() => setNoteFor(line.description)} style={quiet}>Add note</button>
                  )}
                </Card>
              ))}
            </>
          )}

          <p style={{ color: C.textMuted, fontSize: 14 }}>
            Materials stay at the saved takeoff price. Labour is the matching rate-library allowance and is stored on the revised scan so it is still here after a refresh.
          </p>

          {versions.map((version, index) => (
            <Card key={version.scan.id || `variation-${index}`} style={{ padding: 0, marginBottom: 16 }}>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontWeight: 700 }}>
                  Variation {index + 1}{index === 0 ? " · original plan" : ""}
                </div>
                <div style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>
                  {version.scan.file_name || "Plan"}
                  {" · "}
                  {formatQuotedValue(version.materials)} materials
                  {" · "}
                  {formatQuotedValue(version.labour)} labour
                </div>
              </div>
              {index === 0 ? (
                <p style={{ margin: 0, padding: "0 18px 16px", color: C.textMuted }}>
                  {version.lines.length} original items are ready. Upload the revised drawing to list what was added and what was removed.
                </p>
              ) : version.changes.length === 0 ? (
                <p style={{ margin: 0, padding: "0 18px 16px", color: C.textMuted }}>This plan matches the previous takeoff.</p>
              ) : (
                <p style={{ margin: 0, padding: "0 18px 16px", color: C.textMuted }}>{version.changes.length} line changes are in the table above.</p>
              )}
            </Card>
          ))}
        </>
      )}
      <Footer />
    </div>
  );
}

function VersionBadge({ code, label, amount }: { code: string; label: string; amount: string }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ color: "#93C5FD", fontWeight: 800 }}>{code}</div>
      <div style={{ color: "#94A3B8", fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{amount}</div>
    </div>
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />{text}</span>;
}

const quiet: React.CSSProperties = { minHeight: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", fontWeight: 700 };

function variationCsv(lines: VariationLine[]): string {
  const rows = [["Change type", "Component", "V001 qty", "Later qty", "Cost impact"], ...lines.map(line => [line.change, line.description, String(line.prevQty), String(line.newQty), String(line.materialDelta + line.labourDelta)])];
  return rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function ChangeRow({ line }: { line: VariationLine }) {
  const tone = TONE[line.change];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <span style={{ minWidth: 88, textAlign: "center", borderRadius: 999, padding: "8px 8px", fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>{tone.label}</span>
      <span style={{ flex: 1, fontWeight: 600, minWidth: 160 }}>
        {line.description}
        <span style={{ display: "block", fontWeight: 400, color: C.textMuted, fontSize: 13 }}>
          {line.prevQty} → {line.newQty}
        </span>
      </span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: line.materialDelta < 0 ? C.red : C.text }}>
        {signedMoney(line.materialDelta)} materials
      </span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: line.labourDelta < 0 ? C.red : C.text }}>
        {signedMoney(line.labourDelta)} labour
      </span>
    </div>
  );
}

function downloadCsvFile(name: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: C.textMuted }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </Card>
  );
}
