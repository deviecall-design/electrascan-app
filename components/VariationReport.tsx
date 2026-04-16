import { useState } from "react";
import { getActiveCompanyProfile, incrementEstimateNumber } from "../services/companyProfile";
import { downloadVariationPDF } from "../utils/estimatePdf";

// ─── Design tokens (matches App.tsx C) ──────────────────────────────────────
const C = {
  bg: "#0A1628", navy: "#0F1E35", card: "#132240",
  blue: "#1D6EFD", blueLt: "#4B8FFF", green: "#00C48C",
  amber: "#FFB020", red: "#FF4D4D", text: "#EDF2FF",
  muted: "#5C7A9E", border: "#1A3358", dim: "#8BA4C4",
  purple: "#7C3AED",
};

// ─── Types ──────────────────────────────────────────────────────────────────
export interface VariationItem {
  description: string;
  prevQty: number;
  newQty: number;
  unitPrice: number;
  change: "added" | "removed" | "increased" | "decreased";
}

export interface VariationRisk {
  level: "high" | "medium" | "info";
  title: string;
  description: string;
}

interface VariationReportProps {
  projectName: string;
  projectAddress?: string;        // e.g. "8/110 North Steyne, Manly"
  clientName?: string;            // e.g. "Linda Habak Design"
  baseEstNumber: string;          // e.g. "EST-2026-497-001"
  baseTotal: number;              // subtotal ex GST of the base estimate
  variationItems: VariationItem[];
  risks?: VariationRisk[];
  onBack: () => void;
  onExport?: () => void;
  onDiscard?: () => void;
}

