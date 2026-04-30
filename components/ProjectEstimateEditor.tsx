import React, { useMemo, useState } from "react";
import {
  useProjects,
  estimateTotals,
  makeId,
  type Project,
  type ProjectEstimate,
  type EstimateLineItem,
  type CableRun,
} from "../contexts/ProjectContext";

const C = {
  bg: "#0A1628",
  navy: "#0F1E35",
  card: "#132240",
  blue: "#1D6EFD",
  green: "#00C48C",
  amber: "#FFB020",
  red: "#FF4D4D",
  text: "#EDF2FF",
  muted: "#5C7A9E",
  border: "#1A3358",
  dim: "#8BA4C4",
  purple: "#7C3AED",
};

interface Props {
  projectId: string;
  estimateId: string;
}

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
const fmtDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

// Cable types with indicative per-metre rates ($ AUD) for the calculator panel.
const CABLE_TYPES: { label: string; unitRate: number }[] = [
  { label: "2.5mm² TPS", unitRate: 4.8 },
  { label: "4mm² TPS", unitRate: 7.2 },
  { label: "6mm² TPS", unitRate: 11.5 },
  { label: "10mm² TPS", unitRate: 18.0 },
  { label: "Cat6 Data", unitRate: 2.4 },
  { label: "20mm Conduit", unitRate: 3.6 },
  { label: "25mm Conduit", unitRate: 4.8 },
];

const DEFAULT_CATEGORIES = [
  "Power",
  "Lighting",
  "Automation",
  "AV / Data",
  "Security",
  "Solar / Battery",
  "EV Charging",
  "Switchboard",
  "General",
];

