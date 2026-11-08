import React, { useRef, useState, type ReactNode } from "react";
import { FileDown, FileSpreadsheet, Upload } from "lucide-react";
import { C, FONT, RADIUS } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import { formatAud } from "../../lib/quoteTotals";
import { incGst, isHourlyCharge } from "../../lib/labourRates";
import type { QuoteTotals } from "../../lib/quoteTotals";
import type { WorkbookChange, WorkbookLine } from "../../lib/estimateWorkbook";

export interface EstimateTableLine {
  key: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  ids?: number[];
  labourNote?: string;
}

export interface EstimateTableSection {
  category: string;
  total: number;
  lines: EstimateTableLine[];
}

const moneyHead: React.CSSProperties = {
  position: "sticky",
  top: 0,
  textAlign: "right",
  padding: "10px 8px",
  background: "#0f172a",
  color: "#fff",
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const textHead: React.CSSProperties = { ...moneyHead, textAlign: "left" };

export default function EstimateBoard({
  companyName,
  licence,
  estimateId,
  client,
  site,
  status,
  date,
  totals,
  marginPct,
  onMargin,
  marginLocked,
  lineCount,
  unpricedCount,
  materials,
  labour,
  labourByRole,
  sections,
  onQty,
  onRate,
  onPdf,
  pdfBusy,
  onExcel,
  excelBusy,
  onExcelFile,
  excelError,
  excelPreview,
  onApplyExcel,
  onDismissExcel,
  onSave,
  saveBusy,
  saveDisabled,
  saveLabel,
  blockReason,
  suggestion,
  onBack,
  scopeSection,
}: {
  companyName: string;
  licence: string;
  estimateId: string;
  client: string;
  site: string;
  status: string;
  date: string;
  totals: QuoteTotals;
  marginPct: number;
  onMargin: (value: string) => void;
  marginLocked: boolean;
  lineCount: number;
  unpricedCount: number;
  materials: number;
  labour: number;
  labourByRole?: Array<{ roleName: string; hours: number; rate: number; multiplier: number; amount: number; chargeType?: "hourly" | "minimum" | "callout" }>;
  sections: EstimateTableSection[];
  onQty: (ids: number[] | undefined, qty: number) => void;
  onRate: (ids: number[] | undefined, rate: number) => void;
  onPdf: () => void;
  pdfBusy: boolean;
  onExcel: () => void;
  excelBusy: boolean;
  onExcelFile: (file: File) => void;
  excelError: string | null;
  excelPreview: { changes: WorkbookChange[]; added: WorkbookLine[]; removed: WorkbookLine[]; before: QuoteTotals; after: QuoteTotals } | null;
  onApplyExcel: () => void;
  onDismissExcel: () => void;
  onSave: () => void;
  saveBusy: boolean;
  saveDisabled: boolean;
  saveLabel: string;
  blockReason: string | null;
  suggestion: string;
  onBack: () => void;
  scopeSection?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const mix = Math.max(0.01, materials + labour + totals.marginAmount);
  const parts = [
    { label: "Materials", amount: materials, color: "#1f56e6" },
    { label: "Labour", amount: labour, color: "#0ea5e9" },
    { label: "Margin", amount: totals.marginAmount, color: "#b45309" },
  ];

  return (
    <div className="anim-in" role="region" aria-label="Quote" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>ElectraScan estimate</div>
            <h2 style={{ margin: "6px 0 0", fontFamily: FONT.heading, fontSize: 28, letterSpacing: "-0.03em" }}>{estimateId}</h2>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textMuted }}>{estimateId}.pdf</div>
            <div style={{ marginTop: 8, color: C.textMuted, fontSize: 14 }}>{companyName} · Lic. {licence}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, flex: "1 1 280px" }}>
            <Fact label="Client" value={client} />
            <Fact label="Site" value={site} />
            <Fact label="Status" value={status} />
            <Fact label="Date" value={date} />
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Tile label="Subtotal" value={`$${formatAud(totals.subtotal)}`} />
        <Tile label="Margin" value={`${formatAud(totals.marginPct, true)}% · $${formatAud(totals.marginAmount)}`} />
        <Tile label="GST" value={`$${formatAud(totals.gst)}`} />
        <Tile label="Total inc GST" value={`$${formatAud(totals.total)}`} emphasis />
        <Tile label="Lines" value={String(lineCount)} />
        <Tile label="Unpriced" value={String(unpricedCount)} warn={unpricedCount > 0} />
      </div>

      <Card style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Cost breakdown</div>
        <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", background: C.bgSoft }} aria-hidden="true">
          {parts.map(part => (
            <div key={part.label} style={{ width: `${(part.amount / mix) * 100}%`, background: part.color }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 13 }}>
          {parts.map(part => (
            <span key={part.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: part.color }} />
              {part.label} ${formatAud(part.amount)}
            </span>
          ))}
        </div>
      </Card>

      {sections.length === 0 ? (
        <div className="es-empty" role="status" aria-label="No priced lines yet.">
          <p style={{ margin: 0, fontWeight: 600 }}>No priced lines yet.</p>
          <p style={{ margin: "6px 0 0", color: C.textMuted }}>Confirm items on the takeoff and they will show on this quote.</p>
        </div>
      ) : sections.map(section => {
        const expanded = open[section.category] !== false;
        return (
          <Card key={section.category} style={{ padding: 0, overflow: "hidden" }}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(current => ({ ...current, [section.category]: !expanded }))}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, width: "100%", minHeight: 52, padding: "12px 16px", background: C.bgCard, fontWeight: 700, textAlign: "left" }}
            >
              <span>{expanded ? "▾" : "▸"} {section.category}</span>
              <span style={{ fontFamily: FONT.mono }}>${formatAud(section.total)}</span>
            </button>
            {expanded && (
              <div style={{ overflow: "auto", maxHeight: 420 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={textHead}>Description</th>
                      <th style={moneyHead}>Qty</th>
                      <th style={textHead}>Unit</th>
                      <th style={moneyHead}>Rate</th>
                      <th style={moneyHead}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.lines.map((line, index) => (
                      <tr key={line.key} style={{ background: index % 2 === 1 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "8px", overflowWrap: "anywhere" }}>
                          {line.description}
                          {line.labourNote && <div style={{ marginTop: 2, fontSize: 12, color: C.textMuted }}>{line.labourNote}</div>}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <input
                            aria-label={`Quantity for ${line.description}`}
                            inputMode="numeric"
                            value={line.qty}
                            onChange={event => onQty(line.ids, Number(event.target.value))}
                            style={cellInput}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>{line.unit}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontFamily: FONT.mono }}>
                          <input
                            aria-label={`Price for ${line.description}`}
                            inputMode="decimal"
                            value={line.rate}
                            onChange={event => onRate(line.ids, Number(event.target.value))}
                            style={{ ...cellInput, width: 96 }}
                          />
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", fontFamily: FONT.mono, whiteSpace: "nowrap" }}>${formatAud(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {labourByRole && labourByRole.length > 0 && (
        <Card style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 8px", fontFamily: FONT.heading, fontSize: 16 }}>Labour by role</h3>
          {labourByRole.map(row => (
            <div key={`${row.roleName}-${row.multiplier}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
              <span>{row.roleName}{row.multiplier !== 1 ? ` × ${row.multiplier}` : ""}</span>
              <span style={{ fontFamily: FONT.mono }}>
                {isHourlyCharge(row.chargeType) ? `${row.hours} h × $${formatAud(row.rate)}/h` : "Fixed"}
                {` ex GST ($${formatAud(incGst(row.rate))} inc) · $${formatAud(row.amount)}`}
              </span>
            </div>
          ))}
        </Card>
      )}

      {scopeSection ?? (
        <Card style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 6px", fontFamily: FONT.heading, fontSize: 16 }}>Scope of works</h3>
          <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
            Scope of works for this estimate will show here. None has been added yet.
          </p>
        </Card>
      )}

      {excelPreview && (
        <Card style={{ padding: 18 }}>
          <h3 id="excel-diff-title" style={{ marginTop: 0 }}>Excel changes</h3>
          <p style={{ marginTop: 0 }}>
            Before ${formatAud(excelPreview.before.total)} inc GST. After ${formatAud(excelPreview.after.total)} inc GST.
          </p>
          {excelPreview.changes.length === 0 && excelPreview.added.length === 0 && excelPreview.removed.length === 0 ? (
            <p>No line changes. Totals stay the same.</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {excelPreview.changes.map(change => (
                <li key={`${change.lineKey}-${change.field}`}>{change.description}: {change.field} {change.before} → {change.after}</li>
              ))}
              {excelPreview.added.map(line => <li key={`add-${line.description}-${line.qty}`}>New line: {line.qty} × {line.description}</li>)}
              {excelPreview.removed.map(line => <li key={`rm-${line.lineKey}`}>Removed: {line.description}</li>)}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PrimaryButton onClick={onApplyExcel} disabled={excelPreview.changes.length + excelPreview.added.length + excelPreview.removed.length === 0}>Apply changes</PrimaryButton>
            <GhostButton onClick={onDismissExcel}>Cancel</GhostButton>
          </div>
        </Card>
      )}

      <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Quote margin %
          <input
            aria-label="Quote margin percent"
            inputMode="decimal"
            value={marginPct}
            disabled={marginLocked}
            onChange={event => onMargin(event.target.value)}
            style={{ display: "block", width: "100%", maxWidth: 220, minHeight: 44, marginTop: 6, borderRadius: 10, border: `1px solid ${C.border}`, padding: "0 12px", fontSize: 16 }}
          />
        </label>
        {marginLocked && <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>This quote keeps the {totals.marginPct}% margin it was saved with.</p>}
        <p style={{ margin: 0, fontSize: 14 }}>{suggestion}</p>
        {blockReason && (
          <p id="quote-block-reason" role="status" aria-label={blockReason} style={{ margin: 0, color: C.amber, fontSize: 13 }}>{blockReason}</p>
        )}
        {excelError && <p role="alert" style={{ margin: 0, color: C.red }}>{excelError}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <PrimaryButton onClick={onSave} disabled={saveDisabled} ariaBusy={saveBusy} ariaDescribedBy={blockReason ? "quote-block-reason" : undefined}>
            {saveLabel}
          </PrimaryButton>
          <GhostButton icon={<FileDown size={14} />} onClick={onPdf} disabled={pdfBusy || lineCount === 0} ariaBusy={pdfBusy}>
            {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </GhostButton>
          <GhostButton icon={<FileSpreadsheet size={14} />} onClick={onExcel} disabled={excelBusy || lineCount === 0}>
            {excelBusy ? "Preparing Excel…" : "Download Excel (.xlsx)"}
          </GhostButton>
          <GhostButton icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
            Upload Excel
          </GhostButton>
          <input
            ref={fileRef}
            aria-label="Upload Excel"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onExcelFile(file);
            }}
          />
          <GhostButton onClick={onBack}>Back to review</GhostButton>
        </div>
      </Card>
    </div>
  );
}

const cellInput: React.CSSProperties = {
  width: 72,
  minHeight: 44,
  fontSize: 16,
  textAlign: "right",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  padding: "0 8px",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>{label}</div>
      <div style={{ fontWeight: 650, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function Tile({ label, value, emphasis = false, warn = false }: { label: string; value: string; emphasis?: boolean; warn?: boolean }) {
  return (
    <div style={{ background: emphasis ? "#0f172a" : "#fff", color: emphasis ? "#fff" : C.text, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: 14, minWidth: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: emphasis ? "#cbd5e1" : C.textMuted }}>{label}</div>
      <div style={{ marginTop: 4, fontFamily: FONT.heading, fontSize: 20, fontWeight: 700, color: warn ? C.amber : undefined, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
