import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { C, FONT, RADIUS } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import SourcePlanPreview from "../SourcePlanPreview";
import PlanViewport from "./PlanViewport";
import { fetchRateLibrary, type RateRow } from "../../services/supabaseData";
import type { StoredDetectedItem } from "../../lib/scanRecord";
import { computeQuoteTotals, formatAud } from "../../lib/quoteTotals";
import {
  GROUP_LABEL,
  GROUP_ORDER,
  STATUS_LABEL,
  addSymbol,
  canSendQuote,
  formatVerified,
  setItemQty,
  setStatus,
  verifiedPercent,
  type TakeoffGroupId,
} from "../../lib/takeoff";
import { loadAssemblies, loadLabourRate, type Assembly } from "../../lib/assemblies";
import { priceItem } from "../../lib/quoteSource";
import { loadPriceList } from "../../lib/contractorPrices";
import { takeoffRundown } from "../../lib/takeoffRundown";
import { legendFlags } from "../../lib/legendMatch";
import { scanRecap, type DetectionCorrection } from "../../lib/reviewQueue";
import { recallPlanContext } from "../../lib/planContext";
import ConfidenceReviewQueue from "./ConfidenceReviewQueue";

/** Slate that stays above 4.5:1 for white symbol text when a hit is rejected. */
const REJECTED_MARK = "#475569";

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
  const [ratesState, setRatesState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addGroup, setAddGroup] = useState<TakeoffGroupId | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState<Record<number, string>>({});
  const planRef = useRef<HTMLDivElement>(null);
  const addButtonRefs = useRef<Partial<Record<TakeoffGroupId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchRateLibrary();
        if (cancelled) return;
        if (Array.isArray(result?.data)) setRates(result.data as RateRow[]);
        setRatesState("ready");
      } catch {
        if (!cancelled) setRatesState("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (addGroup) planRef.current?.focus();
  }, [addGroup]);

  const assemblies = loadAssemblies();
  const labourRate = loadLabourRate();
  const priceList = loadPriceList();
  const rundown = useMemo(
    () => takeoffRundown(items, rates, assemblies, labourRate, priceList),
    [items, rates, assemblies, labourRate, priceList],
  );
  const priced = useMemo(() => rundown.groups.flatMap(group => group.rows.map(row => ({
    ...row.item,
    unitPrice: row.quote.sellUnit,
    materialUnit: row.quote.materialUnit,
    labourUnit: row.quote.labourUnit,
  }))), [rundown]);
  const plan = recallPlanContext(fileName);
  const flags = legendFlags([...(plan?.legend ?? []), ...(plan?.schedules ?? [])], priced);
  const recap = scanRecap(priced, { pageCount: plan?.pageCount, flags });
  const totals = useMemo(() => computeQuoteTotals(rundown.total, marginPct), [rundown.total, marginPct]);
  const verified = verifiedPercent(priced);
  const sendable = canSendQuote(priced, minVerifiedPct);
  const selected = priced.find(item => item.id === selectedId) ?? null;

  function commit(next: StoredDetectedItem[]) {
    onChange(next.map(item => {
      const quote = priceItem(item, rates, assemblies, labourRate, priceList);
      return { ...item, unitPrice: quote.sellUnit, materialUnit: quote.materialUnit, labourUnit: quote.labourUnit };
    }));
  }

  function placeAt(x: number, y: number) {
    if (!addGroup) return;
    const next = addSymbol(priced, addGroup, { x, y }, rates);
    const added = next[next.length - 1];
    commit(next);
    setSelectedId(added.id);
    setAddGroup(null);
  }

  function onPlanClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!addGroup) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100));
    placeAt(x, y);
  }

  function cancelAdd() {
    const id = addGroup;
    setAddGroup(null);
    if (id) addButtonRefs.current[id]?.focus();
  }

  function onWorkspaceKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (addGroup) {
        event.preventDefault();
        cancelAdd();
        return;
      }
      if (selectedId != null) {
        event.preventDefault();
        setSelectedId(null);
      }
      return;
    }
    if (event.key === "Enter" && addGroup && event.target === planRef.current) {
      event.preventDefault();
      placeAt(50, 50);
    }
  }

  const addHint = addGroup
    ? `Tap the plan to add a ${GROUP_LABEL[addGroup].replace(/s$/, "").toLowerCase()}, or press Enter. Escape cancels.`
    : "Pinch to zoom. Tap a symbol to select it.";

  const planVisible = planOpen || addGroup != null;

  function assignAssembly(itemId: number, assembly: Assembly) {
    commit(priced.map(row => row.id === itemId ? {
      ...row,
      manualPrice: true,
      rateCode: "",
      unitPrice: assembly.sellPrice,
      group: row.group,
    } : row));
  }

  function assignRate(itemId: number, code: string) {
    commit(priced.map(row => row.id === itemId ? { ...row, manualPrice: false, rateCode: code } : row));
  }

  function assignTypedPrice(itemId: number) {
    const amount = Number(priceDraft[itemId]);
    if (!(amount > 0)) return;
    commit(priced.map(row => row.id === itemId ? { ...row, manualPrice: true, rateCode: "", unitPrice: amount } : row));
  }

  const planCard = (
    <Card style={{ padding: 0 }}>
      <div className="es-plan-toolbar" style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600 }}>Plan</span>
        <span style={{ fontSize: 12, color: C.textMuted }}>{addHint}</span>
      </div>
      <PlanViewport>
      <div
        ref={planRef}
        className="es-plan-canvas"
        role="group"
        tabIndex={addGroup ? 0 : -1}
        aria-label={addGroup ? `Plan, placing ${GROUP_LABEL[addGroup]}. Enter places the symbol. Escape cancels.` : "Plan"}
        style={{ position: "relative", background: C.bgSoft }}
        onClick={onPlanClick}
      >
        <SourcePlanPreview file={file} fileName={fileName} />
        {priced.flatMap(item => (item.marks ?? []).slice(0, Math.max(item.qty, item.status === "rejected" ? 1 : 0)).map((mark, index) => {
          const active = selectedId === item.id;
          const rejected = item.status === "rejected";
          return (
            <button
              key={`${item.id}-${index}`}
              type="button"
              aria-label={`${item.desc} symbol ${index + 1}${rejected ? ", rejected" : ""}`}
              aria-pressed={active}
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
                border: `2px solid ${active ? C.orange : rejected ? "#334155" : "#fff"}`,
                background: rejected ? REJECTED_MARK : active ? C.orange : "#1f56e6",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                boxShadow: active ? "0 0 0 4px rgba(31,86,230,0.25)" : "0 1px 3px rgba(15,23,42,0.25)",
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
          <button type="button" aria-label={`Confirm ${selected.desc} on the plan`} onClick={() => commit(setStatus(priced, selected.id, "confirmed"))} style={actionStyle(C.orange)}>Confirm</button>
          <button type="button" aria-label={`Reject ${selected.desc} on the plan`} onClick={() => commit(setStatus(priced, selected.id, "rejected"))} style={actionStyle(C.textMuted, true)}>Reject</button>
        </div>
      )}
    </Card>
  );

  return (
    <div className="es-takeoff anim-in" role="region" aria-label="Takeoff" onKeyDown={onWorkspaceKeyDown}>
      <div className="es-takeoff-panel">
      <Card style={{ padding: 16 }}>
        <section>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontFamily: FONT.heading, fontSize: 18 }}>Scanned items</h2>
          <span role="status" style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: C.orange }}>{formatVerified(priced)}</span>
        </div>
        <div className="es-stat-grid" style={{ margin: "12px 0" }}>
          <SummaryStat label="Items scanned" value={String(rundown.scanned)} />
          <SummaryStat label="Priced" value={String(rundown.priced)} />
          <SummaryStat label="Not priced" value={String(rundown.unpriced)} tone={rundown.unpriced > 0 ? C.amber : C.green} />
          <SummaryStat label="Total ex GST" value={`$${formatAud(rundown.total, true)}`} />
        </div>
        <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 13 }}>
          A line is priced when it has an assembly, a rate code, or a price. Rejected hits stay off the quote.
        </p>
        {ratesState === "loading" && (
          <p role="status" style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 13 }}>Checking the rate library…</p>
        )}
        {ratesState === "unavailable" && (
          <p role="status" style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 13 }}>
            Rate library is unavailable. Prices already on these lines stay as saved.
          </p>
        )}
        {minVerifiedPct != null && !sendable && (
          <p role="status" style={{ margin: "0 0 12px", color: C.amber, fontSize: 13 }}>
            This workspace asks for {minVerifiedPct}% verified before a quote can be sent. This takeoff is {verified}%.
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {GROUP_ORDER.filter(id => id !== "other").map(id => (
            <button
              key={id}
              ref={node => { addButtonRefs.current[id] = node; }}
              type="button"
              aria-pressed={addGroup === id}
              aria-label={`Add ${GROUP_LABEL[id]}`}
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
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Plus size={12} aria-hidden="true" /> {GROUP_LABEL[id]}
            </button>
          ))}
        </div>
        <ConfidenceReviewQueue
          items={priced}
          flags={flags}
          onConfirm={(item, correction) => { void storeCorrection(correction); commit(setStatus(priced, item.id, "confirmed")); }}
          onReject={(item, correction) => { void storeCorrection(correction); commit(setStatus(priced, item.id, "rejected")); }}
          onFix={(item, correction) => {
            void storeCorrection(correction);
            commit(priced.map(row => row.id === item.id ? { ...row, desc: correction.correctedDesc, qty: correction.correctedQty, status: "confirmed" as const } : row));
          }}
        />
        {rundown.gaps.length > 0 && (
          <section aria-label="Not priced" style={{ border: `1px solid ${C.amber}`, borderRadius: RADIUS.lg, padding: 12, marginBottom: 16, background: C.amberSoft }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Not priced</h3>
            <p style={{ margin: "0 0 10px", color: C.textMuted, fontSize: 13 }}>
              These lines have no assembly, rate, or price. Assign one and they join the quote.
            </p>
            {rundown.gaps.map(row => (
              <div key={row.item.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700 }}>{row.item.desc}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>Qty {row.item.qty} · {row.category}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <select
                    aria-label={`Assembly for ${row.item.desc}`}
                    defaultValue=""
                    onChange={event => {
                      const assembly = assemblies.find(candidate => candidate.id === event.target.value);
                      if (assembly) assignAssembly(row.item.id, assembly);
                    }}
                    style={fieldStyle}
                  >
                    <option value="">Assign assembly</option>
                    {assemblies.map(assembly => <option key={assembly.id} value={assembly.id}>{assembly.name}</option>)}
                  </select>
                  <select
                    aria-label={`Rate for ${row.item.desc}`}
                    defaultValue=""
                    onChange={event => { if (event.target.value) assignRate(row.item.id, event.target.value); }}
                    style={fieldStyle}
                  >
                    <option value="">Assign rate</option>
                    {rates.map(rate => <option key={rate.code} value={rate.code}>{rate.code} · {rate.description}</option>)}
                  </select>
                  <input
                    aria-label={`Price for ${row.item.desc}`}
                    inputMode="decimal"
                    placeholder="Price"
                    value={priceDraft[row.item.id] ?? ""}
                    onChange={event => setPriceDraft(current => ({ ...current, [row.item.id]: event.target.value }))}
                    style={{ ...fieldStyle, width: 110 }}
                  />
                  <button type="button" onClick={() => assignTypedPrice(row.item.id)} style={actionStyle(C.orange)}>Use price</button>
                </div>
              </div>
            ))}
          </section>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rundown.groups.map(group => (
            <section key={group.category} aria-label={group.category} style={{ border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
              <div className="es-group-head" style={{ padding: "10px 12px", background: C.bg, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{group.category}</div>
                <div style={{ fontFamily: FONT.mono, fontWeight: 700 }}>${formatAud(group.total, true)}</div>
              </div>
              {group.rows.map(row => {
                const item = row.item;
                const active = selectedId === item.id;
                const rejected = item.status === "rejected";
                const countId = `takeoff-count-${item.id}`;
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "10px 12px",
                      borderTop: `1px solid ${C.border}`,
                      background: active ? "#eef3ff" : C.bgCard,
                    }}
                  >
                    <div className="es-item-main" style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => { setSelectedId(item.id); if (file) setPlanOpen(true); }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 44,
                          textAlign: "left",
                          background: "transparent",
                          color: "inherit",
                          padding: 0,
                        }}
                      >
                        <div style={{ fontWeight: 600, textDecoration: rejected ? "line-through" : "none", overflowWrap: "anywhere" }}>{item.desc}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          {STATUS_LABEL[item.status || "ai"]}
                          {item.rateCode ? ` · ${item.rateCode}` : ""}
                          {" · "}
                          {item.qty} × {row.priced ? `$${formatAud(row.quote.sellUnit, true)}` : "No price"}
                          {row.priced ? ` · $${formatAud(row.lineTotal, true)}` : ""}
                        </div>
                      </button>
                      <label htmlFor={countId} style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>
                        Count
                        <input
                          id={countId}
                          aria-label={`Count for ${item.desc}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={item.qty}
                          onChange={event => commit(setItemQty(priced, item.id, Number(event.target.value)))}
                          style={{ display: "block", width: 88, minHeight: 44, marginTop: 4, borderRadius: 8, border: `1px solid ${C.border}`, padding: "0 8px", fontSize: 16, background: C.bgCard }}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <button type="button" aria-label={`Confirm ${item.desc}`} onClick={() => commit(setStatus(priced, item.id, "confirmed"))} style={actionStyle(C.orange)}>
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
          {rundown.groups.length === 0 && (
            <div className="es-empty" role="status" aria-label="No detected items on this scan yet.">
              <p style={{ margin: 0, fontFamily: FONT.heading, fontWeight: 600, color: C.text }}>No detected items on this scan yet.</p>
              <p style={{ margin: "6px 0 0", color: C.textMuted, fontSize: 14 }}>Upload a plan, or add a symbol above, to populate the takeoff.</p>
            </div>
          )}
        </div>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>Takeoff subtotal (ex GST)</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 28, fontWeight: 700, overflowWrap: "anywhere" }}>${formatAud(totals.subtotal, true)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8, fontSize: 14 }}>
            <span>GST</span>
            <span style={{ fontFamily: FONT.mono }}>${formatAud(totals.gst, true)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: 700, marginTop: 4 }}>
            <span>Quote inc GST</span>
            <span style={{ fontFamily: FONT.mono }}>${formatAud(totals.total, true)}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: C.textMuted }}>{formatVerified(priced)}</div>
          <div style={{ marginTop: 12, fontSize: 13, color: C.textMuted }}>
            <div style={{ fontWeight: 700, color: C.text }}>Scan recap</div>
            <div>{recap.pagesRead == null ? "Pages read were not stored on this scan." : `${recap.pagesRead} pages read.`}</div>
            <div>{recap.detected} items · {recap.confirmed} confirmed · {recap.rejected} rejected · {recap.waiting} still to review.</div>
            {recap.anomalies.length === 0 ? <div>No legend anomalies.</div> : recap.anomalies.slice(0, 6).map(line => <div key={line}>{line}</div>)}
          </div>
          {selected && <p style={{ fontSize: 12, color: C.textMuted }}>Selected: {selected.desc}</p>}
          {showContinue && (
            <div className="es-takeoff-actions" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <PrimaryButton onClick={onNext} icon={<ArrowRight size={16} />}>Build estimate</PrimaryButton>
              <GhostButton onClick={onBack}>Back</GhostButton>
            </div>
          )}
        </div>
        </section>
      </Card>
      </div>
      {file && !addGroup && (
        <button
          type="button"
          aria-expanded={planOpen}
          onClick={() => setPlanOpen(open => !open)}
          style={{ ...actionStyle(C.text, true), alignSelf: "flex-start" }}
        >
          {planOpen ? "Hide plan" : "View on plan"}
        </button>
      )}
      {planVisible && (file || addGroup) ? planCard : null}
    </div>
  );
}

function storeCorrection(correction: DetectionCorrection) {
  try {
    const saved = JSON.parse(localStorage.getItem("es-corrections") || "[]");
    saved.push(correction);
    localStorage.setItem("es-corrections", JSON.stringify(saved));
  } catch {
    /* ignore */
  }
  fetch("/api/beta/records?kind=corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: correction.itemId,
      symbol: correction.symbol,
      original_desc: correction.originalDesc,
      original_qty: correction.originalQty,
      corrected_desc: correction.correctedDesc,
      corrected_qty: correction.correctedQty,
      action: correction.action,
    }),
  }).catch(() => undefined);
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bgCard }}>
      <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: tone || C.text }}>{value}</div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 10px",
  fontSize: 16,
  background: C.bg,
  color: C.text,
};

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
