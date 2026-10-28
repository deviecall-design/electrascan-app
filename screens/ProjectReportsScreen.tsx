import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Target, Clock, CheckCircle2 } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { GhostButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans, fetchMilestoneClaimsForProject, submitMilestoneClaim, type MilestoneClaimRow } from "../services/supabaseData";
import { linesFromDetected, linesOf, materialsExGst, takeoffIncGst } from "../lib/variationDiff";
import { DEFAULT_MARGIN_PCT } from "../lib/quoteTotals";
import { milestoneAfterSave } from "../lib/progressClaim";
import { formatQuotedValue } from "../lib/estimateMoney";
import QueryBanner from "../components/QueryBanner";
import AccountingConnect from "../components/desktop/AccountingConnect";

type ClaimStatus = "pending" | "invoiced_draft" | "received";

interface Milestone {
  id: string;
  label: string;
  description: string;
  amount: number;
  pct: number;
  status: ClaimStatus;
  invRef: string | null;
}

function scheduleFor(contract: number): Milestone[] {
  const rows: Array<[string, string, string, number]> = [
    ["deposit", "Deposit on signing", "On acceptance", 0.1],
    ["rough-in", "Rough-in complete", "Cabling complete", 0.2],
    ["first-fix", "First fix complete", "First fix signed off", 0.25],
    ["second-fix", "Second fix complete", "Second fix signed off", 0.25],
    ["pc", "Practical completion", "Test and compliance", 0.15],
    ["retention", "Retention holdback", "Released after the defect period", 0.05],
  ];
  return rows.map(([id, label, description, share]) => ({
    id,
    label,
    description,
    pct: Math.round(share * 100),
    amount: Math.round(contract * share),
    status: "pending",
    invRef: null,
  }));
}

function applyClaims(base: Milestone[], claims: Array<{ milestone_id?: string; status?: string; inv_ref?: string | null }>): Milestone[] {
  return base.map(milestone => {
    const claim = claims.find(row => row.milestone_id === milestone.id);
    if (!claim) return milestone;
    const status: ClaimStatus = claim.status === "received"
      ? "received"
      : "invoiced_draft";
    return { ...milestone, status, invRef: claim.inv_ref ?? null };
  });
}

interface ProjectRow {
  id: string;
  client: string | null;
  project_name: string | null;
  value: number;
  subtotal: number;
  margin_pct: number | null;
  status: string;
  reference: string | null;
  ref: string | null;
  items: number;
  lines: { description: string; qty: number; unitPrice: number }[];
}

function projectsFrom(estimates: any[], scans: any[]): ProjectRow[] {
  const fromEstimates: ProjectRow[] = estimates.map(row => ({
    id: row.id,
    client: row.client ?? null,
    project_name: row.project_name ?? null,
    value: Number(row.value) || 0,
    subtotal: Number(row.subtotal) || 0,
    margin_pct: typeof row.margin_pct === "number" ? row.margin_pct : null,
    status: row.status || "draft",
    reference: row.reference ?? null,
    ref: row.ref ?? null,
    items: linesOf(row).length,
    lines: linesOf(row),
  }));
  const quotedRefs = new Set(fromEstimates.map(row => row.reference || row.ref).filter(Boolean));
  const fromScans: ProjectRow[] = scans
    .filter(scan => !scan.estimate_ref || !quotedRefs.has(scan.estimate_ref))
    .map(scan => {
      const lines = linesFromDetected(scan.detected_items);
      const subtotal = materialsExGst(lines);
      return {
        id: `scan-${scan.id}`,
        client: scan.client ?? null,
        project_name: scan.file_name || scan.client || "Untitled scan",
        value: takeoffIncGst(lines),
        subtotal,
        margin_pct: DEFAULT_MARGIN_PCT,
        status: scan.estimate_ref ? "draft" : "review",
        reference: scan.estimate_ref ?? null,
        ref: scan.estimate_ref ?? null,
        items: lines.length,
        lines,
      };
    });
  return [...fromEstimates, ...fromScans];
}

