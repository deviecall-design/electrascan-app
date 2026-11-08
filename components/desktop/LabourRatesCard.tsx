import React, { useEffect, useState } from "react";
import { C, FONT } from "./tokens";
import { Card } from "../ui/anthropic";
import { GhostButton, PrimaryButton } from "../ui/anthropic/Button";
import {
  exGst,
  fetchLabourCard,
  incGst,
  parseLabourCsv,
  storeLabourCard,
  type LabourChargeType,
  type LabourRole,
} from "../../lib/labourRates";

function blankRole(isDefault: boolean): LabourRole {
  return {
    id: `role-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    rate: 0,
    chargeType: "hourly",
    overtimeMultiplier: null,
    isDefault,
  };
}

export default function LabourRatesCard() {
  const [roles, setRoles] = useState<LabourRole[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

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
          Add each role with a rate either inc GST or ex GST. The card stores the ex GST amount and shows both. One hourly role is the default. Quotes keep the electrician hourly rate until this card is saved.
        </p>
        {roles.length === 0 && <p style={{ margin: 0, fontSize: 14 }}>No labour roles yet.</p>}
        {roles.map(role => (
          <div key={role.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end" }}>
            <label style={label}>
              Role
              <input aria-label="Role name" value={role.name} onChange={event => update(role.id, { name: event.target.value })} style={field} />
            </label>
            <label style={label}>
              Charge
              <select aria-label={`Charge type for ${role.name || "role"}`} value={role.chargeType || "hourly"} onChange={event => update(role.id, { chargeType: event.target.value as LabourChargeType })} style={field}>
                <option value="hourly">Hourly</option>
                <option value="minimum">Minimum charge</option>
                <option value="callout">Call-out fee</option>
              </select>
            </label>
            <GstRateFields role={role} onRate={rate => update(role.id, { rate })} />
            {role.chargeType === "hourly" && (
              <label style={label}>
                Overtime multiplier
                <input aria-label={`Overtime multiplier for ${role.name || "role"}`} inputMode="decimal" placeholder="Optional" value={role.overtimeMultiplier ?? ""} onChange={event => update(role.id, { overtimeMultiplier: event.target.value === "" ? null : Number(event.target.value) || null })} style={field} />
              </label>
            )}
            <label style={{ ...label, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" name="default-labour-role" checked={role.isDefault} onChange={() => makeDefault(role.id)} aria-label={`Default role ${role.name || "role"}`} />
              Default
            </label>
            {confirmRemove === role.id ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span>Remove {role.name || "this role"}?</span>
                <button type="button" onClick={() => { setRoles(current => current.filter(item => item.id !== role.id)); setConfirmRemove(null); }} style={danger}>Confirm remove</button>
                <button type="button" onClick={() => setConfirmRemove(null)} style={quiet}>Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(role.id)} aria-label={`Remove ${role.name || "role"}`} style={quiet}>Remove</button>
            )}
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
        <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>Columns: role, rate, GST (inc or ex), charge (hourly, minimum, or callout), overtime multiplier, default. A rate marked inc GST is stored ex GST. A sample card lives in docs/samples and is not loaded on its own.</p>
        {error && <p role="alert" style={{ margin: 0, color: C.red }}>{error}</p>}
        {notice && <p role="status" style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>{notice}</p>}
      </div>
    </Card>
  );
}

function GstRateFields({ role, onRate }: { role: LabourRole; onRate: (ex: number) => void }) {
  const [focus, setFocus] = useState<null | "ex" | "inc">(null);
  const [draft, setDraft] = useState("");
  const ex = role.rate || 0;
  const inc = ex ? incGst(ex) : 0;
  const fixed = role.chargeType === "minimum" || role.chargeType === "callout";
  return (
    <>
      <label style={label}>
        {fixed ? "Amount ex GST" : "Rate ex GST"}
        <input
          aria-label={`Ex GST rate for ${role.name || "role"}`}
          inputMode="decimal"
          value={focus === "ex" ? draft : (ex || "")}
          onFocus={() => { setFocus("ex"); setDraft(ex ? String(ex) : ""); }}
          onChange={event => { setDraft(event.target.value); onRate(Number(event.target.value) || 0); }}
          onBlur={() => setFocus(null)}
          style={field}
        />
      </label>
      <label style={label}>
        {fixed ? "Amount inc GST" : "Rate inc GST"}
        <input
          aria-label={`Inc GST rate for ${role.name || "role"}`}
          inputMode="decimal"
          value={focus === "inc" ? draft : (inc || "")}
          onFocus={() => { setFocus("inc"); setDraft(inc ? String(inc) : ""); }}
          onChange={event => { setDraft(event.target.value); onRate(exGst(Number(event.target.value) || 0)); }}
          onBlur={() => setFocus(null)}
          style={field}
        />
      </label>
    </>
  );
}

const quiet: React.CSSProperties = { minHeight: 44, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgCard, fontWeight: 700 };
const danger: React.CSSProperties = { ...quiet, background: C.red, color: "#fff", borderColor: C.red };
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
