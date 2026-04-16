import { useMemo, useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import { saveVariationReport } from "../services/variationService";

// ─── Shared design tokens ────────────────────────────
// Kept in sync with the `C` palette declared in App.tsx so the screen fits the
// existing ElectraScan dark-mode UI without introducing a parallel theme.
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
  purple: "#7C3AED", teal:   "#0EA5E9",
};

// ─── Types ───────────────────────────────────────────
export type ChangeType = "added" | "removed" | "changed";
export type RiskLevel = "high" | "medium" | "info";

export interface VariationLineItem {
  description: string;
  room: string;
  qty: number;
  unitPrice: number;
}

export interface VariationRow {
  type: ChangeType;
  room: string;
  component: string;
  qty001: number;
  qty002: number;
  delta: number;
}

export interface VariationRiskFlag {
  id: string;
  level: RiskLevel;
  icon: string;
  title: string;
  desc: string;
}

export interface VariationEstimateLike {
  id: string;
  number: string;
  total: number;
  subtotal?: number;
  date?: string;
  lineItems?: VariationLineItem[];
}

export interface VariationReportProps {
  projectName: string;
  previous: VariationEstimateLike;
  current: VariationEstimateLike;
  onBack: () => void;
  onOpenScan?: () => void;
}

// ─── Mock fallback ────────────────────────────────────
// Mirrors the Riverside pool/spa scenario shown in the prototype. Used when the
// two estimates don't carry line items yet (mock projects in the current app
// ship with `lineItems: []` — see App.tsx).
const MOCK_ROWS: VariationRow[] = [
  { type: "added",   room: "Outdoor",   component: "Pool Equipment Circuit (500W)",     qty001: 0, qty002: 1, delta:  680 },
  { type: "added",   room: "Outdoor",   component: "Spa Blower Circuit",                qty001: 0, qty002: 1, delta:  420 },
  { type: "added",   room: "Outdoor",   component: "External Security Camera Circuit",  qty001: 0, qty002: 2, delta:  560 },
  { type: "changed", room: "Kitchen",   component: "Double GPO — upgraded to USB-A/C",   qty001: 6, qty002: 6, delta:  240 },
  { type: "changed", room: "Bedrooms",  component: "LED Downlight — upgraded to dimmable", qty001: 9, qty002: 9, delta: 495 },
  { type: "removed", room: "Garage",    component: "Single GPO (standard)",             qty001: 2, qty002: 0, delta: -170 },
];

const MOCK_RISKS: VariationRiskFlag[] = [
  { id: "r1", level: "high",   icon: "⚡", title: "Missing Power Allocation — Pool Equipment",
    desc: "Pool pump and spa equipment shown on landscape plan. No dedicated sub-board or circuit shown on electrical drawings." },
  { id: "r2", level: "medium", icon: "⚠️", title: "Height Hazard — Void Lighting > 3.5m",
    desc: "Feature lighting in double-height void (est. 5.2m). WHS scaffold requirement applies. Add crane/scaffold allowance to estimate." },
  { id: "r3", level: "info",   icon: "🏠", title: "Automation Dependency — Dali Lighting",
    desc: "Dimmable downlights specified in Bedrooms. Dali protocol requires separate programming contractor. Confirm scope split with client." },
];

// ─── Helpers ───────────────────────────────────────────
const fmt = (n: number) => {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-AU")}`;
};
const pctStr = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const keyOf = (li: VariationLineItem) => `${li.room.trim().toLowerCase()}|${li.description.trim().toLowerCase()}`;

