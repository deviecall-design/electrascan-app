import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Send, FileDown, Loader2 } from "lucide-react";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  MiniStat,
  Footer,
  B,
  Th,
  Td,
  ConfPill,
} from "../components/ui/anthropic";
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";
import { fetchEstimateByRef, type EstimateRow } from "../services/supabaseData";
import { compareEstimates, type VariationDelta, type LineItemCompare } from "../services/variationComparison";

// ─── Mock variation data ────────────────────────────────────────────────
// Same shape as the v2 prototype VARIATION_ITEMS. TODO: compute dynamically
// from two scans once the detection pipeline feeds real data.
const VARIATION_ITEMS = [
  { description: "Recessed pair of Down Lights",     prevQty: 18, newQty: 22, unitPrice: 200,  change: "increased" as const },
  { description: "LED Strip Light",                  prevQty: 23, newQty: 28, unitPrice: 400,  change: "increased" as const },
  { description: "Motorised Blind",                  prevQty: 14, newQty: 18, unitPrice: 380,  change: "increased" as const },
  { description: "ZETR 13 series double powerpoint", prevQty: 6,  newQty: 8,  unitPrice: 525,  change: "increased" as const },
  { description: "EV Charger",                       prevQty: 0,  newQty: 2,  unitPrice: 1000, change: "added" as const },
  { description: "Ceiling Fan",                      prevQty: 4,  newQty: 2,  unitPrice: 450,  change: "decreased" as const },
  { description: "Door Bell",                        prevQty: 1,  newQty: 0,  unitPrice: 250,  change: "removed" as const },
];

const RISKS: { level: "high" | "medium" | "info"; title: string; desc: string }[] = [
  { level: "medium", title: "EV Charger added", desc: "2 EV charger points added to drawings. Confirm cable run distance — max 15m from switchboard. Add cable allowance if over." },
  { level: "info", title: "Motorised Blind qty increase", desc: "4 additional motorised blinds detected. Ensure Dynalite/Dali programming scope covers the extra zones. Confirm with automation contractor." },
];

type Change = "added" | "removed" | "increased" | "decreased";
const CHANGE_CFG: Record<Change, { color: string; bg: string; label: string }> = {
  added:     { color: C.green, bg: C.greenSoft, label: "+ Added" },
  removed:   { color: "#c44",  bg: "#fef2f2",   label: "− Removed" },
  increased: { color: C.amber, bg: C.amberSoft, label: "↑ Increased" },
  decreased: { color: C.blue,  bg: C.blueSoft,  label: "↓ Decreased" },
};

const BASE_TOTAL = 44635;

