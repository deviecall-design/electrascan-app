import React, { useEffect, useState } from "react";
import { Save, Building2 } from "lucide-react";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  Footer,
} from "../components/ui/anthropic";
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";
import {
  fetchCompanyProfile,
  upsertCompanyProfile,
  type CompanyProfileInput,
} from "../services/supabaseData";
import { getActiveCompanyProfile } from "../services/companyProfile";
import { useToast } from "../contexts/ToastContext";

const EMPTY_FORM: CompanyProfileInput = {
  company_name: "",
  abn: null,
  logo_url: null,
  address: null,
  phone: null,
  email: null,
};

interface FieldDef {
  key: keyof CompanyProfileInput;
  label: string;
  placeholder: string;
  type?: "text" | "email" | "url" | "tel";
  required?: boolean;
  hint?: string;
  fullWidth?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "company_name", label: "Company name", placeholder: "Vesh Electrical Services Pty Ltd", required: true, fullWidth: true },
  { key: "abn",          label: "ABN",          placeholder: "51 234 567 891" },
  { key: "phone",        label: "Phone",        placeholder: "02 9938 4200", type: "tel" },
  { key: "email",        label: "Email",        placeholder: "quotes@example.com.au", type: "email" },
  { key: "logo_url",     label: "Logo URL",     placeholder: "https://…/logo.png", type: "url", hint: "Link to a hosted PNG/SVG. Used on every branded PDF." },
  { key: "address",      label: "Address",      placeholder: "7/108 Old Pittwater Road, Brookvale NSW 2100", fullWidth: true },
];

export default function SettingsScreen() {
  const { addToast } = useToast();
  const [form, setForm] = useState<CompanyProfileInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCompanyProfile()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // No profile yet (new tenant) or table missing — seed from the
          // local Vesh fallback so the form is never blank on first load.
          const seed = getActiveCompanyProfile();
          setForm({
            company_name: seed.name,
            abn: seed.abn ?? null,
            logo_url: seed.logoUrl ?? null,
            address: seed.address ?? null,
            phone: seed.phone ?? null,
            email: seed.email ?? null,
          });
          setIsLive(false);
        } else {
          setForm({
            company_name: data.company_name,
            abn: data.abn,
            logo_url: data.logo_url,
            address: data.address,
            phone: data.phone,
            email: data.email,
          });
          setIsLive(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        const seed = getActiveCompanyProfile();
        setForm({
          company_name: seed.name,
          abn: seed.abn ?? null,
          logo_url: seed.logoUrl ?? null,
          address: seed.address ?? null,
          phone: seed.phone ?? null,
          email: seed.email ?? null,
        });
        setIsLive(false);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const update = (key: keyof CompanyProfileInput, value: string) => {
    setForm(prev => ({ ...prev, [key]: value === "" ? null : value }));
    setDirty(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name || form.company_name.trim() === "") {
      addToast("Company name is required.", "error");
      return;
    }
    setSaving(true);
    const { data, error } = await upsertCompanyProfile(form);
    setSaving(false);
    if (error) {
      addToast(`Could not save: ${error.message ?? "unknown error"}`, "error");
      return;
    }
    if (data) {
      setIsLive(true);
      setDirty(false);
      addToast("Company profile saved.", "success");
    }
  };

  return (
    <div className="anim-in">
      <PageHeader
        title="Settings"
        sub="Your company profile sits behind every branded estimate, variation and email."
      />

      {!isLive && !loading && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, backgroundColor: C.amberSoft, color: C.amber, fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, marginBottom: 16 }}>
          Local draft — sign in + run migration 005 to persist
        </div>
      )}

      <form onSubmit={onSubmit} style={{ maxWidth: 760 }}>
        <Card>
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Building2 size={16} color={C.textMuted} />
              <span
                style={{
                  fontFamily: FONT.heading,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.textMuted,
                }}
              >
                Company profile
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {FIELDS.map(field => (
                <div
                  key={field.key}
                  style={{ gridColumn: field.fullWidth ? "1 / -1" : undefined }}
                >
                  <Label text={field.label} required={field.required} />
                  <input
                    type={field.type ?? "text"}
                    value={(form[field.key] as string | null) ?? ""}
                    placeholder={field.placeholder}
                    onChange={e => update(field.key, e.target.value)}
                    disabled={loading}
                    required={field.required}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontFamily: FONT.body,
                      fontSize: 14,
                      color: C.text,
                      backgroundColor: C.bgCard,
                      border: `1px solid ${C.border}`,
                      borderRadius: RADIUS.md,
                      outline: "none",
                    }}
                  />
                  {field.hint && (
                    <div style={{ fontSize: 12, color: C.textSubtle, fontStyle: "italic", marginTop: 6 }}>
                      {field.hint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <GhostButton onClick={() => window.history.back()}>Cancel</GhostButton>
          <PrimaryButton
            type="submit"
            icon={<Save size={15} strokeWidth={2.5} />}
            disabled={saving || loading || !dirty}
          >
            {saving ? "Saving…" : "Save changes"}
          </PrimaryButton>
        </div>
      </form>

      <Footer />
    </div>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label
      style={{
        display: "block",
        fontFamily: FONT.heading,
        fontSize: 12,
        fontWeight: 500,
        color: C.textMuted,
        marginBottom: 6,
        letterSpacing: "0.02em",
      }}
    >
      {text}
      {required && <span style={{ color: C.orange, marginLeft: 4 }}>*</span>}
    </label>
  );
}
