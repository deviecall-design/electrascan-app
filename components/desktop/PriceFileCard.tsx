import React, { useEffect, useState } from "react";
import { C, FONT, RADIUS } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import { loadAssemblies, type Assembly } from "../../lib/assemblies";
import { fetchPriceList, storePriceList } from "../../lib/contractorPrices";
import {
  acceptedPrices,
  parsePriceFile,
  reviewPriceRows,
  type ReviewedPriceRow,
} from "../../lib/priceFile";

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  padding: "0 8px",
  fontSize: 16,
  background: C.bg,
  color: C.text,
  width: "100%",
  boxSizing: "border-box",
};

export default function PriceFileCard() {
  const assemblies = loadAssemblies();
  const [rows, setRows] = useState<ReviewedPriceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPriceList().then(result => {
      if (cancelled) return;
      setSavedCount(result.rows.length);
      if (result.migration) setNotice("The price list is kept in this browser until the price-list migration is applied.");
    });
    return () => { cancelled = true; };
  }, []);

  async function onFile(file: File | null) {
    setError(null);
    setNotice(null);
    if (!file) return;
    const text = await file.text();
    const parsed = parsePriceFile(text, file.name);
    if (parsed.error) {
      setRows([]);
      setError(parsed.error);
      return;
    }
    setFileName(file.name);
    setRows(reviewPriceRows(parsed.rows, assemblies));
  }

  function update(index: number, patch: Partial<ReviewedPriceRow>) {
    setRows(current => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, ...patch };
      if (patch.assemblyId !== undefined) {
        const assembly = assemblies.find(item => item.id === patch.assemblyId) ?? null;
        next.assemblyName = assembly?.name ?? null;
        next.assemblyId = assembly?.id ?? null;
      }
      return next;
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const accepted = acceptedPrices(rows);
    const result = await storePriceList(accepted, fileName || "Supplier price file");
    setSaving(false);
    setSavedCount(accepted.length);
    setNotice(result.message);
  }

  const review = rows.filter(row => row.band === "review");
  const matched = rows.length - review.length;

  return (
    <Card style={{ maxWidth: 760, marginTop: 18 }}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
          Pricing
        </div>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
          Upload this workspace’s own TLE customer price file, or any invoice export with a code, description, unit, and cost. ElectraScan does not keep a supplier price book. Matched costs are used before the default assembly prices.
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>{savedCount > 0 ? `${savedCount} prices saved for this workspace.` : "No workspace price list yet."}</p>
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Price file (CSV, TXT, or XML)
          <input
            aria-label="Supplier price file"
            type="file"
            accept=".csv,.txt,.xml,text/csv,text/plain,text/xml,application/xml"
            onChange={event => void onFile(event.target.files?.[0] ?? null)}
            style={{ ...inputStyle, padding: "8px 12px" }}
          />
        </label>
        {error && <p role="alert" style={{ margin: 0, color: C.red }}>{error}</p>}
        {rows.length > 0 && (
          <>
            <p style={{ margin: 0, fontSize: 14 }}>
              {fileName}: {matched} matched, {review.length} to review. Skip a row to leave it out. Use for assembly replaces that assembly’s default material cost.
            </p>
            {rows.map((row, index) => (
              <PriceRow key={`${row.code}-${row.description}-${index}`} row={row} assemblies={assemblies} onChange={patch => update(index, patch)} />
            ))}
            <div>
              <PrimaryButton onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save price list"}</PrimaryButton>
            </div>
          </>
        )}
        {notice && <p role="status" style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{notice}</p>}
        {savedCount > 0 && rows.length === 0 && (
          <GhostButton onClick={() => { void storePriceList([], "").then(result => { setSavedCount(0); setNotice(result.message); }); }}>
            Clear saved prices
          </GhostButton>
        )}
      </div>
    </Card>
  );
}

function PriceRow({
  row,
  assemblies,
  onChange,
}: {
  row: ReviewedPriceRow;
  assemblies: Assembly[];
  onChange: (patch: Partial<ReviewedPriceRow>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8, padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ minWidth: 0 }}>
        <strong>{row.description || row.code}</strong>
        <div style={{ color: C.textMuted, fontSize: 13 }}>
          {row.code || "No code"} · {row.unit} · ${row.cost.toFixed(2)} · {row.band === "matched" ? `Matched ${row.assemblyName || "by code"}` : "Needs a look"}
        </div>
      </div>
      <label style={{ fontSize: 13, color: C.textMuted }}>
        Use this row
        <select aria-label={`Decision for ${row.description || row.code}`} value={row.decision} onChange={event => onChange({ decision: event.target.value as ReviewedPriceRow["decision"] })} style={inputStyle}>
          <option value="assembly">Use for assembly</option>
          <option value="code">Keep by code or description</option>
          <option value="skip">Skip</option>
        </select>
      </label>
      {row.decision === "assembly" && (
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Assembly
          <select aria-label={`Assembly for ${row.description || row.code}`} value={row.assemblyId || ""} onChange={event => onChange({ assemblyId: event.target.value || null })} style={inputStyle}>
            <option value="">Choose an assembly</option>
            {assemblies.map(assembly => <option key={assembly.id} value={assembly.id}>{assembly.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
