import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { Card } from "../components/ui/anthropic";
import { formatAud } from "../lib/quoteTotals";
import { formatGstMoney } from "../lib/estimateTotal";
import { paymentSchedule } from "../lib/burndown";
import { readScopeFromEstimate } from "../lib/scopeOfWorks";
import { ScopePreview } from "../components/desktop/ScopeOfWorksCard";
import type { JobOutletContext } from "../components/desktop/JobFrame";

function useJob() {
  return useOutletContext<JobOutletContext>();
}

export function JobEstimateTab() {
  const job = useJob();
  return (
    <Card style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0, fontFamily: FONT.heading }}>Estimate</h2>
      <p style={{ color: C.textMuted }}>
        {job.reference || "No estimate saved yet"} · {job.margin}% margin · {formatGstMoney(job.contract, "inc")}
      </p>
      <p>{job.approved ? "This quote is approved." : "This quote is still moving through approval."}</p>
      {job.scanId ? (
        <Link to={`/detection/${job.scanId}`} style={action}>Open estimate</Link>
      ) : (
        <p>Upload a plan before there is an estimate to open.</p>
      )}
    </Card>
  );
}

export function JobScopeTab() {
  const job = useJob();
  const scope = readScopeFromEstimate(job.estimate);
  return (
    <Card style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0, fontFamily: FONT.heading }}>Scope</h2>
      {scope ? <ScopePreview scope={scope} /> : (
        <p style={{ color: C.textMuted }}>
          No scope has been saved on this estimate yet.
          {job.scanId ? <> <Link to={`/detection/${job.scanId}`}>Open the estimate</Link> to write one.</> : null}
        </p>
      )}
    </Card>
  );
}

export function JobMilestonesTab() {
  const job = useJob();
  const rows = paymentSchedule(job.contract);
  return (
    <Card style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0, fontFamily: FONT.heading }}>Milestones</h2>
      <p style={{ color: C.textMuted }}>Planned shares of the ${formatAud(job.contract)} contract. Claims are raised from Milestones.</p>
      {rows.map(row => (
        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontWeight: 700 }}>{row.label}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>{row.description}</div>
          </div>
          <div style={{ fontFamily: FONT.mono, fontWeight: 700 }}>${formatAud(row.amount)} · {row.pct}%</div>
        </div>
      ))}
      <p><Link to="/projects">Open milestone claims</Link></p>
    </Card>
  );
}

export function JobDocumentsTab() {
  const job = useJob();
  return (
    <Card style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0, fontFamily: FONT.heading }}>Documents</h2>
      <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
        <li>Drawing: {job.drawing || "No drawing file on this job"}</li>
        <li>Estimate: {job.reference || "Not saved"}</li>
      </ul>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {job.scanId && <Link to={`/detection/${job.scanId}`} style={action}>Open plan</Link>}
        {job.reference && <Link to={`/approvals?estimate=${encodeURIComponent(job.reference)}`} style={action}>Open approval</Link>}
      </div>
    </Card>
  );
}

const action: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 10,
  background: C.orange,
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
};
