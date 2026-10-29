import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { C, FONT, RADIUS } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import SourcePlanPreview from "../SourcePlanPreview";
import PlanViewport from "./PlanViewport";
import { fetchRateLibrary, type RateRow } from "../../services/supabaseData";
import type { StoredDetectedItem } from "../../lib/scanRecord";
import { formatAud } from "../../lib/quoteTotals";
import {
  GROUP_LABEL,
  GROUP_ORDER,
  STATUS_LABEL,
  addSymbol,
  canSendQuote,
  formatVerified,
  groupTakeoff,
  priceTakeoff,
  setItemQty,
  setStatus,
  takeoffTotals,
  verifiedPercent,
  type TakeoffGroupId,
} from "../../lib/takeoff";

export default function TakeoffWorkspace({
  items,
  file,
  fileName,
  marginPct,
  minVerifiedPct,
  onChange,
  onNext,
  onBack,
  showContinue = true,
}: {
  items: StoredDetectedItem[];
  file: File | null;
  fileName?: string;
  marginPct: number;
  minVerifiedPct: number | null;
  onChange: (items: StoredDetectedItem[]) => void;
  onNext?: () => void;
  onBack?: () => void;
  showContinue?: boolean;
}) {
  const [rates, setRates] = useState<RateRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addGroup, setAddGroup] = useState<TakeoffGroupId | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchRateLibrary();
        if (!cancelled && Array.isArray(result?.data)) setRates(result.data as RateRow[]);
      } catch {
        /* The takeoff still prices from the detection when the library is unavailable. */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const priced = useMemo(() => priceTakeoff(items, rates), [items, rates]);
  const groups = useMemo(() => groupTakeoff(priced), [priced]);
  const totals = useMemo(() => takeoffTotals(priced, marginPct), [priced, marginPct]);
  const verified = verifiedPercent(priced);
  const sendable = canSendQuote(priced, minVerifiedPct);
  const selected = priced.find(item => item.id === selectedId) ?? null;

  function commit(next: StoredDetectedItem[]) {
    onChange(priceTakeoff(next, rates));
  }

  function onPlanClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!addGroup) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100));
    const next = addSymbol(priced, addGroup, { x, y }, rates);
    const added = next[next.length - 1];
    commit(next);
    setSelectedId(added.id);
    setAddGroup(null);
  }

  return (
    <div className="es-takeoff anim-in">
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600 }}>Plan</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {addGroup ? `Tap the plan to add a ${GROUP_LABEL[addGroup].replace(/s$/, "").toLowerCase()}` : "Pinch to zoom. Tap a symbol to select it."}
          </span>
        </div>
        <PlanViewport>
        <div style={{ position: "relative", minHeight: 320, background: C.bgSoft }} onClick={onPlanClick}>
          <SourcePlanPreview file={file} fileName={fileName} />
          {priced.flatMap(item => (item.marks ?? []).slice(0, Math.max(item.qty, item.status === "rejected" ? 1 : 0)).map((mark, index) => {
            const active = selectedId === item.id;
            const rejected = item.status === "rejected";
            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                aria-label={`${item.desc} symbol ${index + 1}`}
                onClick={event => {
                  event.stopPropagation();
                  setSelectedId(item.id);
                }}
                style={{
                  position: "absolute",
                  left: `${mark.x}%`,
                  top: `${mark.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: 44,
                  height: 44,
                  borderRadius: 99,
                  border: `2px solid ${active ? C.orange : "#fff"}`,
                  background: rejected ? C.textSubtle : active ? C.orange : "#1f56e6",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  boxShadow: active ? "0 0 0 4px rgba(31,86,230,0.25)" : "0 1px 3px rgba(15,23,42,0.25)",
                  opacity: rejected ? 0.45 : 1,
                }}
              >
                {item.symbol.slice(0, 3)}
              </button>
            );
          }))}
        </div>
        </PlanViewport>
        {selected && (
          <div className="es-plan-actions">
            <button type="button" onClick={() => commit(setStatus(priced, selected.id, "confirmed"))} style={actionStyle(C.orange)}>Confirm</button>
            <button type="button" aria-label={`Reject ${selected.desc}`} onClick={() => commit(setStatus(priced, selected.id, "rejected"))} style={actionStyle(C.textMuted, true)}>Reject</button>
          </div>
        )}
      </Card>

      <div className="es-takeoff-panel">
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2 style={{ margin: 0, fontFamily: FONT.heading, fontSize: 18 }}>Detected items</h2>
          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: C.orange }}>{formatVerified(priced)}</span>
        </div>
        <p style={{ margin: "6px 0 12px", color: C.textMuted, fontSize: 13 }}>
          Counts use the rate library. Rejected hits stay off the quote.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {GROUP_ORDER.filter(id => id !== "other").map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setAddGroup(current => (current === id ? null : id))}
              style={{
                minHeight: 44,
                borderRadius: 999,
                padding: "0 10px",
                border: `1px solid ${addGroup === id ? C.orange : C.border}`,
                background: addGroup === id ? C.orangeSoft : C.bgCard,
                color: C.text,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Plus size={12} /> {GROUP_LABEL[id]}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map(group => (
            <section key={group.id} style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", background: C.bg, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{group.label}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, fontFamily: FONT.mono }}>
                    {group.count} × {group.rate > 0 ? `$${Math.round(group.rate).toLocaleString("en-AU")}` : "No rate"}
                    {group.rateCode ? ` · ${group.rateCode}` : ""}
                  </div>
                </div>
                <div style={{ fontFamily: FONT.mono, fontWeight: 700 }}>${Math.round(group.lineTotal).toLocaleString("en-AU")}</div>
              </div>
              {group.items.map(item => {
                const active = selectedId === item.id;
                const rejected = item.status === "rejected";
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      padding: "10px 12px",
                      borderTop: `1px solid ${C.border}`,
                      background: active ? "#eef3ff" : C.bgCard,
                      opacity: rejected ? 0.55 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, textDecoration: rejected ? "line-through" : "none" }}>{item.desc}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{STATUS_LABEL[item.status || "ai"]}</div>
                      </div>
                      <label style={{ fontSize: 12, color: C.textMuted }}>
                        Count
                        <input
                          aria-label={`Count for ${item.desc}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={item.qty}
                          onChange={event => commit(setItemQty(priced, item.id, Number(event.target.value)))}
                          style={{ display: "block", width: 88, minHeight: 44, marginTop: 4, borderRadius: 8, border: `1px solid ${C.border}`, padding: "0 8px", fontSize: 16 }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button type="button" onClick={() => commit(setStatus(priced, item.id, "confirmed"))} style={actionStyle(C.orange)}>
                        Confirm
                      </button>
                      <button type="button" aria-label={`Reject ${item.desc}`} onClick={() => commit(setStatus(priced, item.id, "rejected"))} style={actionStyle(C.textMuted, true)}>
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {groups.length === 0 && (
            <p style={{ color: C.textMuted, textAlign: "center" }}>No detected items on this scan yet. Upload a plan to populate the takeoff.</p>
          )}
        </div>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>Takeoff subtotal (ex GST)</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 700 }}>${formatAud(totals.subtotal, true)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 14 }}>
            <span>GST</span>
            <span style={{ fontFamily: FONT.mono }}>${formatAud(totals.gst, true)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4 }}>
            <span>Quote inc GST</span>
            <span style={{ fontFamily: FONT.mono }}>${formatAud(totals.total, true)}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: C.textMuted }}>{formatVerified(priced)}</div>
          {minVerifiedPct != null && !sendable && (
            <p style={{ color: C.amber, fontSize: 13 }}>This workspace asks for {minVerifiedPct}% verified before a quote can be sent. This takeoff is {verified}%.</p>
          )}
          {selected && <p style={{ fontSize: 12, color: C.textMuted }}>Selected: {selected.desc}</p>}
          {showContinue && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <PrimaryButton onClick={onNext} icon={<ArrowRight size={16} />}>Build estimate</PrimaryButton>
              <GhostButton onClick={onBack}>Back</GhostButton>
            </div>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
}

function actionStyle(color: string, ghost = false): React.CSSProperties {
  return {
    minHeight: 44,
    borderRadius: 10,
    padding: "0 12px",
    background: ghost ? "#fff" : color,
    color: ghost ? color : "#fff",
    border: `1px solid ${ghost ? C.border : color}`,
    fontWeight: 600,
    fontSize: 13,
  };
}