export default function VariationReportScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"summary" | "detail">("summary");
  const [isLoading, setIsLoading] = useState(false);
  const [v1, setV1] = useState<EstimateRow | null>(null);
  const [v2, setV2] = useState<EstimateRow | null>(null);
  const [delta, setDelta] = useState<VariationDelta | null>(null);

  useEffect(() => {
    // Load estimates from URL params: ?v1=EST-001&v2=EST-002
    const v1Ref = searchParams.get("v1");
    const v2Ref = searchParams.get("v2");

    if (!v1Ref || !v2Ref) {
      console.warn("[VariationReportScreen] Missing v1 or v2 param; using mock data");
      return;
    }

    const loadEstimates = async () => {
      setIsLoading(true);
      try {
        const [e1, e2] = await Promise.all([
          fetchEstimateByRef(v1Ref),
          fetchEstimateByRef(v2Ref),
        ]);

        if (e1.data && e2.data) {
          setV1(e1.data);
          setV2(e2.data);
          const computed = compareEstimates(e1.data, e2.data);
          setDelta(computed);
        } else {
          console.error("[VariationReportScreen] Failed to load estimates:", e1.error, e2.error);
        }
      } catch (err) {
        console.error("[VariationReportScreen] Error loading estimates:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEstimates();
  }, [searchParams]);

  // Fallback to mock if no real data loaded
  const displayDelta = delta || { 
    totalCostV1: BASE_TOTAL,
    totalCostV2: BASE_TOTAL + VARIATION_ITEMS.reduce((s, i) => s + (i.newQty - i.prevQty) * i.unitPrice, 0),
    totalDelta: VARIATION_ITEMS.reduce((s, i) => s + (i.newQty - i.prevQty) * i.unitPrice, 0),
    itemsAdded: [],
    itemsRemoved: [],
    itemsChanged: [],
    itemsUnchanged: [],
    qtyAddedTotal: 0,
    qtyRemovedTotal: 0,
  };

  const newTotal = displayDelta.totalCostV2;
  const deltaMoney = displayDelta.totalDelta;
  const pct = (deltaMoney / BASE_TOTAL) * 100;

  const added   = VARIATION_ITEMS.filter(i => i.change === "added");
  const removed = VARIATION_ITEMS.filter(i => i.change === "removed");
  const changed = VARIATION_ITEMS.filter(i => i.change === "increased" || i.change === "decreased");

  const addedDelta   = added.reduce((s, i) => s + i.newQty * i.unitPrice, 0);
  const removedDelta = removed.reduce((s, i) => s + i.prevQty * i.unitPrice, 0);

  const fmt = (n: number) => `$${Math.abs(n).toLocaleString("en-AU")}`;

  return (
    <div className="anim-in">
      <button
        className="es-link"
        onClick={() => navigate("/dashboard")}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted, fontFamily: FONT.heading, marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </button>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          Variation Report
        </h1>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textSubtle }}>
          EST-2026-497-001 → EST-2026-497-002
        </span>
      </div>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: "0 0 24px 0" }}>
        Mark Arnesen · 8/110 North Steyne, Manly · Rev FG → Rev B
      </p>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <MiniStat label="Net change" v={`${deltaMoney >= 0 ? "+" : "−"}${fmt(Math.abs(deltaMoney))}`} tint={deltaMoney >= 0 ? C.amber : C.green} />
        <MiniStat label="% change" v={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`} tint={deltaMoney >= 0 ? C.amber : C.green} />
        <MiniStat label="New total ex GST" v={fmt(newTotal)} />
        <MiniStat label="Items changed" v={String(VARIATION_ITEMS.length)} tint={C.blue} />
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {(["summary", "detail"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px",
              fontFamily: FONT.heading,
              fontSize: 14,
              fontWeight: 500,
              color: tab === t ? C.text : C.textMuted,
              borderBottom: tab === t ? `2px solid ${C.orange}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 24 }}>
          {/* Left — change summary + risks */}
          <div>
            {/* Change chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {([
                [added.length,   "Added",   C.green,  `+${fmt(addedDelta)}`],
                [removed.length, "Removed", "#c44",   `−${fmt(removedDelta)}`],
                [changed.length, "Changed", C.amber,  "Qty changes"],
              ] as [number, string, string, string][]).map(([count, label, color, sub]) => (
                <div key={label} style={{ padding: "12px 16px", borderRadius: RADIUS.lg, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontFamily: FONT.heading, fontSize: 18, fontWeight: 600, color }}>{count}</span>
                    <span style={{ marginLeft: 8, fontSize: 14, color: C.textMuted }}>{label}</span>
                  </div>
                  <span style={{ fontFamily: FONT.mono, fontSize: 13, color, fontWeight: 500 }}>{sub}</span>
                </div>
              ))}
            </div>

            {/* Risks */}
            {RISKS.map((r, i) => {
              const riskColor = r.level === "high" ? "#c44" : r.level === "medium" ? C.amber : C.blue;
              return (
                <div key={i} style={{ padding: "14px 16px", borderRadius: RADIUS.lg, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: FONT.heading, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, backgroundColor: riskColor + "18", color: riskColor, textTransform: "uppercase" }}>{r.level}</span>
                    <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600 }}>{r.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.6, fontStyle: "italic" }}>{r.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Right — estimate comparison */}
          <Card style={{ padding: "24px 28px" }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 16 }}>Estimate Comparison</div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: C.textMuted }}>EST-2026-497-001 (base)</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 15, fontWeight: 500 }}>{fmt(BASE_TOTAL)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: C.textMuted }}>Variation</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 15, fontWeight: 500, color: deltaMoney >= 0 ? C.amber : C.green }}>
                {deltaMoney >= 0 ? "+" : "−"}{fmt(Math.abs(deltaMoney))}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600 }}>New estimate total</span>
              <span style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 600, color: C.green }}>{fmt(newTotal)}</span>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
              <PrimaryButton icon={<Send size={15} />}>Send to client</PrimaryButton>
              <GhostButton icon={<FileDown size={14} />}>Download PDF</GhostButton>
            </div>
          </Card>
        </div>
      )}

      {tab === "detail" && (
        <Card>
          <table style={{ width: "100%", fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <Th>Change</Th>
                <Th>Item</Th>
                <Th align="right">Prev Qty</Th>
                <Th align="right">New Qty</Th>
                <Th align="right">Rate</Th>
                <Th align="right">Impact</Th>
              </tr>
            </thead>
            <tbody>
              {VARIATION_ITEMS.map((it, i) => {
                const cfg = CHANGE_CFG[it.change];
                const impact = (it.newQty - it.prevQty) * it.unitPrice;
                return (
                  <tr key={i} className="es-row" style={{ borderTop: `1px solid ${C.border}` }}>
                    <Td>
                      <span style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 10, backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </Td>
                    <Td><span style={{ fontWeight: 500 }}>{it.description}</span></Td>
                    <Td align="right" mono muted>{it.prevQty || "—"}</Td>
                    <Td align="right" mono>{it.newQty || "—"}</Td>
                    <Td align="right" mono>${it.unitPrice}</Td>
                    <Td align="right" mono>
                      <span style={{ fontWeight: 600, color: impact >= 0 ? C.amber : C.green }}>
                        {impact >= 0 ? "+" : "−"}{fmt(Math.abs(impact))}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Footer />
    </div>
  );
}
