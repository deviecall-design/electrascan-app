import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { C } from "../components/desktop/tokens";
import { PageHeader, Card, Footer } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../services/supabaseData";
import { indexRows, readLocalDocumentLabels } from "../lib/documentLabel";
import QueryBanner from "../components/QueryBanner";

/**
 * Landing for the rebuilt job reports. Each row opens that job's burndown.
 */
export default function ReportsHome() {
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const jobs = useMemo(() => {
    const labels = indexRows(estimates as Array<Record<string, unknown>>, scans as Array<Record<string, unknown>>, readLocalDocumentLabels());
    const rows = (estimates as Array<{ id?: string; reference?: string | null; ref?: string | null; created_at?: string | null }>).map(row => {
      const reference = row.reference || row.ref || "";
      return {
        key: reference || row.id || "job",
        name: (reference && labels.byReference[reference]) || (row.id && labels.byEstimateId[row.id]) || reference || "Untitled plan",
        reference,
        created: row.created_at || "",
      };
    });
    return rows.sort((a, b) => (a.created < b.created ? 1 : -1));
  }, [scans, estimates]);

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="reports" />
      <PageHeader
        crumb="Workflow"
        title="Project Reports"
        sub="Open a job to see the budget burndown, hours, milestones, and costs."
      />
      {jobs.length === 0 && !loading && <p style={{ color: C.textMuted }}>No jobs yet. A scan becomes a job.</p>}
      {jobs.map(job => (
        <Card key={job.key} style={{ padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800 }}>{job.name}</div>
            <div style={{ color: C.textMuted, fontSize: 13 }}>{job.reference || "No estimate ref"}</div>
          </div>
          <Link to={`/jobs/${encodeURIComponent(job.key)}/burndown`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 10, background: "#1D6EFD", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            Open reports
          </Link>
        </Card>
      ))}
      <Footer />
    </div>
  );
}
