import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans } from "../services/supabaseData";
import { estimateDisplayRef, formatQuotedValue } from "../lib/estimateMoney";
import { estimateTotal, formatGstMoney } from "../lib/estimateTotal";
import { linesFromDetected, materialsExGst } from "../lib/variationDiff";
import { approvalsHref } from "../lib/approvalsLink";
import { displayClient } from "../lib/jobLink";
import { indexRows, readLocalDocumentLabels } from "../lib/documentLabel";
import { readDetectedItems, type StoredDetectedItem } from "../lib/scanRecord";
import { formatVerified, verifiedFromEstimate } from "../lib/takeoff";
import { APPROVAL_LABEL, approvalFromRow, type ApprovalStatus } from "../lib/approvalStatus";
import { marginForQuote } from "../lib/margin";
import { getActiveCompanyProfile } from "../services/companyProfile";
import SignOrderStep from "../components/desktop/SignOrderStep";
import { readScopeFromEstimate } from "../lib/scopeOfWorks";
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
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, ApprovalStatus>>({});
  const [approvalTab, setApprovalTab] = useState<"audit" | "estimates" | "parties">("audit");
  const [localEvents, setLocalEvents] = useState<Array<{ id: string; ts: string; actor: string; role: string; label: string; note: string; doc: string }>>([]);

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

  const statusOf = (row: { approval_status?: string | null; status?: string | null; reference?: string | null; ref?: string | null }) =>
    approvalOverrides[estimateDisplayRef(row)] || approvalFromRow(row);
  const labels = useMemo(
    () => indexRows(estimates as Array<Record<string, unknown>>, scans as Array<Record<string, unknown>>, readLocalDocumentLabels()),
    [estimates, scans],
  );
  const awaiting = estimates;
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
  const jobName = (reference && labels.byReference[reference])
    || (selectedEstimate?.id && labels.byEstimateId[selectedEstimate.id])
    || (selectedScan?.id && labels.byScanId[selectedScan.id])
    || "Electrical estimate";
  const verified = items.length ? formatVerified(items) : (
    selectedEstimate && verifiedFromEstimate(selectedEstimate) != null
      ? `Takeoff ${verifiedFromEstimate(selectedEstimate)}% verified`
      : null
  );
  const hero = selectedEstimate || awaiting[0] || null;
  const heroRef = hero ? estimateDisplayRef(hero) : "";
  const heroScan = scans.find((scan: { estimate_ref?: string | null }) => scan.estimate_ref === heroRef);
  const heroTotal = hero ? estimateTotal({
    items: readDetectedItems(heroScan?.detected_items),
    subtotal: hero.subtotal,
    marginPct: hero.margin_pct,
    value: hero.value,
  }).incGst : 0;
  const heroClient = displayClient({
    client: heroScan?.client || hero?.client,
    projectName: hero?.project_name,
    drawingFile: heroScan?.file_name || hero?.drawing_file,
    fileName: heroScan?.file_name,
  });
  const heroStatus = hero ? statusOf(hero) : "ready_for_approval";
  const heroName = (heroRef && labels.byReference[heroRef]) || heroClient;
  const prior = awaiting.find((row: { reference?: string; ref?: string; id?: string }) => hero && estimateDisplayRef(row) !== heroRef && (labels.byReference[estimateDisplayRef(row)] || "").replace(/\s*\(v\d+\)$/i, "") === heroName.replace(/\s*\(v\d+\)$/i, ""));
  const priorTotal = prior ? estimateTotal({
    items: readDetectedItems(scans.find((scan: { estimate_ref?: string | null }) => scan.estimate_ref === estimateDisplayRef(prior))?.detected_items),
    subtotal: prior.subtotal,
    marginPct: prior.margin_pct,
    value: prior.value,
  }).incGst : null;
  const heroDelta = priorTotal == null ? null : Math.round((heroTotal - priorTotal) * 100) / 100;
  const company = getActiveCompanyProfile();
  const pageLoading = loading || scansLoading;

  async function setHeroApproval(next: ApprovalStatus, label: string) {
    if (!heroRef) return;
    setApprovalOverrides(current => ({ ...current, [heroRef]: next }));
    setLocalEvents(current => [...current, {
      id: `${heroRef}-${Date.now()}`,
      ts: new Date().toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      actor: company.name,
      role: "Electrician",
      label,
      note: "Recorded from this approval screen. The entry stays with this quote.",
      doc: heroRef,
    }]);
    await fetch(`/api/beta/estimates?reference=${encodeURIComponent(heroRef)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approval_status: next, reference: heroRef }),
    }).catch(() => undefined);
  }
  const nothing = !pageLoading && awaiting.length === 0 && takeoffs.length === 0 && !selectedScan && !selectedEstimate;

  return (
    <div className="anim-in">
      <QueryBanner loading={pageLoading} error={error || scansError} noun="approvals" />
      <PageHeader
        crumb="Workflow"
        title="Approvals"
        sub="Quotes waiting for a signature, and materials requests for the supplier. This is the only place those are sent."
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={() => window.print()} style={quiet}>Export audit log</button>
        <button type="button" onClick={() => { if (heroRef) void setHeroApproval("sent_for_signature", `${heroRef} sent for approval`); }} style={quiet}>Send for approval</button>
      </div>
      {hero && (
        <div style={{ background: heroStatus === "approved" || heroStatus === "materials_sent" ? "linear-gradient(135deg,#065F46,#022C22)" : "linear-gradient(135deg,#1A3A5C,#0D1B2A)", borderRadius: 14, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#93C5FD", letterSpacing: "0.04em", textTransform: "uppercase" }}>{heroStatus === "approved" || heroStatus === "materials_sent" ? "Approved" : "Pending approval"}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 4 }}>{heroRef} awaiting review by {heroClient}</div>
            <div style={{ fontSize: 13, color: "#CBD5E1", marginTop: 4 }}>
              {formatGstMoney(heroTotal, "inc")}
              {heroDelta != null ? ` · ${heroDelta >= 0 ? "+" : "−"}${formatGstMoney(Math.abs(heroDelta), "inc")} vs the previous estimate` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void setHeroApproval("approved", `${heroRef} approved`)} style={{ ...actionBtn, background: "#10B981" }}>Approve</button>
            <button type="button" onClick={() => void setHeroApproval("ready_for_approval", `${heroRef} returned`)} style={{ ...actionBtn, background: "#EF4444" }}>Return</button>
          </div>
        </div>
      )}
      <ApprovalStepper status={heroStatus} />
      <div role="tablist" aria-label="Approval sections" style={{ display: "flex", gap: 4, borderBottom: `2px solid ${C.border}`, margin: "16px 0" }}>
        {([["audit", "Audit trail"], ["estimates", "Estimates"], ["parties", "Parties"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={approvalTab === id} onClick={() => setApprovalTab(id)} style={{ minHeight: 44, padding: "8px 14px", border: "none", borderBottom: `2px solid ${approvalTab === id ? "#1D6EFD" : "transparent"}`, background: "transparent", color: approvalTab === id ? "#1D6EFD" : C.textMuted, fontWeight: 700, marginBottom: -2 }}>{label}</button>
        ))}
      </div>
      {approvalTab === "audit" && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <p style={{ marginTop: 0, color: C.textMuted, fontSize: 13 }}>{(hero ? 1 : 0) + localEvents.length} timestamped events from this quote. New approve and return actions are appended and are not rewritten.</p>
          {hero && <AuditRow ts={hero.created_at ? String(hero.created_at).slice(0, 16).replace("T", " ") : "Saved quote"} actor={company.name} role="Electrician" label={`${heroRef} ${APPROVAL_LABEL[heroStatus]}`} note={heroName} doc={heroRef} />}
          {localEvents.filter(event => event.doc === heroRef).map(event => <AuditRow key={event.id} {...event} />)}
          {!hero && <p style={{ color: C.textMuted }}>Save a quote and it will be listed here.</p>}
        </Card>
      )}
      {approvalTab === "parties" && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Party name={company.name} detail={company.email} role="Electrician" />
          <Party name={heroClient} detail={heroName} role="Builder" />
        </Card>
      )}

      {approvalTab !== "estimates" ? null : nothing ? (
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
              title="Ready for approval"
              empty="No saved quote is waiting. Save a priced takeoff and it will land here."
              rows={awaiting.map((row: { id: string; client?: string; value?: number; subtotal?: number | null; margin_pct?: number | null; status?: string; approval_status?: string; reference?: string; ref?: string }) => ({
                id: row.id,
                label: labels.byReference[estimateDisplayRef(row)] || estimateDisplayRef(row),
                detail: `${estimateDisplayRef(row)} · ${formatGstMoney(estimateTotal({
                  items: readDetectedItems((scans as Array<{ estimate_ref?: string | null; detected_items?: unknown }>).find(scan => scan.estimate_ref === estimateDisplayRef(row))?.detected_items),
                  subtotal: row.subtotal,
                  marginPct: row.margin_pct,
                  value: row.value,
                }).incGst, "inc")} · ${APPROVAL_LABEL[statusOf(row)]}`,
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
                label: labels.byScanId[scan.id] || scan.file_name || "Scan",
                detail: `${linesFromDetected(scan.detected_items).length} items · ${formatQuotedValue(materialsExGst(linesFromDetected(scan.detected_items)))} materials · signature not sent`,
                href: approvalsHref(scan.id, null),
                active: scan.id === selectedScan?.id && !reference,
              }))}
            />
          )}

          {(selectedScan || selectedEstimate) && (
            <div style={{ marginTop: 16 }}>
              {verified && <p style={{ marginTop: 0, color: C.orange, fontWeight: 600 }}>{verified}</p>}
              <p style={{ marginTop: 0 }}>
                <Link to={`/jobs/${encodeURIComponent(reference || selectedEstimate?.id || selectedScan?.id || jobName)}/burndown`}>Open burndown</Link>
              </p>
              <SignOrderStep
                items={items}
                reference={reference}
                jobName={jobName}
                clientName={displayClient({
                  client: selectedScan?.client || selectedEstimate?.client,
                  projectName: selectedEstimate?.project_name,
                  drawingFile: selectedScan?.file_name || selectedEstimate?.drawing_file,
                  fileName: selectedScan?.file_name,
                })}
                drawingFile={selectedScan?.file_name || selectedEstimate?.drawing_file}
                siteAddress={getActiveCompanyProfile().address || ""}
                scanId={selectedScan?.id}
                marginPct={marginForQuote(selectedEstimate?.margin_pct)}
                minVerifiedPct={null}
                approvalStatus={selectedEstimate ? statusOf(selectedEstimate) : "ready_for_approval"}
                initialScope={readScopeFromEstimate(selectedEstimate)}
                onApproval={next => {
                  if (reference) setApprovalOverrides(current => ({ ...current, [reference]: next }));
                }}
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

const STEPS = ["Draft", "Submitted", "Builder review", "Re-estimate request", "New estimate", "Final approval"];

function ApprovalStepper({ status }: { status: ApprovalStatus }) {
  const current = status === "approved" || status === "materials_sent" ? 6 : status === "sent_for_signature" ? 2 : 1;
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 12px", overflowX: "auto" }}>
      <div style={{ display: "flex", minWidth: 640 }}>
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const color = done ? "#10B981" : active ? "#1D6EFD" : "#94A3B8";
          return (
            <div key={step} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#10B981" : active ? "#1D6EFD" : "#F1F5F9", color: done || active ? "#fff" : "#94A3B8", fontWeight: 800 }}>{done ? "✓" : index + 1}</div>
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color }}>{step}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuditRow({ ts, actor, role, label, note, doc }: { ts: string; actor: string; role: string; label: string; note: string; doc: string }) {
  const roleColor = role === "Builder" ? "#8B5CF6" : "#1D6EFD";
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: roleColor, background: `${roleColor}18`, borderRadius: 999, padding: "2px 8px" }}>{role}</span>
          <span style={{ marginLeft: 8, color: C.textMuted }}>{actor}</span>
        </div>
        <div style={{ marginTop: 4, color: C.textMuted, fontSize: 13 }}>{note}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12, color: C.textMuted }}>
        <div>{ts}</div>
        <div style={{ color: "#1D6EFD" }}>{doc}</div>
        <div style={{ color: "#10B981", fontWeight: 700 }}>Verified</div>
      </div>
    </div>
  );
}

function Party({ name, detail, role }: { name: string; detail: string; role: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontWeight: 700 }}>{name}</div>
        <div style={{ color: C.textMuted, fontSize: 13 }}>{detail}</div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#1D6EFD" }}>{role}</span>
    </div>
  );
}

const quiet: React.CSSProperties = { minHeight: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", fontWeight: 700 };
const actionBtn: React.CSSProperties = { minHeight: 44, padding: "0 18px", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700 };

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