function diffEstimates(
  previous: VariationEstimateLike,
  current: VariationEstimateLike,
): VariationRow[] {
  const a = previous.lineItems ?? [];
  const b = current.lineItems ?? [];
  if (a.length === 0 && b.length === 0) return MOCK_ROWS;

  const byKey = new Map<string, { prev?: VariationLineItem; curr?: VariationLineItem }>();
  for (const li of a) byKey.set(keyOf(li), { ...byKey.get(keyOf(li)), prev: li });
  for (const li of b) byKey.set(keyOf(li), { ...byKey.get(keyOf(li)), curr: li });

  const rows: VariationRow[] = [];
  for (const { prev, curr } of byKey.values()) {
    if (prev && !curr) {
      rows.push({ type: "removed", room: prev.room, component: prev.description, qty001: prev.qty, qty002: 0, delta: -(prev.qty * prev.unitPrice) });
    } else if (!prev && curr) {
      rows.push({ type: "added", room: curr.room, component: curr.description, qty001: 0, qty002: curr.qty, delta: curr.qty * curr.unitPrice });
    } else if (prev && curr) {
      const totalA = prev.qty * prev.unitPrice;
      const totalB = curr.qty * curr.unitPrice;
      if (totalA !== totalB) {
        rows.push({ type: "changed", room: curr.room, component: curr.description, qty001: prev.qty, qty002: curr.qty, delta: totalB - totalA });
      }
    }
  }
  // Stable-ish order: added first, changed, removed.
  const order: Record<ChangeType, number> = { added: 0, changed: 1, removed: 2 };
  rows.sort((x, y) => order[x.type] - order[y.type]);
  return rows;
}