export default function ProjectReportsScreen() {
  const navigate = useNavigate();
  const { data: estimates, loading, error } = useSupabaseQuery(fetchEstimates);
  const { data: scans, loading: scansLoading, error: scansError } = useSupabaseQuery(fetchScans);
  const projects = useMemo(() => projectsFrom(estimates, scans), [estimates, scans]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = projects.find(row => row.id === selectedId) ?? projects[0] ?? null;
  const projectKey = selected ? (selected.reference || selected.ref || selected.project_name || selected.id) : "";
  const [claims, setClaims] = useState<MilestoneClaimRow[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  useEffect(() => {
    if (!projectKey) {
      setClaims([]);
      return;
    }
    let cancelled = false;
    setClaimsLoading(true);
    fetchMilestoneClaimsForProject(projectKey).then(({ data }) => {
      if (cancelled) return;
      setClaims((data as MilestoneClaimRow[] | null) ?? []);
      setClaimsLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectKey]);

  const contract = Number(selected?.value) || 0;
  const [localClaims, setLocalClaims] = useState<Record<string, Milestone[]>>({});
  const milestones = useMemo(() => {
    const saved = localClaims[projectKey];
    if (saved) return saved;
    return applyClaims(scheduleFor(contract), claims as Array<{ milestone_id?: string; status?: string; inv_ref?: string | null }>);
  }, [claims, contract, localClaims, projectKey]);

  const [submitting, setSubmitting] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const claimedTotal = milestones
    .filter(milestone => milestone.status !== "pending")
    .reduce((sum, milestone) => sum + milestone.amount, 0);

  async function submit(milestone: Milestone) {
    if (!projectKey) return;
    setSubmitting(milestone.id);
    setClaimError(null);
    const result = await submitMilestoneClaim(projectKey, milestone.id, milestone.label, milestone.amount);
    const next = milestoneAfterSave(milestone, result, {
      status: "invoiced_draft",
      invRef: result.invRef,
    });
    if (next === milestone) {
      setClaimError(result.error?.message || "The claim was not saved, so it stays ready to submit.");
      setSubmitting(null);
      return;
    }
    setLocalClaims(prev => ({
      ...prev,
      [projectKey]: milestones.map(row => row.id === milestone.id ? next : row),
    }));
    setSubmitting(null);
  }

  const pageLoading = loading || scansLoading;
  const pageError = error || scansError;

  if (!pageLoading && projects.length === 0) {
    return (
      <div className="anim-in">
        <PageHeader
          crumb="Project reports"
          title="Project reports"
          sub="Cost and claim figures come from saved estimates. There are none yet."
        />
        <QueryBanner loading={pageLoading} error={pageError} noun="projects" />
        <EmptyState
          title="No projects yet"
          body="Save a quote from a scan and it will show here as a project, with a claim schedule based on that contract value."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
        <Footer />
      </div>
    );
  }

  const margin = selected?.margin_pct;
  const marginLabel = typeof margin === "number" ? `${margin}%` : "—";

  return (
    <div className="anim-in">
      <QueryBanner loading={pageLoading || claimsLoading} error={pageError} noun="projects" />
      <PageHeader
        crumb="Project reports"
        title={selected?.project_name || selected?.client || "Project"}
        sub={[
          selected?.client,
          projectKey,
          selected?.status === "review"
            ? "Figures are from this saved takeoff. The quote has not been sent."
            : "Figures are from this saved quote.",
        ].filter(Boolean).join(" · ")}
      />

      {projects.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {projects.map(row => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedId(row.id)}
              style={{
                minHeight: 40,
                borderRadius: 999,
                padding: "0 14px",
                fontWeight: 600,
                background: (selected?.id === row.id) ? C.ink : C.bgCard,
                color: (selected?.id === row.id) ? "#fff" : C.text,
                border: `1px solid ${C.border}`,
              }}
            >
              {row.reference || row.ref || row.project_name || "Project"}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Mini label="Contract value" value={pageLoading ? "—" : formatQuotedValue(contract)} hint={selected?.status === "review" ? "Takeoff inc GST, quote not sent" : "Quoted total inc GST"} icon={<DollarSign size={16} />} />
        <Mini label="Materials" value={pageLoading ? "—" : formatQuotedValue(Number(selected?.subtotal) || 0)} hint={`${selected?.items ?? 0} priced lines, ex GST`} icon={<DollarSign size={16} />} />
        <Mini label="Claimed" value={formatQuotedValue(claimedTotal)} hint="Saved claims only" icon={<CheckCircle2 size={16} />} />
        <Mini label="Quoted margin" value={marginLabel} hint="From the estimate" icon={<Target size={16} />} />
        <Mini label="Status" value={selected?.status === "approved" ? "Won" : (selected?.status || "—")} hint="Estimate status" icon={<Clock size={16} />} />
      </div>

      {claimError && (
        <p style={{ color: C.red, fontSize: 14 }}>{claimError}</p>
      )}

      <Card style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Progress payments</h2>
        <p style={{ margin: "0 0 16px", color: C.textMuted, fontSize: 14 }}>
          Deposit through retention, split from this contract. A claim moves to invoiced draft only after it is stored. A failed save leaves it pending.
        </p>
        {milestones.map(milestone => (
          <div key={milestone.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{milestone.label}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>{milestone.description} · {milestone.pct}%</div>
            </div>
            <div style={{ fontFamily: FONT.mono, fontWeight: 600 }}>{formatQuotedValue(milestone.amount)}</div>
            <div style={{ width: 120, fontSize: 13, color: C.textMuted }}>
              {milestone.status === "pending" ? "Pending" : milestone.status === "received" ? "Received" : `Draft ${milestone.invRef || ""}`}
            </div>
            {milestone.status === "pending" && (
              <GhostButton disabled={submitting === milestone.id} onClick={() => submit(milestone)}>
                {submitting === milestone.id ? "Saving…" : "Submit claim"}
              </GhostButton>
            )}
          </div>
        ))}
      </Card>

      <Resources projectKey={projectKey} />

      <Card style={{ padding: 22, marginTop: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Project breakdown</h2>
        <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
          Priced lines from this takeoff. Rejected detections are not included.
        </p>
        {(selected?.lines ?? []).length === 0 ? (
          <p style={{ color: C.textMuted }}>No priced lines on this project yet.</p>
        ) : (selected?.lines ?? []).map(line => (
          <div key={line.description} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <span>
              <span style={{ fontWeight: 600 }}>{line.description}</span>
              <span style={{ display: "block", color: C.textMuted, fontSize: 13 }}>{line.qty} × {formatQuotedValue(line.unitPrice)}</span>
            </span>
            <span style={{ fontFamily: FONT.mono, fontWeight: 600 }}>{formatQuotedValue(line.qty * line.unitPrice)}</span>
          </div>
        ))}
      </Card>

      <div style={{ marginTop: 16 }}>
        <AccountingConnect />
      </div>
      <Footer />
    </div>
  );
}

function Resources({ projectKey }: { projectKey: string }) {
  const storageKey = `es-crew:${projectKey}`;
  const [rows, setRows] = useState<{ id: string; name: string; role: string; hours: number }[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Electrician");
  const [hours, setHours] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setRows(Array.isArray(saved) ? saved : []);
    } catch {
      setRows([]);
    }
  }, [storageKey]);

  function save(next: typeof rows) {
    setRows(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  return (
    <Card style={{ padding: 22, marginTop: 16 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Resources</h2>
      <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
        Crew and hours for this job. Nothing is invented from a sample week.
      </p>
      {rows.length === 0 && <p style={{ color: C.textMuted, fontSize: 14 }}>No crew allocated yet.</p>}
      {rows.map(row => (
        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
          <span><strong>{row.name}</strong> · {row.role}</span>
          <span style={{ fontFamily: FONT.mono }}>{row.hours} h</span>
        </div>
      ))}
      <form
        onSubmit={event => {
          event.preventDefault();
          const parsed = Number(hours);
          if (!name.trim() || !(parsed > 0)) return;
          save([...rows, { id: `${Date.now()}`, name: name.trim(), role: role.trim() || "Electrician", hours: parsed }]);
          setName("");
          setHours("");
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
      >
        <input aria-label="Crew name" value={name} onChange={event => setName(event.target.value)} placeholder="Name" style={fieldStyle} />
        <input aria-label="Crew role" value={role} onChange={event => setRole(event.target.value)} placeholder="Role" style={fieldStyle} />
        <input aria-label="Crew hours" inputMode="numeric" value={hours} onChange={event => setHours(event.target.value)} placeholder="Hours" style={{ ...fieldStyle, width: 100 }} />
        <GhostButton type="submit">Add crew</GhostButton>
      </form>
    </Card>
  );
}

const fieldStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 12px",
  background: C.bg,
  color: C.text,
};

function Mini({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.textMuted, fontSize: 13 }}>
        <span>{label}</span>{icon}
      </div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.textMuted }}>{hint}</div>
    </Card>
  );
}
