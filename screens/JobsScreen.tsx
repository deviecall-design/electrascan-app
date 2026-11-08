import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { C } from "../components/desktop/tokens";
import { PageHeader, Card, Footer } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../services/supabaseData";
import { readDetectedItems } from "../lib/scanRecord";
import { estimateTotal, formatGstMoney } from "../lib/estimateTotal";
import { displayClient } from "../lib/jobLink";
import { indexRows, readLocalDocumentLabels } from "../lib/documentLabel";
import { workflowStageIndex } from "../lib/workflowStage";
import StagePipeline from "../components/desktop/StagePipeline";
import QueryBanner from "../components/QueryBanner";

type ProjectFilter = "all" | "active" | "pending" | "complete";

function projectBucket(status: string | null | undefined): Exclude<ProjectFilter, "all"> {
  if (status === "approved" || status === "materials_sent") return "complete";
  if (status === "sent" || status === "sent_for_signature" || status === "viewed") return "active";
  return "pending";
}

export default function JobsScreen() {
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const [filter, setFilter] = useState<ProjectFilter>("all");

  const jobs = useMemo(() => {
    const scanRows = scans as Array<{ id?: string; client?: string | null; file_name?: string; detected_items?: unknown; estimate_ref?: string | null }>;
    const estimateRows = estimates as Array<{ id?: string; client?: string | null; project_name?: string | null; drawing_file?: string | null; reference?: string | null; ref?: string | null; status?: string | null; approval_status?: string | null; created_at?: string | null }>;
    const labels = indexRows(estimateRows as Array<Record<string, unknown>>, scanRows as Array<Record<string, unknown>>, readLocalDocumentLabels());
    const cards = estimateRows.map(row => {
      const reference = row.reference || row.ref || "";
      const scan = scanRows.find(item => item.estimate_ref === reference);
      const approved = row.status === "approved" || row.approval_status === "approved" || row.approval_status === "materials_sent";
      const name = labels.byReference[reference] || (row.id ? labels.byEstimateId[row.id] : "") || reference || "Untitled plan";
      return {
        key: reference || row.id || scan?.id || "job",
        routeKey: reference || row.id || scan?.id || "job",
        name,
        family: name.replace(/\s*\(v\d+\)$/i, ""),
        client: displayClient({ client: row.client, projectName: row.project_name, drawingFile: row.drawing_file, fileName: scan?.file_name }),
        quoted: estimateTotal({
          items: readDetectedItems(scan?.detected_items),
          marginPct: (row as { margin_pct?: number | null }).margin_pct,
          subtotal: (row as { subtotal?: number | null }).subtotal,
          value: (row as { value?: number | null }).value,
        }).incGst,
        reference: reference || null,
        approved,
        bucket: projectBucket(row.approval_status || row.status),
        updated: row.created_at ? String(row.created_at).slice(0, 10) : "—",
        stage: workflowStageIndex({ approval: row.approval_status || row.status, hasEstimate: true }),
      };
    });
    const linked = new Set(cards.map(card => card.reference).filter(Boolean));
    for (const scan of scanRows) {
      if (scan.estimate_ref && linked.has(scan.estimate_ref)) continue;
      cards.push({
        key: scan.id || scan.file_name || "scan",
        routeKey: scan.id || scan.file_name || "scan",
        name: (scan.id && labels.byScanId[scan.id]) || scan.file_name || "Untitled plan",
        family: ((scan.id && labels.byScanId[scan.id]) || scan.file_name || "Untitled plan").replace(/\s*\(v\d+\)$/i, ""),
        client: displayClient({ client: scan.client, fileName: scan.file_name }),
        quoted: estimateTotal({ items: readDetectedItems(scan.detected_items) }).incGst,
        reference: scan.estimate_ref || null,
        approved: false,
        bucket: "pending" as const,
        updated: "—",
        stage: 0,
      });
    }
    const counts = new Map<string, number>();
    for (const card of cards) counts.set(card.family, (counts.get(card.family) || 0) + 1);
    return cards.map(card => ({ ...card, versions: counts.get(card.family) || 1 }));
  }, [scans, estimates]);
  const visible = filter === "all" ? jobs : jobs.filter(job => job.bucket === filter);

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="jobs" />
      <PageHeader
        crumb="Main"
        title="Projects"
        sub={`${jobs.length} project${jobs.length === 1 ? "" : "s"}. Open one for the estimate, scope, burndown, milestones, and documents.`}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(["all", "active", "pending", "complete"] as const).map(id => (
          <button key={id} type="button" onClick={() => setFilter(id)} style={{ ...pill, background: filter === id ? "#1D6EFD" : "#fff", color: filter === id ? "#fff" : C.textMuted, borderColor: filter === id ? "#1D6EFD" : C.border }}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      {visible.length === 0 && !loading && <p style={{ color: C.textMuted }}>No projects in this filter.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {visible.map(job => {
          const accent = job.bucket === "complete" ? "#10B981" : job.bucket === "active" ? "#1D6EFD" : "#F59E0B";
          return (
            <Card key={job.key} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 4, background: accent }} />
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, overflowWrap: "anywhere" }}>{job.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "capitalize" }}>{job.bucket}</span>
                </div>
                <p style={{ margin: "6px 0 0", color: C.textMuted, fontSize: 13 }}>{job.client || "Client not on the drawing"}</p>
                <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 12 }}>{job.reference || "No estimate ref yet"}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
                  <Mini label="Versions" value={String(job.versions)} color={accent} />
                  <Mini label="Last estimate" value={formatGstMoney(job.quoted, "inc")} />
                  <Mini label="Updated" value={job.updated} />
                </div>
                <StagePipeline index={job.stage} label={`Stage for ${job.name}`} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <Link to={`/jobs/${encodeURIComponent(job.routeKey)}/estimate`} style={primaryLink} aria-label={`Open ${job.name}`}>Open</Link>
                  <Link to={`/jobs/${encodeURIComponent(job.routeKey)}/burndown`} style={secondaryLink} aria-label={`Burndown for ${job.name}`}>Reports</Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Footer />
    </div>
  );
}

const pill: React.CSSProperties = { minHeight: 36, padding: "0 14px", borderRadius: 999, border: "1px solid", fontWeight: 700, fontSize: 13 };

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 13, color: color || C.text, overflowWrap: "anywhere" }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

const primaryLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 10,
  background: C.orange,
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
};

const secondaryLink: React.CSSProperties = {
  ...primaryLink,
  background: C.bgCard,
  color: C.text,
  border: `1px solid ${C.border}`,
};
