import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { C } from "../components/desktop/tokens";
import { PageHeader, Card, Footer } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../services/supabaseData";
import { readDetectedItems } from "../lib/scanRecord";
import { quotedSellExGst } from "../lib/jobLink";
import { indexRows, readLocalDocumentLabels } from "../lib/documentLabel";
import { workflowStageIndex } from "../lib/workflowStage";
import StagePipeline from "../components/desktop/StagePipeline";
import { formatQuotedValue } from "../lib/estimateMoney";
import QueryBanner from "../components/QueryBanner";

export default function JobsScreen() {
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);

  const jobs = useMemo(() => {
    const scanRows = scans as Array<{ id?: string; client?: string | null; file_name?: string; detected_items?: unknown; estimate_ref?: string | null }>;
    const estimateRows = estimates as Array<{ id?: string; client?: string | null; project_name?: string | null; drawing_file?: string | null; reference?: string | null; ref?: string | null; status?: string | null; approval_status?: string | null }>;
    const labels = indexRows(estimateRows as Array<Record<string, unknown>>, scanRows as Array<Record<string, unknown>>, readLocalDocumentLabels());
    const cards = estimateRows.map(row => {
      const reference = row.reference || row.ref || "";
      const scan = scanRows.find(item => item.estimate_ref === reference);
      const approved = row.status === "approved" || row.approval_status === "approved" || row.approval_status === "materials_sent";
      return {
        key: reference || row.id || scan?.id || "job",
        routeKey: reference || row.id || scan?.id || "job",
        name: labels.byReference[reference] || (row.id ? labels.byEstimateId[row.id] : "") || reference || "Untitled plan",
        quoted: quotedSellExGst(readDetectedItems(scan?.detected_items)),
        reference: reference || null,
        approved,
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
        quoted: quotedSellExGst(readDetectedItems(scan.detected_items)),
        reference: scan.estimate_ref || null,
        approved: false,
        stage: 0,
      });
    }
    return cards;
  }, [scans, estimates]);

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="jobs" />
      <PageHeader
        crumb="Projects"
        title="Jobs"
        sub="Where each job sits, from the uploaded plan through to the supplier. Open a job for the estimate, scope, burndown, milestones, and documents."
      />
      {jobs.length === 0 && !loading && <p style={{ color: C.textMuted }}>No jobs yet. A scan becomes a job.</p>}
      {jobs.map(job => (
        <Card key={job.key} style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 18, overflowWrap: "anywhere" }}>{job.name}</div>
              <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 14 }}>
                {job.reference ? `${job.reference} · ` : ""}
                Quoted {formatQuotedValue(job.quoted)} ex GST
              </p>
            </div>
            <StagePipeline index={job.stage} label={`Stage for ${job.name}`} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14, alignItems: "center" }}>
            <Link to={`/jobs/${encodeURIComponent(job.routeKey)}/estimate`} style={primaryLink} aria-label={`Open ${job.name}`}>
              Open job
            </Link>
            <Link to={`/jobs/${encodeURIComponent(job.routeKey)}/burndown`} style={secondaryLink} aria-label={`Burndown for ${job.name}`}>
              Burndown
            </Link>
            {!job.approved && <span style={{ color: C.textMuted, fontSize: 14 }}>Tracking starts on approval.</span>}
          </div>
        </Card>
      ))}
      <Footer />
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
