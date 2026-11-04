import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../services/supabaseData";
import { loadAssemblies, loadLabourRate } from "../lib/assemblies";
import { priceItem } from "../lib/quoteSource";
import { loadPriceList } from "../lib/contractorPrices";
import { readDetectedItems } from "../lib/scanRecord";
import { compareJobCost, JOB_STAGES, STAGE_LABEL, jobKey, type JobStage } from "../lib/jobTracker";
import { loadDefaultMargin, marginForQuote } from "../lib/margin";
import { formatQuotedValue } from "../lib/estimateMoney";
import QueryBanner from "../components/QueryBanner";

interface Actuals {
  stage: JobStage;
  materials: number;
  hours: number;
}

export default function JobsScreen() {
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const assemblies = loadAssemblies();
  const labourRate = loadLabourRate();
  const [actuals, setActuals] = useState<Record<string, Actuals>>({});

  const jobs = useMemo(() => {
    const grouped = new Map<string, { name: string; quoted: number; scanId?: string }>();
    for (const scan of scans as Array<{ id?: string; client?: string | null; file_name?: string; detected_items?: unknown; estimate_ref?: string | null }>) {
      const key = jobKey(scan.client, scan.file_name);
      const current = grouped.get(key) ?? { name: scan.client || scan.file_name || "Unassigned", quoted: 0, scanId: scan.id };
      const sell = readDetectedItems(scan.detected_items)
        .filter(item => item.status !== "rejected" && item.qty > 0)
        .reduce((sum, item) => sum + item.qty * priceItem(item, [], assemblies, labourRate, loadPriceList()).sellUnit, 0);
      current.quoted += sell;
      grouped.set(key, current);
    }
    return [...grouped.entries()].map(([key, job]) => ({ key, ...job }));
  }, [scans, assemblies, labourRate]);

  function actualFor(key: string): Actuals {
    return actuals[key] ?? { stage: "takeoff", materials: 0, hours: 0 };
  }

  async function save(key: string, name: string, quoted: number, next: Actuals) {
    setActuals(current => ({ ...current, [key]: next }));
    await fetch("/api/beta/records?kind=jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_key: key,
        name,
        stage: next.stage,
        quoted_sell: quoted,
        actual_materials: next.materials,
        actual_hours: next.hours,
        labour_rate: labourRate,
      }),
    }).catch(() => undefined);
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="jobs" />
      <PageHeader
        crumb="Projects"
        title="Jobs"
        sub="Status, quoted assemblies, and actual supplier or crew cost. A warning appears when the margin slips."
      />
      {jobs.length === 0 && !loading && <p style={{ color: C.textMuted }}>No jobs yet. A scan becomes a job.</p>}
      {jobs.map(job => {
        const actual = actualFor(job.key);
        const linked = (estimates as Array<{ client?: string | null; reference?: string | null; margin_pct?: number | null }>).filter(row => jobKey(row.client, "") === job.key);
        const savedMargin = linked.find(row => typeof row.margin_pct === "number")?.margin_pct;
        const compare = compareJobCost({
          quotedSell: job.quoted,
          quotedMarginPct: marginForQuote(savedMargin, loadDefaultMargin()),
          actualMaterials: actual.materials,
          actualHours: actual.hours,
          labourRate,
        });
        return (
          <Card key={job.key} style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{job.name}</div>
            <p style={{ margin: "6px 0 12px", color: C.textMuted, fontSize: 14 }}>
              Quoted {formatQuotedValue(compare.quotedSell)} from assemblies
              {compare.marginPct != null && actual.materials + actual.hours > 0 ? ` · margin ${compare.marginPct}%` : ""}
            </p>
            {compare.warning && <p style={{ color: C.red, fontWeight: 700 }}>{compare.warning}</p>}
            <label style={{ display: "block", fontSize: 13, color: C.textMuted }}>
              Stage
              <select
                aria-label={`Stage for ${job.name}`}
                value={actual.stage}
                onChange={event => void save(job.key, job.name, job.quoted, { ...actual, stage: event.target.value as JobStage })}
                style={field}
              >
                {JOB_STAGES.map(stage => <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <label style={{ fontSize: 13, color: C.textMuted }}>
                Supplier invoices ex GST
                <input aria-label={`Supplier cost for ${job.name}`} inputMode="decimal" value={actual.materials || ""} onChange={event => void save(job.key, job.name, job.quoted, { ...actual, materials: Number(event.target.value) || 0 })} style={field} />
              </label>
              <label style={{ fontSize: 13, color: C.textMuted }}>
                Crew hours
                <input aria-label={`Crew hours for ${job.name}`} inputMode="decimal" value={actual.hours || ""} onChange={event => void save(job.key, job.name, job.quoted, { ...actual, hours: Number(event.target.value) || 0 })} style={field} />
              </label>
            </div>
            <p style={{ fontSize: 14 }}>
              Actual cost {formatQuotedValue(compare.actualCost)} · margin {formatQuotedValue(compare.marginDollars)}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 14 }}>
              {job.scanId && <Link to={`/detection/${job.scanId}`}>Takeoff</Link>}
              <Link to="/projects">Milestones and invoices</Link>
              <Link to="/variation-report">Variations</Link>
              {linked[0]?.reference && <Link to="/approvals">Quote {linked[0].reference}</Link>}
            </div>
          </Card>
        );
      })}
      <Footer />
    </div>
  );
}

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 44,
  marginTop: 4,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 10px",
  fontSize: 16,
  background: C.bg,
  color: C.text,
  fontFamily: FONT.body,
  boxSizing: "border-box",
};