// ─── Component ─────────────────────────────────────────
export default function VariationReport({
  projectName,
  previous,
  current,
  onBack,
  onOpenScan,
}: VariationReportProps) {
  const rows = useMemo(() => diffEstimates(previous, current), [previous, current]);

  const addedRows = rows.filter(r => r.type === "added");
  const removedRows = rows.filter(r => r.type === "removed");
  const changedRows = rows.filter(r => r.type === "changed");

  const addedDelta   = addedRows.reduce((s, r) => s + r.delta, 0);
  const removedDelta = removedRows.reduce((s, r) => s + r.delta, 0);
  const changedDelta = changedRows.reduce((s, r) => s + r.delta, 0);
  const totalDelta   = addedDelta + removedDelta + changedDelta;

  // If we have real totals on the estimates use them, else derive from the diff.
  const base = previous.total > 0 ? previous.total : 136200;
  const revised = current.total > 0 ? current.total : base + totalDelta;
  const pctChange = base === 0 ? 0 : (totalDelta / base) * 100;

  const risks = MOCK_RISKS;
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [exportState, setExportState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exportMsg, setExportMsg] = useState<string>("");

  const openNote = (id: string) => { setNoteOpen(id); setNoteDraft(notes[id] ?? ""); };
  const saveNote = () => {
    if (noteOpen) setNotes(prev => ({ ...prev, [noteOpen]: noteDraft }));
    setNoteOpen(null);
    setNoteDraft("");
  };

  const netColor = totalDelta > 0 ? C.red : totalDelta < 0 ? C.green : C.muted;

  const persist = async () => {
    setExportState("saving");
    const res = await saveVariationReport({
      project_name: projectName,
      from_estimate: previous.number,
      to_estimate: current.number,
      base_total: base,
      revised_total: revised,
      net_delta: totalDelta,
      pct_change: Number(pctChange.toFixed(2)),
      added_count: addedRows.length,
      removed_count: removedRows.length,
      changed_count: changedRows.length,
      rows,
      risk_flags: risks,
      notes,
    });
    if (res.ok) {
      setExportState("saved");
      setExportMsg("Saved to Supabase");
    } else {
      setExportState("error");
      setExportMsg("Saved locally · cloud sync unavailable");
    }
    window.setTimeout(() => setExportState("idle"), 2800);
  };

  const exportCSV = () => {
    const header = ["Change Type", "Room/Zone", "Component", "V001 Qty", "V002 Qty", "Cost Impact ($)"];
    const lines = rows.map(r => [
      r.type, r.room, r.component.replaceAll(",", ";"),
      String(r.qty001), String(r.qty002), String(Math.round(r.delta)),
    ].join(","));
    const summary = [
      "",
      `Project,${projectName}`,
      `From,${previous.number}`,
      `To,${current.number}`,
      `Base Total,${Math.round(base)}`,
      `Revised Total,${Math.round(revised)}`,
      `Net Variation,${Math.round(totalDelta)}`,
      `Change %,${pctChange.toFixed(2)}`,
    ].join("\n");
    const csv = [header.join(","), ...lines, summary].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `variation-${previous.number}-to-${current.number}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    persist();
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Variation Report", margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(`${previous.number}  →  ${current.number}`, margin, y);
    y += 14;
    doc.text(`${projectName}`, margin, y);
    y += 22;

    // Summary banner
    doc.setDrawColor(30, 30, 60);
    doc.setFillColor(20, 36, 64);
    doc.roundedRect(margin, y, 515, 70, 8, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`V001 Base:  ${fmt(base)}`, margin + 14, y + 22);
    doc.setFontSize(18);
    doc.setTextColor(totalDelta > 0 ? 239 : 16, totalDelta > 0 ? 68 : 185, totalDelta > 0 ? 68 : 129);
    doc.text(`Net ${totalDelta >= 0 ? "+" : ""}${fmt(totalDelta)} (${pctStr(pctChange)})`, margin + 180, y + 30);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`V002 Revised:  ${fmt(revised)}`, margin + 14, y + 52);
    y += 90;

    // Chips
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Added: ${addedRows.length} (+${fmt(addedDelta).replace("-", "")})  ·  Removed: ${removedRows.length} (${fmt(removedDelta)})  ·  Changed: ${changedRows.length} (+${fmt(changedDelta).replace("-", "")})`, margin, y);
    y += 18;

    // Table header
    doc.setFillColor(240, 244, 248);
    doc.rect(margin, y, 515, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("TYPE", margin + 6, y + 12);
    doc.text("ROOM", margin + 72, y + 12);
    doc.text("COMPONENT", margin + 160, y + 12);
    doc.text("V001", margin + 360, y + 12, { align: "center" });
    doc.text("V002", margin + 400, y + 12, { align: "center" });
    doc.text("DELTA", margin + 490, y + 12, { align: "right" });
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);

    rows.forEach(r => {
      if (y > 780) { doc.addPage(); y = margin; }
      const tintR = r.type === "added" ? 236 : r.type === "removed" ? 254 : 255;
      const tintG = r.type === "added" ? 253 : r.type === "removed" ? 242 : 251;
      const tintB = r.type === "added" ? 245 : r.type === "removed" ? 242 : 235;
      doc.setFillColor(tintR, tintG, tintB);
      doc.rect(margin, y, 515, 18, "F");

      doc.setTextColor(
        r.type === "added" ? 16 : r.type === "removed" ? 239 : 217,
        r.type === "added" ? 185 : r.type === "removed" ? 68 : 119,
        r.type === "added" ? 129 : r.type === "removed" ? 68 : 6,
      );
      doc.text(r.type.toUpperCase(), margin + 6, y + 12);

      doc.setTextColor(30, 30, 30);
      doc.text(r.room, margin + 72, y + 12);
      const comp = r.component.length > 42 ? r.component.slice(0, 41) + "…" : r.component;
      doc.text(comp, margin + 160, y + 12);
      doc.text(String(r.qty001 || "—"), margin + 360, y + 12, { align: "center" });
      doc.text(String(r.qty002 || "—"), margin + 400, y + 12, { align: "center" });

      doc.setTextColor(
        r.delta > 0 ? 239 : r.delta < 0 ? 16 : 100,
        r.delta > 0 ? 68  : r.delta < 0 ? 185 : 116,
        r.delta > 0 ? 68  : r.delta < 0 ? 129 : 139,
      );
      doc.text(`${r.delta >= 0 ? "+" : ""}${fmt(r.delta)}`, margin + 508, y + 12, { align: "right" });
      y += 18;
    });

    y += 14;
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Risk Flags — Version 002", margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    risks.forEach(r => {
      if (y > 780) { doc.addPage(); y = margin; }
      doc.setTextColor(
        r.level === "high" ? 239 : r.level === "medium" ? 245 : 14,
        r.level === "high" ? 68  : r.level === "medium" ? 158 : 165,
        r.level === "high" ? 68  : r.level === "medium" ? 11  : 233,
      );
      doc.setFont("helvetica", "bold");
      doc.text(`${r.level.toUpperCase()}  ·  ${r.title}`, margin, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(r.desc, 515);
      doc.text(lines, margin, y);
      y += lines.length * 12;
      if (notes[r.id]) {
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "italic");
        const nlines = doc.splitTextToSize(`Note: ${notes[r.id]}`, 515);
        doc.text(nlines, margin, y);
        y += nlines.length * 12;
        doc.setFont("helvetica", "normal");
      }
      y += 6;
    });

    doc.save(`variation-${previous.number}-to-${current.number}.pdf`);
    persist();
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
            ← Back
          </button>
          <div style={{ fontSize: 11, color: C.muted }}>{previous.number} → {current.number}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Variation Report</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{projectName}</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 96px" }}>
        {/* Banner */}
        <div style={{
          background: `linear-gradient(135deg, ${C.navy}, #1A3A5C)`,
          border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 18px",
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, alignItems: "center",
          marginBottom: 14,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.blueLt }}>V001</div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>Base Estimate</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 6 }}>{fmt(base)}</div>
          </div>
          <div style={{ textAlign: "center", borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Net Variation</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: netColor, margin: "4px 0" }}>
              {totalDelta >= 0 ? "+" : ""}{fmt(totalDelta)}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>{pctStr(pctChange)} change</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>V002</div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>Revised Estimate</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 6 }}>{fmt(revised)}</div>
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <Chip dotColor={C.green} label={`${addedRows.length} added`} value={`+${fmt(addedDelta)}`} valueColor={C.green} />
          <Chip dotColor={C.red} label={`${removedRows.length} removed`} value={fmt(removedDelta)} valueColor={C.red} />
          <Chip dotColor={C.amber} label={`${changedRows.length} changed`} value={`${changedDelta >= 0 ? "+" : ""}${fmt(changedDelta)}`} valueColor={C.amber} />
        </div>

        {/* Export buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={exportPDF}
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
            Export PDF
          </button>
          <button onClick={exportCSV}
            style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
        {exportState !== "idle" && (
          <div style={{
            fontSize: 11, color: exportState === "error" ? C.amber : C.green,
            marginTop: -8, marginBottom: 12, textAlign: "center",
          }}>
            {exportState === "saving" ? "Saving…" : exportMsg}
          </div>
        )}

        {/* Rows */}
        <SectionTitle>Changes — {rows.length} item{rows.length === 1 ? "" : "s"}</SectionTitle>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 18 }}>
          {rows.length === 0 ? (
            <div style={{ padding: "28px 14px", textAlign: "center", color: C.muted, fontSize: 13 }}>
              No differences between {previous.number} and {current.number}.
            </div>
          ) : rows.map((r, i) => (
            <VariationRowCard key={i} row={r} isLast={i === rows.length - 1} />
          ))}
        </div>

        {/* Risk flags */}
        <SectionTitle>Risk Flags — Version 002</SectionTitle>
        {risks.map(r => {
          const accent = r.level === "high" ? C.red : r.level === "medium" ? C.amber : C.teal;
          const tint = `${accent}14`;
          const hasNote = Boolean(notes[r.id]);
          return (
            <div key={r.id}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`,
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
              }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  background: tint, width: 30, height: 30, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: accent, background: tint,
                      padding: "2px 6px", borderRadius: 4, letterSpacing: "0.5px", textTransform: "uppercase",
                    }}>{r.level}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{r.desc}</div>
                  {hasNote && (
                    <div style={{
                      fontSize: 12, color: C.text, background: `${C.blue}18`, border: `1px solid ${C.blue}55`,
                      padding: "8px 10px", borderRadius: 8, marginTop: 8,
                    }}>
                      <span style={{ color: C.blueLt, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Note · </span>
                      {notes[r.id]}
                    </div>
                  )}
                </div>
                <button onClick={() => openNote(r.id)}
                  style={{
                    background: "none", border: `1px solid ${C.border}`, color: C.dim,
                    fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                  }}>
                  {hasNote ? "Edit Note" : "Add Note"}
                </button>
              </div>
            </div>
          );
        })}

        {/* Footer banner */}
        <div style={{
          marginTop: 16, background: `${C.blue}14`, border: `1px solid ${C.blue}44`,
          borderRadius: 12, padding: "12px 14px", fontSize: 12, color: C.blueLt, lineHeight: 1.55,
        }}>
          📋 This report is ready to send. <strong>Export as PDF</strong> to attach to your revised estimate submission to the builder.
        </div>
      </div>

      {/* Note modal */}
      {noteOpen && (
        <div onClick={() => setNoteOpen(null)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, maxWidth: 400, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Add note to risk flag</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
              Notes are included with the variation report when exported as PDF and sent to the builder.
            </div>
            <textarea
              autoFocus value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
              placeholder="e.g. Confirmed with client — crane hire quoted separately."
              style={{
                width: "100%", minHeight: 96, background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit",
                outline: "none", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setNoteOpen(null)}
                style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveNote}
                style={{ flex: 2, background: C.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`,
        display: "flex", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}>
        <button onClick={onBack}
          style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Project</div>
        </button>
        <button onClick={onOpenScan}
          style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>⚡</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Scan</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20, opacity: 0.9 }}>📊</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Variation</div>
          <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em",
      textTransform: "uppercase", marginBottom: 10, marginTop: 2,
    }}>{children}</div>
  );
}

