import React, { useState } from "react";
import { C, FONT } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import {
  DEFAULT_ASSEMBLIES,
  DEFAULT_LABOUR_RATE,
  loadAssemblies,
  loadLabourRate,
  saveAssemblies,
  saveLabourRate,
  type Assembly,
} from "../../lib/assemblies";

export default function AssembliesCard() {
  const [rows, setRows] = useState<Assembly[]>(() => loadAssemblies());
  const [labourRate, setLabourRate] = useState(() => loadLabourRate());
  const [note, setNote] = useState<string | null>(null);

  function update(id: string, patch: Partial<Assembly>) {
    setRows(current => current.map(row => (row.id === id ? { ...row, ...patch, isDefault: false } : row)));
  }

  async function save() {
    saveAssemblies(rows);
    saveLabourRate(labourRate);
    setNote("Saved in this browser.");
    try {
      const res = await fetch("/api/beta/records?kind=assemblies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assembly_key: "workspace",
          name: "Workspace assemblies",
          keywords: [],
          materials: rows,
          labour_hours: 0,
          sell_price: labourRate,
          is_default: rows.every(row => row.isDefault),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setNote(body.error || "Saved in this browser. The shared copy needs the new migration.");
      } else {
        setNote("Saved in this browser and in the workspace.");
      }
    } catch {
      setNote("Saved in this browser. The shared copy could not be reached.");
    }
  }

  return (
    <Card style={{ padding: 22, marginTop: 16 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Assemblies and labour</h2>
      <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
        Each detected symbol expands into materials, labour hours, and a sell price. The quote and the takeoff use this price. Defaults are a starting point for Australian electrical work. Vesh should edit them.
      </p>
      <label style={{ display: "block", fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
        Default electrician hourly rate, ex GST
        <input
          aria-label="Electrician hourly rate"
          inputMode="decimal"
          value={labourRate}
          onChange={event => setLabourRate(Number(event.target.value) || DEFAULT_LABOUR_RATE)}
          style={field}
        />
      </label>
      {rows.map(row => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) 90px 110px", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontWeight: 700 }}>{row.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {row.materials.map(part => part.name).join(", ") || "No materials"}
              {row.isDefault ? " · Default" : " · Edited"}
            </div>
          </div>
          <label style={{ fontSize: 12, color: C.textMuted }}>
            Hours
            <input aria-label={`${row.name} hours`} inputMode="decimal" value={row.labourHours} onChange={event => update(row.id, { labourHours: Number(event.target.value) || 0 })} style={field} />
          </label>
          <label style={{ fontSize: 12, color: C.textMuted }}>
            Sell ex GST
            <input aria-label={`${row.name} sell price`} inputMode="decimal" value={row.sellPrice} onChange={event => update(row.id, { sellPrice: Number(event.target.value) || 0 })} style={field} />
          </label>
        </div>
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <PrimaryButton type="button" onClick={() => void save()}>Save assemblies</PrimaryButton>
        <GhostButton type="button" onClick={() => { setRows(DEFAULT_ASSEMBLIES); setLabourRate(DEFAULT_LABOUR_RATE); }}>Restore defaults</GhostButton>
      </div>
      {note && <p style={{ color: C.textMuted, fontSize: 13 }}>{note}</p>}
    </Card>
  );
}

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 44,
  marginTop: 4,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 10px",
  fontSize: 16,
  background: C.bg,
  color: C.text,
  fontFamily: FONT.body,
  boxSizing: "border-box",
};