const ProjectEstimateEditor: React.FC<Props> = ({ projectId, estimateId }) => {
  const { projects, saveEstimate } = useProjects();
  const project = projects.find(p => p.id === projectId);
  const estimate = project?.estimates.find(e => e.id === estimateId);

  const [showMargin, setShowMargin] = useState(false);
  const [showCable, setShowCable] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showWholesaler, setShowWholesaler] = useState(false);

  if (!project || !estimate) {
    return (
      <div style={{ padding: 32, color: C.muted, fontSize: 14 }}>
        Estimate not found.
      </div>
    );
  }

  const totals = estimateTotals(estimate);
  const categories = useMemo(() => {
    const s = new Set<string>(DEFAULT_CATEGORIES);
    estimate.lineItems.forEach(li => li.category && s.add(li.category));
    return Array.from(s);
  }, [estimate.lineItems]);

  const update = (patch: Partial<ProjectEstimate>) => {
    saveEstimate(projectId, {
      ...estimate,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateLine = (id: string, patch: Partial<EstimateLineItem>) => {
    update({
      lineItems: estimate.lineItems.map(li =>
        li.id === id ? { ...li, ...patch } : li,
      ),
    });
  };

  const addLine = () => {
    update({
      lineItems: [
        ...estimate.lineItems,
        {
          id: makeId(),
          description: "New item",
          category: "General",
          qty: 1,
          unitPrice: 0,
          unit: "EA",
        },
      ],
    });
  };

  const removeLine = (id: string) => {
    update({ lineItems: estimate.lineItems.filter(li => li.id !== id) });
  };

  const saveVersion = () => {
    const snapshot = {
      lineItems: estimate.lineItems,
      margin: estimate.margin,
      categoryMargins: estimate.categoryMargins,
      cableRuns: estimate.cableRuns,
    };
    const v = {
      id: makeId(),
      savedAt: new Date().toISOString(),
      label: `v${estimate.versions.length + 1} · ${fmtMoney(totals.total)}`,
      snapshot,
    };
    update({ versions: [...estimate.versions, v] });
  };

  const restoreVersion = (versionId: string) => {
    const v = estimate.versions.find(x => x.id === versionId);
    if (!v) return;
    update({
      lineItems: v.snapshot.lineItems,
      margin: v.snapshot.margin,
      categoryMargins: v.snapshot.categoryMargins,
      cableRuns: v.snapshot.cableRuns,
    });
    setShowVersions(false);
  };

  const toggleLock = () => {
    if (estimate.locked) {
      update({ locked: false, lockedAt: undefined });
    } else {
      update({ locked: true, lockedAt: new Date().toISOString() });
    }
  };

  const readOnly = estimate.locked;

  return (
    <div style={{ color: C.text }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <ToolbarBtn onClick={() => setShowMargin(true)} icon="%">
          Margins
        </ToolbarBtn>
        <ToolbarBtn onClick={() => setShowCable(true)} icon="⚙️">
          Cable / Conduit
        </ToolbarBtn>
        <div style={{ position: "relative" }}>
          <ToolbarBtn onClick={() => setShowVersions(v => !v)} icon="🕒">
            Versions ({estimate.versions.length})
          </ToolbarBtn>
          {showVersions && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                background: C.navy,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 8,
                minWidth: 280,
                zIndex: 20,
                boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
              }}
            >
              <button
                onClick={() => {
                  saveVersion();
                  setShowVersions(false);
                }}
                disabled={readOnly}
                style={{
                  width: "100%",
                  background: readOnly ? C.card : C.blue,
                  color: readOnly ? C.muted : "#fff",
                  border: "none",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: readOnly ? "not-allowed" : "pointer",
                  marginBottom: 8,
                }}
              >
                ＋ Save current as version
              </button>
              {estimate.versions.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, padding: "6px 2px" }}>
                  No saved versions yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[...estimate.versions]
                    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
                    .map(v => (
                      <div
                        key={v.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          borderRadius: 8,
                          background: C.card,
                        }}
                      >
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{v.label}</div>
                          <div style={{ color: C.muted, fontSize: 11 }}>
                            {fmtDateTime(v.savedAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => restoreVersion(v.id)}
                          disabled={readOnly}
                          style={{
                            background: "transparent",
                            color: readOnly ? C.muted : C.blue,
                            border: `1px solid ${readOnly ? C.border : C.blue}`,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: readOnly ? "not-allowed" : "pointer",
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={toggleLock}
          style={{
            background: estimate.locked ? `${C.amber}22` : C.card,
            color: estimate.locked ? C.amber : C.muted,
            border: `1px solid ${estimate.locked ? C.amber : C.border}`,
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {estimate.locked ? "🔒 Locked" : "🔓 Lock Estimate"}
        </button>
      </div>

      {readOnly && (
        <div
          style={{
            background: `${C.amber}15`,
            border: `1px solid ${C.amber}55`,
            color: C.amber,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          🔒 Estimate is locked — all cells are read-only. Unlock to make edits.
        </div>
      )}

      {/* Line items table */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 0.6 }}>
            LINE ITEMS ({estimate.lineItems.length})
          </div>
          {!readOnly && (
            <button
              onClick={addLine}
              style={{
                background: `${C.blue}22`,
                color: C.blue,
                border: `1px solid ${C.blue}`,
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ＋ Add line
            </button>
          )}
        </div>

        {estimate.lineItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
            No line items yet. Use <strong style={{ color: C.text }}>＋ Add line</strong> or upload
            a drawing to auto-detect components.
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.4fr 1.2fr 0.6fr 0.8fr 0.9fr auto",
                fontSize: 11,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: 0.6,
                padding: "8px 14px",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div>DESCRIPTION</div>
              <div>CATEGORY</div>
              <div>QTY</div>
              <div>UNIT PRICE</div>
              <div style={{ textAlign: "right" }}>LINE TOTAL</div>
              <div />
            </div>
            {estimate.lineItems.map((li, i) => (
              <div
                key={li.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.4fr 1.2fr 0.6fr 0.8fr 0.9fr auto",
                  padding: "8px 14px",
                  alignItems: "center",
                  borderBottom: i < estimate.lineItems.length - 1 ? `1px solid ${C.border}` : "none",
                  fontSize: 13,
                  gap: 6,
                }}
              >
                <input
                  value={li.description}
                  disabled={readOnly}
                  onChange={e => updateLine(li.id, { description: e.target.value })}
                  style={cellInput(readOnly)}
                />
                <select
                  value={li.category}
                  disabled={readOnly}
                  onChange={e => updateLine(li.id, { category: e.target.value })}
                  style={cellInput(readOnly)}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={li.qty}
                  disabled={readOnly}
                  onChange={e => updateLine(li.id, { qty: Number(e.target.value) || 0 })}
                  style={cellInput(readOnly)}
                />
                <input
                  type="number"
                  value={li.unitPrice}
                  disabled={readOnly}
                  onChange={e => updateLine(li.id, { unitPrice: Number(e.target.value) || 0 })}
                  style={cellInput(readOnly)}
                />
                <div style={{ textAlign: "right", fontWeight: 700 }}>
                  {fmtMoney(li.qty * li.unitPrice)}
                </div>
                <div>
                  {!readOnly && (
                    <button
                      onClick={() => removeLine(li.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: C.red,
                        cursor: "pointer",
                        fontSize: 18,
                        padding: "2px 6px",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Totals */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 16,
        }}
      >
        <SummaryRow label="Subtotal (ex GST)" value={fmtMoney(totals.subtotal)} />
        <SummaryRow
          label={`Margin${Object.keys(estimate.categoryMargins).length > 0 ? " (mixed)" : ` (${estimate.margin}%)`}`}
          value={`+ ${fmtMoney(totals.marginAmount)}`}
          color={C.amber}
        />
        <SummaryRow label="Subtotal with margin" value={fmtMoney(totals.subtotalWithMargin)} />
        <SummaryRow label={`GST (${estimate.gstRate}%)`} value={fmtMoney(totals.gst)} muted />
        <div style={{ height: 1, background: C.border, margin: "10px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Total inc GST</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.green }}>
            {fmtMoney(totals.total)}
          </span>
        </div>
      </div>

      {/* Margin Editor drawer */}
      {showMargin && (
        <Drawer title="Margin Editor" onClose={() => setShowMargin(false)}>
          <MarginEditor
            estimate={estimate}
            categories={categories}
            readOnly={readOnly}
            onChange={patch => update(patch)}
          />
        </Drawer>
      )}

      {/* Cable Calculator drawer */}
      {showCable && (
        <Drawer title="Cable / Conduit Calculator" onClose={() => setShowCable(false)}>
          <CableCalculator
            runs={estimate.cableRuns}
            readOnly={readOnly}
            onChange={runs => update({ cableRuns: runs })}
            onRequestQuote={() => { setShowCable(false); setShowWholesaler(true); }}
          />
        </Drawer>
      )}

      {/* Wholesaler quote modal */}
      {showWholesaler && (
        <WholesalerQuoteModal
          estimate={estimate}
          project={project}
          onClose={() => setShowWholesaler(false)}
        />
      )}
    </div>
  );
};

const cellInput = (readOnly: boolean): React.CSSProperties => ({
  background: readOnly ? "transparent" : C.bg,
  color: C.text,
  border: `1px solid ${readOnly ? "transparent" : C.border}`,
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  cursor: readOnly ? "default" : "text",
});

const SummaryRow: React.FC<{
  label: string;
  value: string;
  color?: string;
  muted?: boolean;
}> = ({ label, value, color, muted }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 8,
      fontSize: 13,
      color: muted ? C.muted : C.text,
    }}
  >
    <span>{label}</span>
    <span style={{ fontWeight: 700, color: color ?? undefined }}>{value}</span>
  </div>
);

const ToolbarBtn: React.FC<{
  icon: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ icon, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      color: C.text,
      padding: "8px 12px",
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    <span>{icon}</span>
    {children}
  </button>
);

const Drawer: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => (
  <div
    role="dialog"
    aria-modal="true"
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(4,8,20,0.7)",
      display: "flex",
      justifyContent: "flex-end",
      zIndex: 60,
    }}
    onClick={onClose}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: 420,
        background: C.navy,
        borderLeft: `1px solid ${C.border}`,
        padding: 20,
        overflowY: "auto",
        color: C.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ─── Margin Editor ──────────────────────────────────────────
const MarginEditor: React.FC<{
  estimate: ProjectEstimate;
  categories: string[];
  readOnly: boolean;
  onChange: (patch: Partial<ProjectEstimate>) => void;
}> = ({ estimate, categories, readOnly, onChange }) => {
  const setGlobal = (v: number) =>
    onChange({ margin: Math.max(0, Math.min(100, Math.round(v))) });

  const setCategory = (cat: string, v: number | null) => {
    const next = { ...estimate.categoryMargins };
    if (v === null) delete next[cat];
    else next[cat] = Math.max(0, Math.min(100, Math.round(v)));
    onChange({ categoryMargins: next });
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        Set a global margin that applies to every line item. Override per category
        below — overrides take precedence over the global rate. Totals recalculate live.
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 8 }}>
          GLOBAL MARGIN
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            value={estimate.margin}
            disabled={readOnly}
            onChange={e => setGlobal(Number(e.target.value))}
            style={{
              flex: 1,
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 14,
            }}
          />
          <span style={{ color: C.muted }}>%</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {[10, 15, 20, 25, 30].map(p => (
            <button
              key={p}
              onClick={() => setGlobal(p)}
              disabled={readOnly}
              style={{
                flex: 1,
                background: estimate.margin === p ? `${C.blue}22` : "transparent",
                border: `1px solid ${estimate.margin === p ? C.blue : C.border}`,
                color: estimate.margin === p ? C.blue : C.muted,
                padding: "6px 0",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: readOnly ? "not-allowed" : "pointer",
              }}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 8 }}>
        PER CATEGORY OVERRIDES
      </div>
      {categories.map(cat => {
        const override = estimate.categoryMargins[cat];
        const enabled = typeof override === "number";
        return (
          <div
            key={cat}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              marginBottom: 6,
            }}
          >
            <div style={{ flex: 1, fontSize: 13 }}>{cat}</div>
            <input
              type="number"
              placeholder={`${estimate.margin}`}
              value={enabled ? override : ""}
              disabled={readOnly}
              onChange={e => {
                const v = e.target.value;
                if (v === "") setCategory(cat, null);
                else setCategory(cat, Number(v));
              }}
              style={{
                width: 64,
                background: C.bg,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 13,
                textAlign: "right",
              }}
            />
            <span style={{ color: C.muted, fontSize: 12 }}>%</span>
            {enabled && !readOnly && (
              <button
                onClick={() => setCategory(cat, null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 16,
                }}
                title="Reset to global"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Cable Calculator ───────────────────────────────────────
const CableCalculator: React.FC<{
  runs: CableRun[];
  readOnly: boolean;
  onChange: (runs: CableRun[]) => void;
  onRequestQuote?: () => void;
}> = ({ runs, readOnly, onChange, onRequestQuote }) => {
  const [lengthInput, setLengthInput] = useState("");
  const [cableType, setCableType] = useState(CABLE_TYPES[0].label);
  const [waste, setWaste] = useState(10);

  const add = () => {
    const l = Number(lengthInput);
    if (!l || l <= 0) return;
    const total = +(l * (1 + waste / 100)).toFixed(2);
    const run: CableRun = {
      id: makeId(),
      cableType,
      lengthMeters: l,
      wasteFactorPct: waste,
      totalLength: total,
    };
    onChange([...runs, run]);
    setLengthInput("");
  };

  const remove = (id: string) => onChange(runs.filter(r => r.id !== id));

  const grandTotal = runs.reduce((sum, r) => sum + r.totalLength, 0);

  const rateOf = (typeLabel: string) =>
    CABLE_TYPES.find(c => c.label === typeLabel)?.unitRate ?? 0;

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        Enter a cable/conduit run length. The calculator applies a waste factor
        (10% default) and outputs the quantity to order.
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <Field label="CABLE / CONDUIT TYPE">
          <select
            value={cableType}
            onChange={e => setCableType(e.target.value)}
            disabled={readOnly}
            style={drawerInput}
          >
            {CABLE_TYPES.map(c => (
              <option key={c.label} value={c.label}>
                {c.label} (${c.unitRate.toFixed(2)}/m)
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="RUN LENGTH (m)">
            <input
              type="number"
              value={lengthInput}
              onChange={e => setLengthInput(e.target.value)}
              placeholder="0"
              disabled={readOnly}
              style={drawerInput}
            />
          </Field>
          <Field label="WASTE %">
            <input
              type="number"
              value={waste}
              onChange={e => setWaste(Number(e.target.value) || 0)}
              disabled={readOnly}
              style={drawerInput}
            />
          </Field>
        </div>
        <button
          onClick={add}
          disabled={readOnly || !lengthInput}
          style={{
            marginTop: 10,
            width: "100%",
            background: !lengthInput || readOnly ? C.card : C.blue,
            color: !lengthInput || readOnly ? C.muted : "#fff",
            border: "none",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: !lengthInput || readOnly ? "not-allowed" : "pointer",
          }}
        >
          Calculate & Add to BOM
        </button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 8 }}>
        CABLE RUNS ({runs.length})
      </div>
      {runs.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, padding: 10 }}>
          No runs added yet.
        </div>
      ) : (
        runs.map(r => (
          <div
            key={r.id}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 10,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.cableType}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {r.lengthMeters}m + {r.wasteFactorPct}% waste →{" "}
                <strong style={{ color: C.text }}>{r.totalLength}m</strong> ·{" "}
                {fmtMoney(r.totalLength * rateOf(r.cableType))}
              </div>
            </div>
            {!readOnly && (
              <button
                onClick={() => remove(r.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.red,
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            )}
          </div>
        ))
      )}

      {runs.length > 0 && (
        <>
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              background: `${C.green}15`,
              border: `1px solid ${C.green}55`,
              borderRadius: 10,
              fontSize: 13,
              color: C.green,
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Total to order</span>
            <span>{grandTotal.toFixed(1)}m</span>
          </div>
          {onRequestQuote && (
            <button
              onClick={onRequestQuote}
              style={{
                marginTop: 10,
                width: "100%",
                background: C.amber,
                color: "#0A1628",
                border: "none",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              📧 Request Quote from Wholesaler
            </button>
          )}
        </>
      )}
    </div>
  );
};

const drawerInput: React.CSSProperties = {
  width: "100%",
  background: C.bg,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 14,
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 10, flex: 1 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 4 }}>
      {label}
    </div>
    {children}
  </div>
);

// ─── Wholesaler Quote Modal ──────────────────────────────────────────────────

const N8N_WEBHOOK = "https://damienc13.app.n8n.cloud/webhook/electrascan-estimate";

const WholesalerQuoteModal: React.FC<{
  estimate: ProjectEstimate;
  project: Project;
  onClose: () => void;
}> = ({ estimate, project, onClose }) => {
  const [wholesalerEmail, setWholesalerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estRef = estimate.reference ?? estimate.number;
  const subject = `Quote Request — ${estRef} — ${project.name} — Vesh Electrical`;

  const cableTotal = estimate.cableRuns.reduce((s, r) => s + r.totalLength * (CABLE_TYPES.find(c => c.label === r.cableType)?.unitRate ?? 0), 0);

  const send = async () => {
    if (!wholesalerEmail.trim()) { setError("Enter the wholesaler email first."); return; }
    setSending(true);
    setError(null);
    try {
      await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "wholesaler_quote_request",
          estimate_ref: estRef,
          project_name: project.name,
          client_name: project.clientName,
          wholesaler: "TLE Brookvale",
          wholesaler_address: "3/192 Harbord Rd, Brookvale NSW 2100",
          wholesaler_email: wholesalerEmail.trim(),
          subject,
          cable_runs: estimate.cableRuns.map(r => ({
            type: r.cableType,
            run_m: r.lengthMeters,
            waste_pct: r.wasteFactorPct,
            ordered_m: r.totalLength,
            unit_rate: CABLE_TYPES.find(c => c.label === r.cableType)?.unitRate ?? 0,
            line_total: +(r.totalLength * (CABLE_TYPES.find(c => c.label === r.cableType)?.unitRate ?? 0)).toFixed(2),
          })),
          cable_total: +cableTotal.toFixed(2),
          line_items: estimate.lineItems.map(li => ({
            description: li.description,
            category: li.category,
            qty: li.qty,
            unit: li.unit,
          })),
          notes: notes.trim() || null,
          tenant: "Vesh Electrical",
          sent_at: new Date().toISOString(),
        }),
      });
      setSent(true);
    } catch {
      setError("Send failed — check n8n webhook is active.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 540, padding: 28 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Request Wholesaler Quote</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>TLE Brookvale · 3/192 Harbord Rd, Brookvale NSW 2100</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 6 }}>Quote request sent to TLE Brookvale</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 24 }}>{wholesalerEmail}</div>
            <button onClick={onClose} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* BOM summary */}
            <div style={{ background: C.card, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 8 }}>BOM SUMMARY — {estRef}</div>
              {estimate.cableRuns.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted }}>No cable runs added.</div>
              ) : (
                estimate.cableRuns.map(r => {
                  const rate = CABLE_TYPES.find(c => c.label === r.cableType)?.unitRate ?? 0;
                  return (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.text }}>{r.cableType}</span>
                      <span style={{ color: C.dim }}>{r.totalLength}m · {fmtMoney(r.totalLength * rate)}</span>
                    </div>
                  );
                })
              )}
              {estimate.cableRuns.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.green, borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 8 }}>
                  <span>Cable total</span><span>{fmtMoney(cableTotal)}</span>
                </div>
              )}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{estimate.lineItems.length} line items included</div>
            </div>

            {/* To field */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 4 }}>TO (WHOLESALER EMAIL)</div>
              <input
                type="email"
                placeholder="Enter TLE Brookvale ordering email..."
                value={wholesalerEmail}
                onChange={e => setWholesalerEmail(e.target.value)}
                style={{ ...drawerInput, fontSize: 13 }}
              />
            </div>

            {/* Subject (read-only) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 4 }}>SUBJECT</div>
              <div style={{ fontSize: 12, color: C.dim, background: C.card, borderRadius: 8, padding: "8px 10px", border: `1px solid ${C.border}` }}>{subject}</div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 4 }}>NOTES (OPTIONAL)</div>
              <textarea
                placeholder="Any special notes for TLE..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ ...drawerInput, fontSize: 13, resize: "vertical" }}
              />
            </div>

            {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 0", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={send} disabled={sending} style={{ flex: 2, background: sending ? C.muted : C.amber, color: "#0A1628", border: "none", borderRadius: 10, padding: "10px 0", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", fontSize: 14 }}>
                {sending ? "Sending…" : "📧 Send Quote Request"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectEstimateEditor;
