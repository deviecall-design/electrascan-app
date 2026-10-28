import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../services/supabaseData";
import { estimateDisplayRef, formatQuotedValue } from "../lib/estimateMoney";
import { linesFromDetected, materialsExGst, verifiedFromEstimate } from "../lib/variationDiff";
import { approvalsHref } from "../lib/approvalsLink";
import { readDetectedItems, type StoredDetectedItem } from "../lib/scanRecord";
import { formatVerified } from "../lib/takeoff";
import { DEFAULT_MARGIN_PCT } from "../lib/quoteTotals";
import { getActiveCompanyProfile } from "../services/companyProfile";
import SignOrderStep from "../components/desktop/SignOrderStep";
import QueryBanner from "../components/QueryBanner";

interface MaterialRequestRow {
  id?: string;
  estimate_ref?: string | null;
  job_name?: string | null;
  status?: string | null;
}

export default function ApprovalsScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedEstimate = params.get("estimate");
  const requestedScan = params.get("scan");
  const { data: estimates, loading, error } = useSupabaseQuery(fetchEstimates);
  const { data: scans, loading: scansLoading, error: scansError } = useSupabaseQuery(fetchScans);
  const [materials, setMaterials] = useState<MaterialRequestRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/beta/materials")
      .then(res => res.json())
      .then(json => {
        if (!cancelled && Array.isArray(json?.data)) setMaterials(json.data);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const awaiting = estimates.filter((row: { status?: string }) => row.status !== "approved");
  const takeoffs = scans.filter((scan: { estimate_ref?: string | null; detected_items?: unknown }) =>
    !scan.estimate_ref && linesFromDetected(scan.detected_items).length > 0);

  const selectedEstimate = useMemo(() => {
    if (!requestedEstimate) return null;
    return estimates.find((row: { reference?: string; ref?: string }) =>
      row.reference === requestedEstimate || row.ref === requestedEstimate) ?? null;
  }, [estimates, requestedEstimate]);

  const selectedScan = useMemo(() => {
    if (requestedScan) return scans.find((scan: { id?: string }) => scan.id === requestedScan) ?? null;
    if (requestedEstimate) {
      return scans.find((scan: { estimate_ref?: string | null }) => scan.estimate_ref === requestedEstimate) ?? null;
    }
    return takeoffs[0] ?? null;
  }, [scans, requestedScan, requestedEstimate, takeoffs]);

  const items = selectedScan
    ? readDetectedItems(selectedScan.detected_items)
    : itemsFromEstimate(selectedEstimate);
  const reference = selectedEstimate ? estimateDisplayRef(selectedEstimate) : (selectedScan?.estimate_ref ?? null);
  const jobName = selectedScan?.file_name || selectedEstimate?.project_name || selectedEstimate?.client || selectedScan?.client || "Electrical estimate";
  const verified = items.length ? formatVerified(items) : (
    selectedEstimate && verifiedFromEstimate(selectedEstimate) != null
      ? `Takeoff ${verifiedFromEstimate(selectedEstimate)}% verified`
      : null
  );
  const pageLoading = loading || scansLoading;
  const nothing = !pageLoading && awaiting.length === 0 && takeoffs.length === 0 && !selectedScan && !selectedEstimate;

  return (
    <div className="anim-in">
      <QueryBanner loading={pageLoading} error={error || scansError} noun="approvals" />
      <PageHeader
        crumb="Workflow"
        title="Approvals"
        sub="Quotes waiting for a signature, and materials requests for the supplier. This is the only place those are sent."
      />

      {nothing ? (
        <EmptyState
          title="Nothing is waiting"
          body="Save a quote from a scan, or open Sign and order on a takeoff. It will be listed here."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      ) : (
        <>
          <div className="es-pair" style={{ marginBottom: 16 }}>
            <Queue
              title="Awaiting signature"
              empty="No saved quote is waiting."
              rows={awaiting.map((row: { id: string; client?: string; value?: number; status?: string; reference?: string; ref?: string }) => ({
                id: row.id,
                label: `${estimateDisplayRef(row)} · ${row.client || "Client not set"}`,
                detail: `${formatQuotedValue(Number(row.value) || 0)} · ${row.status || "draft"} · signature not sent`,
                href: approvalsHref(scans.find((scan: { estimate_ref?: string | null }) => scan.estimate_ref === estimateDisplayRef(row))?.id, estimateDisplayRef(row)),
                active: estimateDisplayRef(row) === reference,
              }))}
            />
            <Queue
              title="Materials requests"
              empty="No materials request has been saved yet. Open a takeoff to prepare one."
              rows={materials.map(row => ({
                id: row.id || row.estimate_ref || row.job_name || "request",
                label: row.job_name || row.estimate_ref || "Materials request",
                detail: `${row.estimate_ref || "No quote ref"} · ${row.status || "draft"}`,
                href: row.estimate_ref ? approvalsHref(null, row.estimate_ref) : "/approvals",
                active: row.estimate_ref === reference,
              }))}
            />
          </div>

          {takeoffs.length > 0 && (
            <Queue
              title="Takeoffs not yet quoted"
              empty=""
              rows={takeoffs.map((scan: { id: string; file_name?: string; client?: string | null; detected_items?: unknown }) => ({
                id: scan.id,
                label: scan.file_name || scan.client || "Scan",
                detail: `${linesFromDetected(scan.detected_items).length} items · ${formatQuotedValue(materialsExGst(linesFromDetected(scan.detected_items)))} materials · signature not sent`,
                href: approvalsHref(scan.id, null),
                active: scan.id === selectedScan?.id && !reference,
              }))}
            />
          )}

          {(selectedScan || selectedEstimate) && (
            <div style={{ marginTop: 16 }}>
              {verified && <p style={{ marginTop: 0, color: C.orange, fontWeight: 600 }}>{verified}</p>}
              <SignOrderStep
                items={items}
                reference={reference}
                jobName={jobName}
                clientName={selectedScan?.client || selectedEstimate?.client || ""}
                drawingFile={selectedScan?.file_name || selectedEstimate?.drawing_file}
                siteAddress={getActiveCompanyProfile().address || ""}
                scanId={selectedScan?.id}
                marginPct={typeof selectedEstimate?.margin_pct === "number" ? selectedEstimate.margin_pct : DEFAULT_MARGIN_PCT}
                minVerifiedPct={null}
                onBack={() => navigate(selectedScan ? `/detection/${selectedScan.id}` : "/estimate")}
                onSaved={ref => navigate(approvalsHref(selectedScan?.id, ref))}
              />
            </div>
          )}
        </>
      )}
      <Footer />
    </div>
  );
}

function itemsFromEstimate(estimate: { line_items?: unknown } | null): StoredDetectedItem[] {
  if (!estimate || !Array.isArray(estimate.line_items)) return [];
  return estimate.line_items.flatMap((row, index) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    if (record.meta === "takeoff") return [];
    const qty = Number(record.qty);
    const description = typeof record.description === "string" ? record.description : "";
    if (!description || !(qty > 0)) return [];
    const material = Number(record.materialUnit);
    const labour = Number(record.labourUnit);
    const unit = Number(record.unitPrice);
    return [{
      id: index + 1,
      symbol: "",
      qty,
      desc: description,
      rateCode: "",
      conf: 1,
      x: 0,
      y: 0,
      unitPrice: Number.isFinite(material) && Number.isFinite(labour) ? material + labour : (Number.isFinite(unit) ? unit : 0),
      category: typeof record.category === "string" ? record.category : undefined,
      status: "confirmed" as const,
    }];
  });
}

function Queue({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; label: string; detail: string; href: string; active: boolean }[];
}) {
  const navigate = useNavigate();
  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <h2 style={{ margin: "0 0 8px", fontFamily: FONT.heading, fontSize: 16 }}>{title}</h2>
      {rows.length === 0 ? <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>{empty}</p> : rows.map(row => (
        <button
          key={row.id}
          type="button"
          onClick={() => navigate(row.href)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            minHeight: 44,
            padding: "8px 0",
            borderTop: `1px solid ${C.border}`,
            background: row.active ? C.orangeSoft : "transparent",
          }}
        >
          <span style={{ fontWeight: 600 }}>{row.label}</span>
          <span style={{ display: "block", color: C.textMuted, fontSize: 13 }}>{row.detail}</span>
        </button>
      ))}
    </Card>
  );
}