function Chip({ dotColor, label, value, valueColor }: {
  dotColor: string; label: string; value: string; valueColor: string;
}) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "10px 10px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: valueColor }}>{value}</div>
    </div>
  );
}

function VariationRowCard({ row, isLast }: { row: VariationRow; isLast: boolean }) {
  const accent = row.type === "added" ? "#00C48C" : row.type === "removed" ? "#FF4D4D" : "#FFB020";
  const bgTint = row.type === "added" ? "rgba(0,196,140,0.05)" : row.type === "removed" ? "rgba(255,77,77,0.05)" : "rgba(255,176,32,0.05)";
  const deltaColor = row.delta > 0 ? "#FF4D4D" : row.delta < 0 ? "#00C48C" : "#5C7A9E";
  const badgeText = row.type === "added" ? "+ Added" : row.type === "removed" ? "− Removed" : "± Changed";

  return (
    <div style={{
      padding: "12px 14px",
      borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      borderLeft: `3px solid ${accent}`, background: bgTint,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            display: "inline-block", fontSize: 10, fontWeight: 800, padding: "2px 7px",
            borderRadius: 5, background: `${accent}22`, color: accent,
            letterSpacing: "0.5px", marginBottom: 5, textTransform: "uppercase",
          }}>{badgeText}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis" }}>{row.component}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{row.room}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: deltaColor }}>{row.delta >= 0 ? "+" : ""}{fmt(row.delta)}</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>cost impact</div>
        </div>
      </div>
      <div style={{
        display: "flex", gap: 12, paddingTop: 8, borderTop: `1px solid ${C.border}`,
        fontSize: 11, color: C.muted,
      }}>
        <div>V001 Qty <span style={{ color: row.qty001 === 0 ? C.dim : C.text, fontWeight: 700 }}>{row.qty001 || "—"}</span></div>
        <div>V002 Qty <span style={{ color: row.qty002 === 0 ? C.dim : C.text, fontWeight: 700 }}>{row.qty002 || "—"}</span></div>
      </div>
    </div>
  );
}