// ─── Change type config ─────────────────────────────────────────────────────
const CHANGE_CFG: Record<VariationItem["change"], { color: string; bg: string; icon: string; label: string }> = {
  added:     { color: C.green, bg: `${C.green}18`, icon: "+", label: "Added" },
  removed:   { color: C.red,   bg: `${C.red}18`,   icon: "−", label: "Removed" },
  increased: { color: C.amber, bg: `${C.amber}18`, icon: "↑", label: "Increased" },
  decreased: { color: C.blue,  bg: `${C.blue}18`,  icon: "↓", label: "Decreased" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${Math.abs(n).toLocaleString("en-AU")}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);

// ─── Component ──────────────────────────────────────────────────────────────
export default function VariationReport({
  projectName,
  projectAddress,
  clientName,
  baseEstNumber,
  baseTotal,
  variationItems,
  risks = [],
  onBack,
  onExport,
  onDiscard,
}: VariationReportProps) {
  const [tab, setTab] = useState<"summary" | "detail">("summary");

  // ── Compute totals ──
  const newTotal = variationItems.reduce((s, i) => s + i.newQty * i.unitPrice, 0)
    + baseTotal
    - variationItems.reduce((s, i) => s + i.prevQty * i.unitPrice, 0);
  // net delta = sum of (newQty - prevQty) * unitPrice for each item
  const delta = variationItems.reduce((s, i) => s + (i.newQty - i.prevQty) * i.unitPrice, 0);
  const pct = baseTotal > 0 ? (delta / baseTotal) * 100 : 0;

  // ── Categorise ──
  const added = variationItems.filter(i => i.change === "added");
  const removed = variationItems.filter(i => i.change === "removed");
  const changed = variationItems.filter(i => i.change === "increased" || i.change === "decreased");

  const addedDelta = added.reduce((s, i) => s + i.newQty * i.unitPrice, 0);
  const removedDelta = removed.reduce((s, i) => s + i.prevQty * i.unitPrice, 0);

  // ── Export handler (generates branded PDF) ──
  // The variation becomes a NEW estimate with an incremented revision number.
  // E.g. "EST-2026-497-001" → "EST-2026-497-002".
  const variationNumber = incrementEstimateNumber(baseEstNumber);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (onExport) {
      onExport();
      return;
    }
    try {
      setExporting(true);
      const company = getActiveCompanyProfile();
      await downloadVariationPDF({
        company,
        variationNumber,
        baseEstimateNumber: baseEstNumber,
        date: new Date().toLocaleDateString("en-AU"),
        projectName,
        projectAddress,
        clientName,
        baseTotal,
        variationItems: variationItems.map(i => ({
          description: i.description,
          prevQty: i.prevQty,
          newQty: i.newQty,
          unitPrice: i.unitPrice,
          change: i.change,
        })),
        risks,
      });
    } catch (err) {
      console.error("Failed to generate variation PDF:", err);
      // Non-fatal: user can retry. Toast would be nice, but keeps component standalone.
      alert("Could not generate PDF. Check console for details.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── Header ── */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            ← {projectName}
          </button>
          <div style={{
            fontSize: 11, fontWeight: 700,
            background: `${C.purple}22`, color: C.purple,
            padding: "3px 10px", borderRadius: 20,
            border: `1px solid ${C.purple}55`,
          }}>
            Variation Report
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>Drawing Revision Comparison</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
          {baseEstNumber} → <span style={{ color: C.purple, fontWeight: 700 }}>{variationNumber}</span>
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 14, fontStyle: "italic" }}>
          Exporting this variation will generate a new branded estimate PDF
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: delta >= 0 ? C.green : C.red }}>
              {delta >= 0 ? "+" : "−"}{fmtK(Math.abs(delta))}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Net change ex GST</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: delta >= 0 ? C.green : C.red }}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>% change</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{fmtK(newTotal)}</div>
            <div style={{ fontSize: 10, color: C.muted }}>New total ex GST</div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, display: "flex", flexShrink: 0 }}>
        {(["summary", "detail"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, background: "none", border: "none",
              padding: "12px 0", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              color: tab === t ? C.blue : C.muted,
              borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>

        {/* ──── Summary Tab ──── */}
        {tab === "summary" && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {([
                [added.length, "Added", C.green, `+${fmt(addedDelta)}`],
                [removed.length, "Removed", C.red, `−${fmt(removedDelta)}`],
                [changed.length, "Changed", C.amber, "Qty changes"],
              ] as [number, string, string, string][]).map(([count, label, color, sub]) => (
                <div key={label} style={{
                  background: `${color}12`, border: `1px solid ${color}33`,
                  borderRadius: 12, padding: "12px 14px",
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
                  <div style={{ fontSize: 10, color, opacity: 0.8 }}>{label}</div>
                  <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Estimate comparison */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "16px 18px", marginBottom: 12,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 12,
                letterSpacing: "0.06em", textTransform: "uppercase" as const,
              }}>
                Estimate Comparison
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.muted }}>{baseEstNumber}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(baseTotal)}</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                paddingBottom: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 12,
              }}>
                <span style={{ fontSize: 13, color: C.muted }}>Variation</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: delta >= 0 ? C.green : C.red }}>
                  {delta >= 0 ? "+" : "−"}{fmt(Math.abs(delta))}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>New estimate total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmt(newTotal)}</span>
              </div>
            </div>

            {/* Risk flags */}
            {risks.map((risk, i) => {
              const riskColor = risk.level === "high" ? C.red : risk.level === "medium" ? C.amber : C.blue;
              return (
                <div
                  key={i}
                  style={{
                    background: `${riskColor}18`,
                    border: `1px solid ${riskColor}44`,
                    borderRadius: 14, padding: "14px 16px",
                    marginBottom: i < risks.length - 1 ? 10 : 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      padding: "2px 7px", borderRadius: 5,
                      background: `${riskColor}22`, color: riskColor,
                    }}>
                      {risk.level.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{risk.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{risk.description}</div>
                </div>
              );
            })}
          </>
        )}

        {/* ──── Detail Tab ──── */}
        {tab === "detail" && variationItems.map((item, i) => {
          const cfg = CHANGE_CFG[item.change];
          const itemDelta = (item.newQty - item.prevQty) * item.unitPrice;
          return (
            <div
              key={i}
              style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "12px 16px", marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: cfg.bg, color: cfg.color,
                      fontSize: 12, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.description}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, paddingLeft: 28 }}>
                    {item.change === "added" && `New: ${item.newQty} EA @ ${fmt(item.unitPrice)}`}
                    {item.change === "removed" && `Removed: ${item.prevQty} EA`}
                    {(item.change === "increased" || item.change === "decreased") &&
                      `${item.prevQty} → ${item.newQty} EA @ ${fmt(item.unitPrice)}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 800,
                    color: itemDelta >= 0 ? C.green : C.red,
                  }}>
                    {itemDelta >= 0 ? "+" : "−"}{fmt(Math.abs(itemDelta))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {tab === "detail" && variationItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ color: C.muted, fontSize: 14 }}>No variations detected</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Upload a revised drawing to generate a comparison</div>
          </div>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        position: "fixed" as const, bottom: 0, left: 0, right: 0,
        background: C.navy, borderTop: `1px solid ${C.border}`,
        padding: "10px 14px", display: "flex", gap: 10,
      }}>
        <button
          onClick={onDiscard || onBack}
          style={{
            flex: 1, background: C.card, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontWeight: 600,
            padding: "12px", borderRadius: 12, cursor: "pointer",
          }}
        >
          {onDiscard ? "Discard" : "Back"}
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            flex: 2,
            background: exporting ? C.muted : C.purple,
            border: "none",
            color: "#fff", fontSize: 14, fontWeight: 700,
            padding: "12px", borderRadius: 12,
            cursor: exporting ? "wait" : "pointer",
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? "Generating PDF…" : `📄 Export ${variationNumber} PDF`}
        </button>
      </div>
    </div>
  );
}
