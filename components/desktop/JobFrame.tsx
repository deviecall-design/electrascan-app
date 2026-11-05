import React, { useMemo } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { C, FONT } from "./tokens";
import useSupabaseQuery from "../../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../../services/supabaseData";
import { readDetectedItems } from "../../lib/scanRecord";
import { displayClient, quotedSellExGst, resolveJobTarget } from "../../lib/jobLink";
import { quoteContract } from "../../lib/burndown";
import { marginForQuote } from "../../lib/margin";
import { approvalFromRow } from "../../lib/approvalStatus";
import { workflowStageIndex } from "../../lib/workflowStage";
import StagePipeline from "./StagePipeline";
import QueryBanner from "../QueryBanner";

const TABS = [
  ["estimate", "Estimate"],
  ["scope", "Scope"],
  ["burndown", "Burndown"],
  ["milestones", "Milestones"],
  ["documents", "Documents"],
] as const;

export interface JobOutletContext {
  embedded: true;
  name: string;
  reference: string;
  scanId?: string;
  contract: number;
  margin: number;
  approved: boolean;
  approval: string;
  drawing: string;
  estimate: { scope_of_works?: unknown; line_items?: unknown; client?: string | null; project_name?: string | null; drawing_file?: string | null } | null;
}

export default function JobFrame() {
  const params = useParams();
  const jobKey = decodeURIComponent(params.jobKey || "");
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const job = useMemo(() => {
    const resolved = resolveJobTarget(jobKey, scans as never[], estimates as never[]);
    const estimate = resolved.estimate as JobOutletContext["estimate"] & { margin_pct?: number | null; approval_status?: string | null; status?: string | null; reference?: string | null; ref?: string | null } | null;
    const scan = resolved.scans[0] as { id?: string; file_name?: string | null; client?: string | null; detected_items?: unknown } | undefined;
    const items = resolved.scans.flatMap(row => readDetectedItems((row as { detected_items?: unknown }).detected_items));
    const sell = quotedSellExGst(items);
    const margin = marginForQuote(estimate?.margin_pct);
    const approval = estimate ? approvalFromRow(estimate) : "";
    return {
      embedded: true as const,
      name: displayClient({
        client: estimate?.client || scan?.client,
        projectName: estimate?.project_name,
        drawingFile: estimate?.drawing_file,
        fileName: scan?.file_name,
      }),
      reference: estimate?.reference || estimate?.ref || scan && (scan as { estimate_ref?: string }).estimate_ref || "",
      scanId: scan?.id,
      contract: quoteContract(sell, margin).total,
      margin,
      approved: approval === "approved" || approval === "materials_sent",
      approval,
      drawing: estimate?.drawing_file || scan?.file_name || "",
      estimate,
      stage: workflowStageIndex({ approval, hasEstimate: Boolean(estimate) }),
    };
  }, [jobKey, scans, estimates]);

  const base = `/jobs/${encodeURIComponent(jobKey)}`;

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="the job" />
      <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 13, color: C.textMuted, marginBottom: 8 }}>
        <Link to="/jobs">Jobs</Link>
        <span>/</span>
        <span style={{ color: C.text, fontWeight: 650 }}>{job.name}</span>
      </nav>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FONT.heading, fontSize: 28, letterSpacing: "-0.03em" }}>{job.name}</h1>
          <p style={{ margin: "6px 0 0", color: C.textMuted }}>
            {[job.reference, job.drawing].filter(Boolean).join(" · ") || "No estimate linked yet"}
          </p>
          <StagePipeline index={job.stage} />
        </div>
      </header>
      <nav aria-label="Job sections" className="es-job-tabs" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0" }}>
        {TABS.map(([path, label]) => (
          <NavLink
            key={path}
            to={`${base}/${path}`}
            style={({ isActive }) => ({
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 14px",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 700,
              background: isActive ? C.ink : C.bgCard,
              color: isActive ? "#fff" : C.text,
              border: `1px solid ${isActive ? C.ink : C.border}`,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={job satisfies JobOutletContext} />
    </div>
  );
}
