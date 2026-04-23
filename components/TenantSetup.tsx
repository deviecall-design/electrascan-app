import { useRef, useState } from "react";
import { useTenant, type TenantConfig } from "../contexts/TenantContext";

const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#10B981",
  amber:  "#F59E0B", red:    "#EF4444", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
};

interface TenantSetupProps {
  onBack: () => void;
}

type Field = keyof TenantConfig;

const FIELDS: { key: Field; label: string; placeholder: string; type?: string }[] = [
  { key: "tradingName",  label: "Trading name",     placeholder: "Vesh Electrical Services" },
  { key: "abn",          label: "ABN",              placeholder: "XX XXX XXX XXX" },
  { key: "address",      label: "Business address", placeholder: "Unit 1 / 12 Main St, Sydney NSW 2000" },
  { key: "contactPhone", label: "Contact phone",    placeholder: "02 1234 5678" },
  { key: "contactEmail", label: "Contact email",    placeholder: "hello@vesh.com.au",    type: "email" },
  { key: "replyToEmail", label: "Reply-to email",   placeholder: "quotes@vesh.com.au",   type: "email" },
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function TenantSetup({ onBack }: TenantSetupProps) {
  const { tenant, updateTenant, resetTenant } = useTenant();
  const [draft, setDraft] = useState<TenantConfig>(tenant);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setField = (key: Field, value: string) => {
    setDraft(d => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|jpg|svg\+xml)$/.test(f.type)) return;
    const dataUrl = await fileToDataUrl(f);
    setField("logoUrl", dataUrl);
  };

  const save = () => {
    updateTenant(draft);
    setSaved(true);
  };

  const previewContact = [draft.address, draft.contactPhone, draft.contactEmail].filter(Boolean).join(" · ");

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
            ← Back
          </button>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Settings</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Company Branding</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          These details appear on every estimate, variation report, BOM and builder email. ElectraScan branding never leaves this app.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 80px" }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Logo</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 88, height: 88, borderRadius: 12, background: "#fff",
              border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
              justifyContent: "center", overflow: "hidden", flexShrink: 0,
            }}>
              {draft.logoUrl
                ? <img src={draft.logoUrl} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                : <div style={{ color: C.muted, fontSize: 11 }}>No logo</div>}
            </div>
            <div style={{ flex: 1 }}>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: "none" }} onChange={onPickLogo} />
              <button onClick={() => fileRef.current?.click()} style={{
                background: C.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                padding: "10px 16px", borderRadius: 10, cursor: "pointer",
              }}>
                {draft.logoUrl ? "Replace logo" : "Upload logo"}
              </button>
              {draft.logoUrl && (
                <button onClick={() => setField("logoUrl", "")} style={{
                  marginLeft: 8, background: "none", border: `1px solid ${C.border}`,
                  color: C.muted, fontSize: 12, padding: "9px 14px", borderRadius: 10, cursor: "pointer",
                }}>
                  Remove
                </button>
              )}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>PNG or JPEG. Appears on every PDF header.</div>
            </div>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Company details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FIELDS.map(f => (
              <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: C.muted }}>{f.label}</span>
                <input
                  type={f.type ?? "text"}
                  value={draft[f.key]}
                  placeholder={f.placeholder}
                  onChange={e => setField(f.key, e.target.value)}
                  style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: "10px 12px", color: C.text, fontSize: 13, outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>PDF header preview</div>
          <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", color: "#1e293b" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {draft.logoUrl && (
                <img src={draft.logoUrl} alt="" style={{ width: 64, height: 48, objectFit: "contain", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                  {draft.tradingName || "Your Trading Name"}
                </div>
                {draft.abn && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>ABN: {draft.abn}</div>}
                {previewContact && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{previewContact}</div>}
              </div>
            </div>
            <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 12, paddingTop: 10, fontSize: 10, color: "#94a3b8" }}>
              No ElectraScan branding appears on exported documents.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={resetTenant} style={{
            flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted,
            fontSize: 13, padding: "12px", borderRadius: 12, cursor: "pointer",
          }}>
            Reset to defaults
          </button>
          <button onClick={save} style={{
            flex: 2, background: saved ? C.green : C.blue, border: "none", color: "#fff",
            fontSize: 13, fontWeight: 700, padding: "12px", borderRadius: 12, cursor: "pointer",
            transition: "background .15s",
          }}>
            {saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
