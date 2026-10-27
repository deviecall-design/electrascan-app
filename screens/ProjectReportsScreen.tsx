import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, Target, Clock, CheckCircle2 } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { GhostButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchMilestoneClaimsForProject, submitMilestoneClaim, type MilestoneClaimRow } from "../services/supabaseData";
import { milestoneAfterSave } from "../lib/progressClaim";
import { estimateDisplayRef, formatQuotedValue } from "../lib/estimateMoney";
import QueryBanner from "../components/QueryBanner";

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
    ["deposit", "Deposit", "On acceptance", 0.1],
    ["rough-in", "Rough-in", "Cabling complete", 0.3],
    ["fit-off", "Fit-off", "Fit-off and board connection", 0.4],
    ["pc", "Practical completion", "Test and compliance", 0.2],
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

export default function ProjectReportsScreen() {
  const navigate = useNavigate();
  const { data: estimates, loading, error } = useSupabaseQuery(fetchEstimates);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = estimates.find((row: { id?: string }) => row.id === selectedId) ?? estimates[0] ?? null;
  const projectKey = selected ? estimateDisplayRef(selected) : "";
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

  if (!loading && estimates.length === 0) {
    return (
      <div className="anim-in">
        <PageHeader
          crumb="Project reports"
          title="Project reports"
          sub="Cost and claim figures come from saved estimates. There are none yet."
        />
        <QueryBanner loading={loading} error={error} noun="projects" />
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
      <QueryBanner loading={loading || claimsLoading} error={error} noun="projects" />
      <PageHeader
        crumb="Project reports"
        title={selected?.project_name || selected?.client || "Project"}
        sub={[selected?.client, projectKey, "Figures are from this saved quote."].filter(Boolean).join(" · ")}
      />

      {estimates.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {estimates.map((row: { id: string; client?: string; reference?: string | null; ref?: string | null }) => (
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
              {estimateDisplayRef(row)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Mini label="Contract value" value={loading ? "—" : formatQuotedValue(contract)} hint="Quoted total inc GST" icon={<DollarSign size={16} />} />
        <Mini label="Claimed" value={formatQuotedValue(claimedTotal)} hint="Saved claims only" icon={<CheckCircle2 size={16} />} />
        <Mini label="Quoted margin" value={marginLabel} hint="From the estimate" icon={<Target size={16} />} />
        <Mini label="Status" value={selected?.status === "approved" ? "Won" : (selected?.status || "—")} hint="Estimate status" icon={<Clock size={16} />} />
      </div>

      {claimError && (
        <p style={{ color: C.red, fontSize: 14 }}>{claimError}</p>
      )}

      <Card style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Milestones</h2>
        <p style={{ margin: "0 0 16px", color: C.textMuted, fontSize: 14 }}>
          A claim moves to invoiced draft only after it is stored. A failed save leaves it pending.
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
      <Footer />
    </div>
  );
}

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
