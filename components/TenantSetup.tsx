import { useEffect, useRef, useState } from "react";
import { useTenant, type TenantConfig } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import {
  fetchTenantProfile,
  saveTenantProfile,
  uploadLogo,
  type TenantProfile,
} from "../services/tenantProfileService";
import type { Wholesaler } from "../types/tenant";

const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#10B981",
  amber:  "#F59E0B", red:    "#EF4444", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
};

interface TenantSetupProps {
  onBack: () => void;
}

type StringField = "name" | "abn" | "address" | "contactPhone" | "contactEmail" | "emailReplyTo";

const FIELDS: { key: StringField; label: string; placeholder: string; type?: string; hint?: string }[] = [
  { key: "name",         label: "Trading name",     placeholder: "Vesh Electrical Services" },
  { key: "abn",          label: "ABN",              placeholder: "XX XXX XXX XXX" },
  { key: "address",      label: "Business address", placeholder: "Unit 1 / 12 Main St, Sydney NSW 2000" },
  { key: "contactPhone", label: "Contact phone",    placeholder: "02 1234 5678" },
  { key: "contactEmail", label: "Contact email",    placeholder: "hello@vesh.com.au",    type: "email" },
  { key: "emailReplyTo", label: "Email reply-to",   placeholder: "admin@vesh.com.au",    type: "email",
    hint: "Where builder replies to estimate emails land. Defaults to contact email if left blank." },
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
  const { addToast } = useToast();
  const [draft, setDraft] = useState<TenantConfig>(tenant);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate from Supabase on mount; falls through cleanly when the
  // user is unauthenticated (anon access) and we keep the local
  // TenantContext value already in `draft`.
  useEffect(() => {
    let cancelled = false;
    fetchTenantProfile().then(res => {
      if (cancelled) return;
      if (res.ok && res.profile) {
        const merged: TenantConfig = { ...tenant, ...res.profile };
        setDraft(merged);
        updateTenant(merged);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = <K extends keyof TenantConfig>(key: K, value: TenantConfig[K]) => {
    setDraft(d => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|jpg|svg\+xml)$/.test(f.type)) {
      addToast("Logo must be PNG, JPEG, or SVG.", "error");
      return;
    }
    setUploading(true);
    // Try Supabase Storage first; fall back to a local data URL when
    // the user isn't authenticated so the form still previews properly.
    const upload = await uploadLogo(f);
    if (upload.ok === true) {
      setField("logoUrl", upload.url);
      addToast("Logo uploaded.", "success");
    } else if (upload.error === "unauthenticated") {
      const dataUrl = await fileToDataUrl(f);
      setField("logoUrl", dataUrl);
      addToast("Saved locally — sign in to publish to all tenants.", "info");
    } else {
      addToast(`Logo upload failed: ${upload.error}`, "error");
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const profile: TenantProfile = {
      name: draft.name,
      abn: draft.abn,
      address: draft.address,
      contactEmail: draft.contactEmail,
      contactPhone: draft.contactPhone,
      emailReplyTo: draft.emailReplyTo,
      logoUrl: draft.logoUrl,
      wholesalers: draft.wholesalers,
    };
    const res = await saveTenantProfile(profile);
    // Always update the local context so the in-app branding reflects
    // the latest values, even if Supabase persistence failed.
    updateTenant(draft);
    if (res.ok === true) {
      setSaved(true);
      addToast("Company profile saved.", "success");
    } else if (res.error === "unauthenticated") {
      addToast("Saved locally — sign in to sync to Supabase.", "info");
    } else {
      addToast(`Save failed: ${res.error}`, "error");
    }
    setSaving(false);
  };

  const previewContact = [draft.address, draft.contactPhone, draft.contactEmail].filter(Boolean).join(" · ");

  const wholesalers = draft.wholesalers ?? [];

  const updateWholesaler = (id: string, patch: Partial<Wholesaler>) => {
    setDraft(d => ({
      ...d,
      wholesalers: (d.wholesalers ?? []).map(w => (w.id === id ? { ...w, ...patch } : w)),
    }));
    setSaved(false);
  };

  const setDefaultWholesaler = (id: string) => {
    setDraft(d => ({
      ...d,
      wholesalers: (d.wholesalers ?? []).map(w => ({ ...w, isDefault: w.id === id })),
    }));
    setSaved(false);
  };

  const removeWholesaler = (id: string) => {
    setDraft(d => {
      const next = (d.wholesalers ?? []).filter(w => w.id !== id);
      if (next.length > 0 && !next.some(w => w.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return { ...d, wholesalers: next };
    });
    setSaved(false);
  };

  const addWholesaler = () => {
    const id = `wholesaler-${Date.now()}`;
    setDraft(d => {
      const existing = d.wholesalers ?? [];
      return {
        ...d,
        wholesalers: [
          ...existing,
          {
            id,
            name: "New wholesaler",
            address: "",
            email: "",
            isDefault: existing.length === 0,
          },
        ],
      };
    });
    setSaved(false);
  };

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
              <button
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                style={{
                  background: C.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                  padding: "10px 16px", borderRadius: 10, cursor: uploading ? "wait" : "pointer",
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? "Uploading…" : draft.logoUrl ? "Replace logo" : "Upload logo"}
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
                {f.hint && <span style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{f.hint}</span>}
              </label>
            ))}
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Wholesalers</div>
            <button
              onClick={addWholesaler}
              style={{
                background: `${C.blue}22`, color: C.blue, border: `1px solid ${C.blue}`,
                padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              ＋ Add
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>
            Used for "Send BOM to Wholesaler" quote requests on the estimate screen.
            The default wholesaler is pre-selected when sending.
          </div>
          {wholesalers.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, padding: 10 }}>
              No wholesalers configured.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {wholesalers.map(w => (
                <div
                  key={w.id}
                  style={{
                    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12,
                    display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={w.name}
                      placeholder="Wholesaler name"
                      onChange={e => updateWholesaler(w.id, { name: e.target.value })}
                      style={{
                        flex: 1, background: C.navy, border: `1px solid ${C.border}`, borderRadius: 8,
                        padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit",
                      }}
                    />
                    <button
                      onClick={() => setDefaultWholesaler(w.id)}
                      style={{
                        background: w.isDefault ? `${C.green}22` : "transparent",
                        color: w.isDefault ? C.green : C.muted,
                        border: `1px solid ${w.isDefault ? C.green : C.border}`,
                        padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                      title="Set as default for new quote requests"
                    >
                      {w.isDefault ? "★ Default" : "Set default"}
                    </button>
                    <button
                      onClick={() => removeWholesaler(w.id)}
                      style={{
                        background: "transparent", color: C.red, border: `1px solid ${C.border}`,
                        padding: "8px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    value={w.address}
                    placeholder="Address"
                    onChange={e => updateWholesaler(w.id, { address: e.target.value })}
                    style={{
                      background: C.navy, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <input
                    type="email"
                    value={w.email}
                    placeholder="Email — orders@wholesaler.com.au"
                    onChange={e => updateWholesaler(w.id, { email: e.target.value })}
                    style={{
                      background: C.navy, border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit",
                    }}
                  />
                  {!w.email && (
                    <div style={{ fontSize: 11, color: C.amber }}>
                      No email set — quote requests can't be sent until you add one.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
                  {draft.name || "Your Trading Name"}
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
          <button
            onClick={save}
            disabled={saving || loading}
            style={{
              flex: 2, background: saved ? C.green : C.blue, border: "none", color: "#fff",
              fontSize: 13, fontWeight: 700, padding: "12px", borderRadius: 12,
              cursor: saving ? "wait" : "pointer",
              opacity: (saving || loading) ? 0.7 : 1,
              transition: "background .15s",
            }}
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
