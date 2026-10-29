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
  fetchMyMembership,
  fetchTenantInvites,
  createTenantInvite,
  deleteTenantInvite,
  type CompanyProfileInput,
  type TenantInvite,
} from "../services/supabaseData";
import { getActiveCompanyProfile } from "../services/companyProfile";
import { getCurrentTenantId, VESH_TENANT_ID } from "../lib/tenants";
import { authIsDisabled } from "../lib/authMode";
import { fetchWorkspaceSettings, saveWorkspaceSettings } from "../services/workspaceSettings";
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
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // Prefill Vesh's details only for the Vesh workspace. Any other
          // signed-in user gets a blank form so their workspace is not
          // branded as Vesh Electrical.
          const tenantId = await getCurrentTenantId();
          if (!cancelled && tenantId === VESH_TENANT_ID) {
            const seed = getActiveCompanyProfile();
            setForm({
              company_name: seed.name,
              abn: seed.abn ?? null,
              logo_url: seed.logoUrl ?? null,
              address: seed.address ?? null,
              phone: seed.phone ?? null,
              email: seed.email ?? null,
            });
          }
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

            <div className="es-pair">
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
                      backgroundColor: C.bg,
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

      <TakeoffSettings />

      {!authIsDisabled() && <WorkspaceInvites />}

      <Footer />
    </div>
  );
}

function TakeoffSettings() {
  const { addToast } = useToast();
  const [minVerified, setMinVerified] = useState("");
  const [supplierName, setSupplierName] = useState("Lawrence & Hanson");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceSettings().then(settings => {
      if (cancelled) return;
      setMinVerified(settings.minVerifiedPct == null ? "" : String(settings.minVerifiedPct));
      setSupplierName(settings.supplierName);
      setSupplierEmail(settings.supplierEmail);
    });
    return () => { cancelled = true; };
  }, []);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await saveWorkspaceSettings({
      minVerifiedPct: minVerified.trim() === "" ? null : Math.max(0, Math.min(100, Number(minVerified))),
      supplierName,
      supplierEmail,
    });
    setSaving(false);
    if (!result.ok) {
      addToast(result.error || "Could not save workspace settings.", "error");
      return;
    }
    addToast("Workspace settings saved.", "success");
  }

  return (
    <Card style={{ maxWidth: 760, marginTop: 18 }}>
      <form onSubmit={onSave} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
          Takeoff and supplier
        </div>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
          Leave the verified minimum blank to allow a quote at any takeoff check. The supplier email is only used to open a draft. Nothing is sent automatically.
        </p>
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Minimum verified % before a quote can be sent
          <input
            aria-label="Minimum verified percent"
            inputMode="numeric"
            placeholder="Off"
            value={minVerified}
            onChange={event => setMinVerified(event.target.value)}
            style={{ display: "block", width: 160, minHeight: 44, marginTop: 6, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, padding: "0 12px" }}
          />
        </label>
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Supplier
          <input aria-label="Supplier name" value={supplierName} onChange={event => setSupplierName(event.target.value)} style={{ display: "block", width: "100%", minHeight: 44, marginTop: 6, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, padding: "0 12px" }} />
        </label>
        <label style={{ fontSize: 13, color: C.textMuted }}>
          Supplier email
          <input aria-label="Supplier email" type="email" value={supplierEmail} onChange={event => setSupplierEmail(event.target.value)} placeholder="orders@example.com.au" style={{ display: "block", width: "100%", minHeight: 44, marginTop: 6, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, padding: "0 12px" }} />
        </label>
        <div>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save takeoff settings"}</PrimaryButton>
        </div>
      </form>
    </Card>
  );
}

function WorkspaceInvites() {
  const { addToast } = useToast();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [invites, setInvites] = useState<TenantInvite[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "owner">("member");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const membership = await fetchMyMembership();
    const row = membership.data as { tenant_id?: string; role?: string } | null;
    setTenantId(row?.tenant_id ?? null);
    setRole(row?.role ?? null);
    if (row?.role === "owner") {
      const list = await fetchTenantInvites();
      setInvites((list.data as TenantInvite[] | null) ?? []);
    } else {
      setInvites([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await createTenantInvite(email, inviteRole);
    setBusy(false);
    if (error) {
      addToast(error.message ?? "Could not add that email.", "error");
      return;
    }
    setEmail("");
    addToast("Invite saved. They join this workspace the next time they sign in.", "success");
    await load();
  };

  const onRemove = async (id: string) => {
    const { error } = await deleteTenantInvite(id);
    if (error) {
      addToast(error.message ?? "Could not remove that invite.", "error");
      return;
    }
    await load();
  };

  const isVesh = tenantId === VESH_TENANT_ID;

  return (
    <Card style={{ maxWidth: 760, marginTop: 18 }}>
      <div style={{ padding: 24 }}>
        <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted }}>
          Workspace access
        </div>
        <p style={{ margin: "8px 0 0", color: C.textMuted, fontSize: 14, lineHeight: 1.5 }}>
          {isVesh
            ? "This workspace is Vesh Electrical. Only emails on this list can join it. The role is the one you set here."
            : "Emails on this list join this workspace the next time they sign in. Anyone else gets their own workspace and cannot see these jobs."}
        </p>
        {role !== "owner" && (
          <p style={{ margin: "12px 0 0", color: C.text, fontSize: 14 }}>
            {role === "member"
              ? "You are a member. An owner sends invites."
              : "Sign in as a workspace owner to manage invites."}
          </p>
        )}
        {role === "owner" && (
          <>
            <form onSubmit={onInvite} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <input
                type="email"
                required
                value={email}
                placeholder="name@company.com.au"
                aria-label="Invite email"
                onChange={e => setEmail(e.target.value)}
                style={{ flex: "1 1 220px", minHeight: 44, padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: FONT.body }}
              />
              <select
                aria-label="Invite role"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value === "owner" ? "owner" : "member")}
                style={{ minHeight: 44, padding: "0 12px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.bgCard, color: C.text }}
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? "Saving…" : "Add email"}
              </PrimaryButton>
            </form>
            <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
              {invites.map(invite => (
                <li key={invite.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, borderTop: `1px solid ${C.border}` }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 13 }}>{invite.email}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.textMuted, fontSize: 13 }}>{invite.role}</span>
                    <GhostButton onClick={() => void onRemove(invite.id)}>Remove</GhostButton>
                  </span>
                </li>
              ))}
              {invites.length === 0 && (
                <li style={{ color: C.textMuted, fontSize: 14, marginTop: 8 }}>No invites yet.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </Card>
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
