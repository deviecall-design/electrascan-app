import React, { useState } from "react";
import { C, FONT } from "./tokens";
import type { StoredDetectedItem } from "../../lib/scanRecord";
import { confidenceQueue, correctionFrom, type DetectionCorrection } from "../../lib/reviewQueue";
import type { LegendFlag } from "../../lib/legendMatch";

export default function ConfidenceReviewQueue({
  items,
  flags,
  onConfirm,
  onReject,
  onFix,
}: {
  items: StoredDetectedItem[];
  flags: LegendFlag[];
  onConfirm: (item: StoredDetectedItem, correction: DetectionCorrection) => void;
  onReject: (item: StoredDetectedItem, correction: DetectionCorrection) => void;
  onFix: (item: StoredDetectedItem, correction: DetectionCorrection) => void;
}) {
  const queue = confidenceQueue(items.map(item => ({
    ...item,
    desc: item.desc,
    qty: item.qty,
    conf: item.conf || 0,
  })));
  const [fixId, setFixId] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("");

  if (queue.length === 0 && flags.length === 0) return null;

  return (
    <section aria-label="Confidence review" style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Least sure first</h3>
      <p style={{ margin: "0 0 10px", color: C.textMuted, fontSize: 13 }}>
        Confirm, fix, or reject. Corrections keep the original detection so it can improve the next read.
      </p>
      {flags.map(flag => (
        <p key={flag.message} style={{ margin: "0 0 8px", color: flag.kind === "missing_on_plan" ? C.amber : C.red, fontSize: 13 }}>
          {flag.message}
        </p>
      ))}
      {queue.map(item => {
        const stored = items.find(row => row.id === item.id)!;
        const pct = Math.round((item.conf > 1 ? item.conf : item.conf * 100));
        return (
          <div key={item.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700 }}>{item.desc}</div>
            <div style={{ color: C.textMuted, fontSize: 13 }}>{pct}% confidence · qty {item.qty}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => onConfirm(stored, correctionFrom(item, "confirmed"))} style={tap(C.orange, "#fff")}>
                Confirm
              </button>
              <button type="button" onClick={() => { setFixId(item.id); setDesc(item.desc); setQty(String(item.qty)); }} style={tap("#fff", C.text, true)}>
                Fix
              </button>
              <button type="button" onClick={() => onReject(stored, correctionFrom(item, "rejected"))} style={tap("#fff", C.red, true)}>
                Reject
              </button>
            </div>
            {fixId === item.id && (
              <form
                onSubmit={event => {
                  event.preventDefault();
                  const nextQty = Number(qty);
                  onFix(stored, correctionFrom(item, "fixed", { desc: desc.trim() || item.desc, qty: nextQty > 0 ? nextQty : item.qty }));
                  setFixId(null);
                }}
                style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
              >
                <input aria-label={`Correct description for ${item.desc}`} value={desc} onChange={event => setDesc(event.target.value)} style={field} />
                <input aria-label={`Correct quantity for ${item.desc}`} inputMode="numeric" value={qty} onChange={event => setQty(event.target.value)} style={{ ...field, width: 88 }} />
                <button type="submit" style={tap(C.orange, "#fff")}>Save fix</button>
              </form>
            )}
          </div>
        );
      })}
    </section>
  );
}

function tap(background: string, color: string, ghost = false): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 10,
    border: ghost ? `1px solid ${C.border}` : "none",
    background,
    color,
    fontWeight: 700,
    fontFamily: FONT.heading,
  };
}

const field: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 10px",
  fontSize: 16,
  background: C.bg,
  color: C.text,
};
