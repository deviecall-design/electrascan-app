import React, { useEffect, useState } from "react";
import { C, FONT } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import {
  fetchLabourCard,
  parseLabourCsv,
  storeLabourCard,
  type LabourRole,
} from "../../lib/labourRates";

function blankRole(isDefault: boolean): LabourRole {
  return { id: `role-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", rate: 0, overtimeMultiplier: null, isDefault };
}

export default function LabourRatesCard() {
  const [roles, setRoles] = useState<LabourRole[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLabourCard().then(result => {
      if (cancelled) return;
      setRoles(result.roles);
      if (result.migration) setNotice("The rate card is kept in this browser until the labour-rates migration is applied.");
    });
    return () => { cancelled = true; };
  }, []);

  function update(id: string, patch: Partial<LabourRole>) {
    setRoles(current => current.map(role => (role.id === id ? { ...role, ...patch } : role)));
  }

  function makeDefault(id: string) {
    setRoles(current => current.map(role => ({ ...role, isDefault: role.id === id })));
  }

  async function onFile(file: File | null) {
    setError(null);
    if (!file) return;
    const parsed = parseLabourCsv(await file.text());
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setRoles(parsed.roles);
    setNotice("Review the imported roles, then save the card.");
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await storeLabourCard(roles.filter(role => role.name.trim()));
    setSaving(false);
    setNotice(result.message);
  }

  return (
    <Card style={{ maxWidth: 760, marginTop: 18 }}>
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
          Labour rates
        </div>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
          Add each role and its hourly rate ex GST. One role is the default. Quotes keep the electrician hourly rate until this card is saved.
        </p>
        {roles.length === 0 && <p style={{ margin: 0, fontSize: 14 }}>No labour roles yet.</p>}
        {roles.map(role => (
          <div key={role.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end" }}>
            <label style={label}>
              Role
              <input aria-label="Role name" value={role.name} onChange={event => update(role.id, { name: event.target.value })} style={field} />
            </label>
            <label style={label}>
              Hourly rate ex GST
              <input aria-label={`Hourly rate for ${role.name || "role"}`} inputMode="decimal" value={role.rate || ""} onChange={event => update(role.id, { rate: Number(event.target.value) || 0 })} style={field} />
            </label>
            <label style={label}>
              Overtime multiplier
              <input aria-label={`Overtime multiplier for ${role.name || "role"}`} inputMode="decimal" placeholder="Optional" value={role.overtimeMultiplier ?? ""} onChange={event => update(role.id, { overtimeMultiplier: event.target.value === "" ? null : Number(event.target.value) || null })} style={field} />
            </label>
            <label style={{ ...label, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="default-labour-role" checked={role.isDefault} onChange={() => makeDefault(role.id)} aria-label={`Default role ${role.name || "role"}`} />
              Default
            </label>
          </div>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <GhostButton type="button" onClick={() => setRoles(current => [...current, blankRole(current.length === 0)])}>Add role</GhostButton>
          <PrimaryButton type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save labour rates"}</PrimaryButton>
        </div>
        <label style={label}>
          Import a rate card (CSV)
          <input
            aria-label="Labour rate card"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={event => void onFile(event.target.files?.[0] ?? null)}
            style={{ ...field, padding: "8px 12px" }}
          />
        </label>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>Columns: role, hourly rate, overtime multiplier, default. The file is this workspace’s own card.</p>
        {error && <p role="alert" style={{ margin: 0, color: C.red }}>{error}</p>}
        {notice && <p role="status" style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{notice}</p>}
      </div>
    </Card>
  );
}

const label: React.CSSProperties = { fontSize: 13, color: C.textMuted };
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
