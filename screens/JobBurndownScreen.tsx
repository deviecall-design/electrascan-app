import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { C } from "../components/desktop/tokens";
import { PageHeader, Card, Footer } from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchMilestoneClaimsForProject, fetchScans } from "../services/supabaseData";
import { loadAssemblies, loadLabourRate } from "../lib/assemblies";
import { priceItem } from "../lib/quoteSource";
import { defaultHourlyRole, incGst, loadLabourCard } from "../lib/labourRates";
import { buildLedger, ledgerRows, priceTimesheet, remainingAt, weekHours, type CostKind, type LedgerCost } from "../lib/jobLedger";
import LedgerChart from "../components/desktop/LedgerChart";
import * as XLSX from "xlsx";
import { readDetectedItems } from "../lib/scanRecord";
import { resolveJobTarget } from "../lib/jobLink";
import { estimateTotal, formatGstMoney } from "../lib/estimateTotal";
import { indexRows, readLocalDocumentLabels } from "../lib/documentLabel";
import { approvalFromRow } from "../lib/approvalStatus";
import { getActiveCompanyProfile } from "../services/companyProfile";
import QueryBanner from "../components/QueryBanner";
import { burnPercent, milestoneWeekIndex, paymentSchedule, type ActualEntry } from "../lib/burndown";
import { claimedMilestone, milestoneWarning, reportClaimStatus, REPORT_STATUS_LABEL, showOverrunAlert, type ReportClaimStatus } from "../lib/reportMilestone";
import AccountingConnect from "../components/desktop/AccountingConnect";
import { formatAud, roundCents } from "../lib/quoteTotals";

interface Schedule {
  start: string;
  end: string;
}

export default function JobBurndownScreen() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const jobId = decodeURIComponent(params.jobKey || "");
  const embedded = Boolean(useOutletContext<{ embedded?: boolean } | undefined>()?.embedded);
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const assemblies = loadAssemblies();
  const labourRate = loadLabourRate();
  const [entries, setEntries] = useState<ActualEntry[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({ start: "", end: "" });
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const [claims, setClaims] = useState<Array<{ milestone_id?: string; status?: string; inv_ref?: string | null }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id?: string; source_ref?: string | null; job_name?: string | null }>>([]);
  const [costs, setCosts] = useState<LedgerCost[]>([]);
  const [drawer, setDrawer] = useState<CostKind | null>(null);
  const [gstMode, setGstMode] = useState<"ex" | "inc">("ex");
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<"overview" | "burndown" | "hours" | "milestones" | "overruns" | "accounting">(
    requestedTab === "milestones" || requestedTab === "burndown" || requestedTab === "hours" || requestedTab === "overruns" || requestedTab === "accounting" ? requestedTab : "overview",
  );
  const [payTab, setPayTab] = useState<"schedule" | "claims" | "deposit">("schedule");
  const [costDraft, setCostDraft] = useState({ date: today(), roleId: "", hours: "", amount: "", supplier: "TLE", reference: "", note: "" });

  const job = useMemo(() => {
    const scanRows = scans as Array<{ id?: string; client?: string | null; file_name?: string | null; estimate_ref?: string | null; detected_items?: unknown }>;
    const estimateRows = estimates as Array<{ id?: string; client?: string | null; project_name?: string | null; drawing_file?: string | null; reference?: string | null; ref?: string | null; margin_pct?: number | null; status?: string | null; approval_status?: string | null }>;
    const resolved = resolveJobTarget(jobId, scanRows, estimateRows);
    const estimate = resolved.estimate;
    const items = resolved.scans.flatMap(scan => readDetectedItems(scan.detected_items));
    let hours = 0;
    let labourDollars = 0;
    for (const item of items) {
      if (item.status === "rejected" || item.qty <= 0) continue;
      const quote = priceItem(item, [], assemblies, labourRate, [], loadLabourCard());
      hours += item.qty * quote.labourHours;
      labourDollars += item.qty * quote.labourUnit;
    }
    const total = estimateTotal({
      items,
      subtotal: (estimate as { subtotal?: number | null } | null)?.subtotal,
      marginPct: estimate?.margin_pct,
      value: (estimate as { value?: number | null } | null)?.value,
    });
    const approved = estimate ? ["approved", "materials_sent"].includes(approvalFromRow(estimate)) : false;
    const labels = indexRows(estimateRows as Array<Record<string, unknown>>, scanRows as Array<Record<string, unknown>>, readLocalDocumentLabels());
    const reference = estimate?.reference || estimate?.ref || resolved.scans[0]?.estimate_ref || "";
    return {
      name: (reference && labels.byReference[reference]) || (resolved.scans[0]?.id && labels.byScanId[resolved.scans[0].id]) || "Untitled plan",
      reference,
      approved,
      sell: total.sellExGst,
      hours,
      labourDollars,
      margin: total.marginPct,
      contract: total.incGst,
      contractExGst: total.contractExGst,
      scanId: resolved.scans[0]?.id,
    };
  }, [scans, estimates, assemblies, labourRate, jobId]);

  useEffect(() => {
    const main = document.querySelector(".es-main");
    if (!main) return;
    if (job.approved && !loading && !estimatesLoading) main.classList.add("es-approved-job");
    return () => main.classList.remove("es-approved-job");
  }, [job.approved, loading, estimatesLoading]);

  useEffect(() => {
    const savedDates = readJson<Schedule>(`es-job-dates:${jobId}`);
    const savedActuals = readJson<ActualEntry[]>(`es-job-actuals:${jobId}`);
    if (savedDates?.start && savedDates.end) setSchedule(savedDates);
    if (Array.isArray(savedActuals)) setEntries(savedActuals);
    const savedCosts = readJson<LedgerCost[]>(`es-job-costs:${jobId}`);
    if (Array.isArray(savedCosts)) setCosts(savedCosts);
    fetch("/api/beta/records?kind=costs")
      .then(res => res.json())
      .then(body => {
        if (cancelled) return;
        if (body.migration) setMigrationNote(`Job costs need ${body.migration}. New costs stay in this browser until then.`);
        if (Array.isArray(body.data) && body.data.length > 0) {
          const rows = body.data
            .filter((row: { job_ref?: string }) => row.job_ref === jobId)
            .map(costFromRow)
            .filter((row: LedgerCost) => row.date);
          if (rows.length) setCosts(rows);
        }
      })
      .catch(() => undefined);
    let cancelled = false;
    fetch("/api/beta/records?kind=actuals")
      .then(res => res.json())
      .then(body => {
        if (cancelled) return;
        if (body.migration) setMigrationNote(`The dated log needs ${body.migration}. Entries stay in this browser until then.`);
        if (Array.isArray(body.data) && body.data.length > 0) {
          const rows = body.data
            .filter((row: { job_id?: string }) => row.job_id === jobId)
            .map(fromRow);
          if (rows.length) setEntries(rows);
        }
      })
      .catch(() => undefined);
    fetch("/api/beta/records?kind=schedules")
      .then(res => res.json())
      .then(body => {
        if (cancelled || !Array.isArray(body.data)) return;
        const row = body.data.find((item: { job_id?: string }) => item.job_id === jobId);
        if (row?.start_on && row?.end_on) setSchedule({ start: String(row.start_on).slice(0, 10), end: String(row.end_on).slice(0, 10) });
      })
      .catch(() => undefined);
    fetch("/api/beta/records?kind=invoices")
      .then(res => res.json())
      .then(body => { if (!cancelled && Array.isArray(body.data)) setInvoices(body.data); })
      .catch(() => undefined);
    if (job.reference) {
      fetchMilestoneClaimsForProject(job.reference).then(({ data }) => {
        if (!cancelled) setClaims((data as Array<{ milestone_id?: string; status?: string; inv_ref?: string | null }> | null) ?? []);
      });
    }
    return () => { cancelled = true; };
  }, [jobId, job.reference]);

  const legacyCosts: LedgerCost[] = entries.flatMap(entry => {
    const rows: LedgerCost[] = [];
    if (entry.materials > 0) rows.push({ id: `${entry.id || entry.date}-supplier`, date: entry.date, kind: "supplier", amount: entry.materials, supplier: "Supplier", note: entry.note });
    if (entry.labourCost > 0 || entry.labourHours > 0) rows.push({ id: `${entry.id || entry.date}-labour`, date: entry.date, kind: "timesheet", amount: entry.labourCost, hours: entry.labourHours, note: entry.note });
    return rows;
  });
  const span = buildLedger({
    baselineExGst: job.contractExGst,
    start: schedule.start,
    end: schedule.end,
    costs: [...legacyCosts, ...costs],
    claims: [],
  });
  const scheduled = paymentSchedule(job.contractExGst);
  const drift = roundCents(scheduled.reduce((sum, row) => sum + row.amount, 0) - job.contractExGst);
  if (scheduled.length && drift) scheduled[scheduled.length - 1] = { ...scheduled[scheduled.length - 1], amount: roundCents(scheduled[scheduled.length - 1].amount - drift) };
  const claimEvents = scheduled.map((row, index) => {
    const claim = claims.find(item => item.milestone_id === row.id);
    const invoice = invoices.find(item => item.source_ref === row.id);
    const status = claim?.status === "received" || claim?.status === "paid" ? "paid" : invoice || claim ? "invoiced" : "unpaid";
    const weekIndex = span.weeks.length ? milestoneWeekIndex(index, scheduled.length, span.weeks.length) : 0;
    return {
      id: row.id,
      date: span.weeks[weekIndex]?.start || "",
      label: row.label,
      amount: row.amount,
      status: status as "paid" | "invoiced" | "unpaid",
      kind: (invoice ? "invoice" : "claim") as "invoice" | "claim",
    };
  });
  const ledger = buildLedger({
    baselineExGst: job.contractExGst,
    start: schedule.start,
    end: schedule.end,
    costs: [...legacyCosts, ...costs],
    claims: claimEvents.filter(row => row.amount > 0 && row.date),
  });
  const show = (amountEx: number) => formatGstMoney(gstMode === "inc" ? incGst(amountEx) : amountEx, gstMode);
  const asOf = today();
  const forecastRemaining = roundCents(job.contractExGst - ledger.summary.forecastAtCompletion);
  const labourSpent = roundCents(ledger.weeks.reduce((sum, week) => sum + week.labour, 0));
  const materialsSpent = roundCents(ledger.weeks.reduce((sum, week) => sum + week.supplier, 0));
  const otherSpent = roundCents(ledger.weeks.reduce((sum, week) => sum + week.other, 0));
  const labourBudget = roundCents(Math.max(0, job.labourDollars));
  const materialsBudget = roundCents(Math.max(0, (job.sell > 0 ? job.sell : job.contractExGst) - labourBudget));
  const contingency = job.sell > 0 ? roundCents(Math.max(0, job.contractExGst - job.sell)) : 0;
  const overrunAmount = roundCents(otherSpent + Math.max(0, labourSpent - labourBudget) + Math.max(0, materialsSpent - materialsBudget));
  const contingLeft = roundCents(Math.max(0, contingency - overrunAmount));
  const plannedHours = Math.round(job.hours * 10) / 10;
  const loggedHours = Math.round(ledger.weeks.reduce((sum, week) => sum + weekHours(week.items, plannedHours, ledger.weeks.length).actual, 0) * 10) / 10;
  const hoursGap = Math.round((loggedHours - plannedHours) * 10) / 10;
  const pctBurnt = burnPercent(ledger.summary.costToDate, job.contractExGst);
  const reportRows = scheduled.map(row => {
    const claim = claims.find(item => item.milestone_id === row.id);
    const invoice = invoices.find(item => item.source_ref === row.id);
    const event = claimEvents.find(item => item.id === row.id);
    const status = reportClaimStatus({
      retention: row.id === "retention",
      due: Boolean(event?.date && event.date <= asOf),
      stored: claim?.status,
      hasInvoice: Boolean(invoice),
    });
    return {
      ...row,
      retention: row.id === "retention",
      status,
      date: event?.date || "",
      invoiceRef: claim?.inv_ref || invoice?.id || "",
    };
  });
  let cumulativePct = 0;
  const milestoneProgress = reportRows.map(row => {
    cumulativePct += row.pct;
    return { label: row.label, cumulativePct, status: row.status };
  });
  const warning = milestoneWarning({ burnPct: pctBurnt, milestones: milestoneProgress });
  const plannedToDate = [...ledger.weeks].reverse().find(week => week.start <= asOf)?.plannedCumulative ?? 0;
  const overrunVisible = showOverrunAlert({ overrunAmount, costToDate: ledger.summary.costToDate, plannedToDate });
  const progressRows = reportRows.filter(row => !row.retention);
  const claimedCount = progressRows.filter(row => claimedMilestone(row.status)).length;
  const depositRow = reportRows.find(row => row.id === "deposit");
  const depositReceived = depositRow?.status === "received" ? depositRow.amount : 0;
  const progressInvoiced = roundCents(progressRows.filter(row => row.status === "invoiced" || row.status === "invoiced-draft").reduce((sum, row) => sum + row.amount, 0));
  const progressReceived = roundCents(progressRows.filter(row => row.status === "received" && row.id !== "deposit").reduce((sum, row) => sum + row.amount, 0));
  const milestoneMarks = claimEvents.map(row => ({
    label: row.label,
    amount: gstMode === "inc" ? incGst(row.amount) : row.amount,
    status: REPORT_STATUS_LABEL[reportRows.find(item => item.id === row.id)?.status || "pending"],
    weekIndex: Math.max(0, ledger.weeks.findIndex(week => week.start === row.date)),
  }));

  function sendToFinance() {
    const profile = getActiveCompanyProfile();
    const subject = `Project report · ${job.name || job.reference || "Job"}`;
    const body = [
      job.name,
      job.reference,
      `Budget ${show(job.contractExGst)}`,
      `Spent ${show(ledger.summary.costToDate)} (${pctBurnt}%)`,
      `Remaining ${show(ledger.summary.remaining)}`,
      `Claimed ${show(ledger.summary.claimedToDate)} (${claimedCount} of ${progressRows.length})`,
      `Contingency remaining ${show(contingLeft)} of ${show(contingency)}`,
    ].filter(Boolean).join("\n");
    window.location.href = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function exportLedger() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(ledgerRows(ledger.weeks)), "Ledger");
    const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${job.reference || "job"}-ledger.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  async function saveDates(event: React.FormEvent) {
    event.preventDefault();
    if (!schedule.start || !schedule.end || schedule.end < schedule.start) return;
    writeJson(`es-job-dates:${jobId}`, schedule);
    const res = await fetch("/api/beta/records?kind=schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, start_on: schedule.start, end_on: schedule.end }),
    }).catch(() => null);
    if (res && !res.ok) {
      const body = await res.json().catch(() => ({}));
      setMigrationNote(body.error || migrationNote);
    }
  }

  async function addCost(event: React.FormEvent) {
    event.preventDefault();
    if (!drawer || !costDraft.date) return;
    const card = loadLabourCard() || [];
    const role = card.find(item => item.id === costDraft.roleId) || defaultHourlyRole(card);
    const hours = Math.max(0, Number(costDraft.hours) || 0);
    const amount = drawer === "timesheet"
      ? priceTimesheet(hours, role, labourRate)
      : Math.max(0, Number(costDraft.amount) || 0);
    if (!(amount > 0)) return;
    const entry: LedgerCost = {
      id: `local-${Date.now()}`,
      date: costDraft.date,
      kind: drawer,
      amount,
      hours: drawer === "timesheet" ? hours : undefined,
      roleName: drawer === "timesheet" ? role?.name : undefined,
      supplier: drawer === "supplier" ? costDraft.supplier || "TLE" : undefined,
      reference: costDraft.reference || undefined,
      note: costDraft.note || undefined,
    };
    const next = [...costs, entry];
    setCosts(next);
    writeJson(`es-job-costs:${jobId}`, next);
    setDrawer(null);
    await fetch("/api/beta/records?kind=costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_ref: jobId,
        kind: entry.kind,
        spent_on: entry.date,
        hours: entry.hours || 0,
        role_name: entry.roleName || null,
        amount: entry.amount,
        supplier: entry.supplier || null,
        reference: entry.reference || null,
        note: entry.note || null,
      }),
    }).catch(() => undefined);
  }

  async function submitClaim(row: { id: string; label: string; amount: number }) {
    const invRef = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    setClaims(current => [...current.filter(item => item.milestone_id !== row.id), { milestone_id: row.id, status: "draft", inv_ref: invRef }]);
    const res = await fetch("/api/beta/records?kind=claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: job.reference || jobId,
        milestone_id: row.id,
        milestone_label: row.label,
        amount: row.amount,
        inv_ref: invRef,
        status: "draft",
      }),
    }).catch(() => null);
    if (res && !res.ok) {
      const body = await res.json().catch(() => ({}));
      setMigrationNote(body.error || "The claim is saved in this browser until the claims migration is applied.");
    }
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="the job" />
      {!embedded && (
        <PageHeader
          crumb="Jobs"
          title={job.name || "Job burndown"}
          sub={[job.reference, job.approved ? "Approved contract" : "Projected from the latest estimate"].filter(Boolean).join(" · ")}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Project Reports</div>
          <span style={{ background: "#0D1B2A", color: "#60A5FA", fontSize: 9, fontWeight: 700, padding: "2px 9px", borderRadius: 20, letterSpacing: "1.5px" }}>INTERNAL ONLY</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => window.print()} style={outlineBtn}>Export PDF</button>
          <button type="button" onClick={sendToFinance} style={burndownTab}>Send to Finance</button>
        </div>
      </div>
      <p role="status" style={{ color: C.ink, background: job.approved ? C.greenSoft : C.amberSoft, borderRadius: 12, padding: "12px 14px" }}>
        {job.approved ? "Approved contract. Costs reduce what is left of that price." : "Projected. This estimate is not approved yet, so the baseline is the latest quote, not a signed contract."}
      </p>
      {migrationNote && <p style={{ color: C.amber }}>{migrationNote}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
        <button type="button" onClick={() => setGstMode(current => current === "ex" ? "inc" : "ex")} style={burndownTab}>
          {gstMode === "ex" ? "Show inc GST" : "Show ex GST"}
        </button>
        <button type="button" onClick={() => setDrawer("timesheet")} style={quietBtn}>Add timesheet</button>
        <button type="button" onClick={() => setDrawer("supplier")} style={quietBtn}>Add TLE invoice</button>
        <button type="button" onClick={() => setDrawer("other")} style={quietBtn}>Add other cost</button>
        <button type="button" onClick={() => setTab("milestones")} style={quietBtn}>Milestones</button>
        <button type="button" onClick={exportLedger} style={quietBtn}>Export Excel</button>
      </div>
      <form onSubmit={saveDates} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>Start<input aria-label="Job start" type="date" value={schedule.start} onChange={event => setSchedule(current => ({ ...current, start: event.target.value }))} style={fieldStyle} /></label>
        <label style={labelStyle}>End<input aria-label="Job end" type="date" value={schedule.end} onChange={event => setSchedule(current => ({ ...current, end: event.target.value }))} style={fieldStyle} /></label>
        <PrimaryButton type="submit">Save dates</PrimaryButton>
      </form>
      <div role="tablist" aria-label="Job reports" style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: `2px solid ${C.border}`, marginBottom: 16 }}>
        {([
          ["overview", "📊 Overview"],
          ["burndown", "📉 Burndown"],
          ["hours", "⏱ Hours"],
          ["milestones", "🚩 Milestones"],
          ["overruns", "⚠️ Overruns"],
          ["accounting", "🔗 Accounting"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...tabBtn, color: tab === id ? "#1D6EFD" : "#64748B", borderBottomColor: tab === id ? "#1D6EFD" : "transparent", fontWeight: 600, fontSize: 12 }}>{label}</button>
        ))}
      </div>
      {(warning || overrunVisible) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {warning && (
            <div role="status" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderLeft: "4px solid #F59E0B", borderRadius: 8, padding: "8px 14px", display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span aria-hidden>⚠️</span>
              <div><strong style={{ color: "#92400E" }}>Milestone warning — </strong><span style={{ color: "#78350F" }}>Budget is {pctBurnt}% burnt. {warning.label} is not claimed yet.</span></div>
            </div>
          )}
          {overrunVisible && (
            <div role="status" style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderLeft: "4px solid #EF4444", borderRadius: 8, padding: "8px 14px", display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span aria-hidden>🔺</span>
              <div><strong style={{ color: "#991B1B" }}>Overrun alert — </strong><span style={{ color: "#7F1D1D" }}>{show(Math.max(overrunAmount, roundCents(ledger.summary.costToDate - plannedToDate)))} is past the plan. {show(contingLeft)} contingency remaining.</span></div>
            </div>
          )}
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="es-stat-grid" style={{ marginBottom: 16 }}>
            <Stat label="Total Budget" value={show(job.contractExGst)} sub={job.approved ? `${job.reference || "Approved"} approved` : "Projected from the latest estimate"} accent="#1D6EFD" />
            <Stat label="Spent to Date" value={show(ledger.summary.costToDate)} sub={`${pctBurnt}% of budget`} accent="#F59E0B" />
            <Stat label="Remaining" value={show(ledger.summary.remaining)} sub={`${Math.max(0, Math.round((100 - pctBurnt) * 10) / 10)}% left`} accent="#10B981" />
            <Stat label="Claimed" value={show(ledger.summary.claimedToDate)} sub={`${claimedCount} of ${progressRows.length} milestones`} accent="#8B5CF6" />
          </div>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>Budget Breakdown</div>
            <BudgetBar label="Labour" spent={labourSpent} budget={labourBudget} show={show} color="#1D6EFD" />
            <BudgetBar label="Materials" spent={materialsSpent} budget={materialsBudget} show={show} color="#8B5CF6" />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <span>Contingency: {show(contingency)}</span>
              <strong style={{ color: contingency > 0 && contingLeft < contingency * 0.2 ? C.red : C.green }}>Remaining: {show(contingLeft)}</strong>
            </div>
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>Hours Summary</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Stat label="Planned total" value={`${plannedHours}h`} sub="Quoted hours, spread across the weeks" />
              <Stat label="Logged so far" value={`${loggedHours}h`} sub={ledger.weeks.length ? `${ledger.weeks.filter(week => week.start <= asOf).length} weeks in` : "No weeks yet"} />
              <Stat label="Variance" value={`${hoursGap > 0 ? "+" : ""}${hoursGap}h`} accent={hoursGap > 0 ? "#F59E0B" : "#10B981"} sub={hoursGap > 0 ? "Logged hours are over the quote" : "Logged hours are within the quote"} />
            </div>
          </Card>
        </>
      )}
      {tab === "burndown" && (
        <>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Budget Burndown — {job.name || "This job"}</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: C.textMuted }}>
                <LegendSwatch color="#1D6EFD" label="Planned" />
                <LegendSwatch color="#10B981" label="Actual" />
                <LegendSwatch color="#F59E0B" label="Forecast" dashed />
                <LegendSwatch color="#0f172a" label="Claimed / paid" />
                <span>Amber marks are milestones</span>
              </div>
            </div>
            {ledger.weeks.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>No weeks yet. Set a start and end, or add a cost, and the ledger will open.</p>
            ) : (
              <LedgerChart
                weeks={ledger.weeks}
                milestones={milestoneMarks}
                format={amount => show(amount)}
                axis={amount => {
                  const shown = gstMode === "inc" ? incGst(amount) : amount;
                  return shown >= 1000 ? `$${Math.round(shown / 1000)}k` : `$${formatAud(shown)}`;
                }}
                baseline={job.contractExGst}
                today={asOf}
                forecastRemaining={forecastRemaining}
              />
            )}
          </Card>
          <Card style={{ padding: 0, marginBottom: 16, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 14 }}>
              <thead>
                <tr>{["Week", "Period", "Planned Rem.", "Actual Rem.", "Variance"].map(heading => <th key={heading} style={lightHead}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {ledger.weeks.map((week, index) => {
                  const point = remainingAt(week, job.contractExGst, asOf);
                  const gap = point.actual == null ? null : roundCents(point.actual - point.planned);
                  return (
                    <tr key={week.start}>
                      <td style={{ ...cell, color: "#1D6EFD", fontWeight: 700 }}>{index === 0 ? "Start" : `W${index}`}</td>
                      <td style={cell}>{index === 0 ? "Project start" : point.actual == null ? "Forecast" : "Logged"}</td>
                      <td style={cell}>{show(point.planned)}</td>
                      <td style={{ ...cell, color: point.actual == null ? C.textMuted : "#10B981", fontWeight: 600 }}>{point.actual == null ? "—" : show(point.actual)}</td>
                      <td style={{ ...cell, color: gap == null ? C.textMuted : gap < 0 ? "#EF4444" : "#10B981", fontWeight: 700 }}>{gap == null ? "—" : `${gap > 0 ? "+" : "−"}${show(Math.abs(gap))}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card style={{ padding: 0, marginBottom: 16, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, fontSize: 14 }}>
              <thead>
                <tr>{["Week", "Labour", "Supplier", "Other", "Total", "Claims", "Invoices", "Remaining", "Variance"].map(heading => <th key={heading} style={headCell}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {ledger.weeks.map(week => (
                  <React.Fragment key={week.start}>
                    <tr onClick={() => setOpenWeek(current => current === week.start ? null : week.start)} style={{ cursor: "pointer", background: week.ahead ? C.redSoft : undefined }}>
                      <td style={cell}>{week.start}</td>
                      <td style={cell}>{show(week.labour)}</td>
                      <td style={cell}>{show(week.supplier)}</td>
                      <td style={cell}>{show(week.other)}</td>
                      <td style={cell}>{show(week.cost)}</td>
                      <td style={cell}>{show(week.claims)}</td>
                      <td style={cell}>{show(week.invoices)}</td>
                      <td style={cell}>{show(week.remaining)}</td>
                      <td style={cell}>{week.ahead ? "Ahead" : "On plan"} · {show(week.variance)}</td>
                    </tr>
                    {openWeek === week.start && (
                      <tr>
                        <td colSpan={9} style={{ padding: 12, color: C.textMuted }}>
                          {week.items.length === 0 && week.claimItems.length === 0 && "Nothing booked this week."}
                          {week.items.map(item => <div key={item.id}>{item.date} · {item.kind} · {item.roleName || item.supplier || item.note || "Cost"} · {show(item.amount)}{item.reference ? ` · ${item.reference}` : ""}</div>)}
                          {week.claimItems.map(item => <div key={item.id}>{item.label} · {item.kind} · {item.status} · {show(item.amount)}</div>)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {tab === "hours" && (
        <>
          <div className="es-stat-grid" style={{ marginBottom: 16 }}>
            <Stat label="Planned hours" value={`${plannedHours}h`} />
            <Stat label="Logged hours" value={`${loggedHours}h`} />
            <Stat label="Hours left" value={`${Math.max(0, Math.round((plannedHours - loggedHours) * 10) / 10)}h`} />
            <Stat label="Variance" value={`${hoursGap > 0 ? "+" : ""}${hoursGap}h`} tone={hoursGap > 0 ? C.red : C.text} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Weekly timesheet</div>
            <button type="button" onClick={() => setDrawer("timesheet")} style={quietBtn}>Submit timesheet</button>
          </div>
          <Card style={{ padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 14 }}>
              <thead>
                <tr>{["Week", "Planned", "Actual", "Labour", "Supplier", "Variance"].map(heading => <th key={heading} style={headCell}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {ledger.weeks.length === 0 && <tr><td colSpan={6} style={cell}>No weeks yet. Set the job dates, then log a timesheet.</td></tr>}
                {ledger.weeks.map((week, index) => {
                  const hours = weekHours(week.items, plannedHours, ledger.weeks.length, index);
                  const gap = Math.round((hours.actual - hours.planned) * 10) / 10;
                  return (
                    <tr key={week.start}>
                      <td style={cell}>{week.start}</td>
                      <td style={cell}>{hours.planned}h</td>
                      <td style={{ ...cell, color: gap > 0 ? C.red : C.green, fontWeight: 700 }}>{hours.actual}h</td>
                      <td style={cell}>{show(week.labour)}</td>
                      <td style={cell}>{show(week.supplier)}</td>
                      <td style={{ ...cell, color: gap > 0 ? C.red : C.green, fontWeight: 700 }}>{gap > 0 ? "+" : ""}{gap}h</td>
                    </tr>
                  );
                })}
                {ledger.weeks.length > 0 && (
                  <tr>
                    <td style={{ ...cell, fontWeight: 800 }}>Total</td>
                    <td style={{ ...cell, fontWeight: 800 }}>{plannedHours}h</td>
                    <td style={{ ...cell, fontWeight: 800 }}>{loggedHours}h</td>
                    <td style={{ ...cell, fontWeight: 800 }}>{show(labourSpent)}</td>
                      <td style={{ ...cell, fontWeight: 800 }}>{show(roundCents(ledger.weeks.reduce((sum, week) => sum + week.supplier, 0)))}</td>
                    <td style={{ ...cell, fontWeight: 800 }}>{hoursGap > 0 ? "+" : ""}{hoursGap}h</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {tab === "milestones" && (
        <>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12 }}>
            {(["schedule", "claims", "deposit"] as const).map(id => (
              <button key={id} type="button" onClick={() => setPayTab(id)} style={{ ...quietBtn, background: payTab === id ? C.orange : "#fff", color: payTab === id ? "#fff" : C.text }}>
                {id === "schedule" ? "Payment schedule" : id === "claims" ? "Claim status" : "Deposit + splits"}
              </button>
            ))}
          </div>
          {payTab === "schedule" && reportRows.map(row => {
            const tone = row.retention ? C.amber : statusTone(row.status);
            return (
              <Card key={row.id} title={row.retention ? "Held until the defect period ends, usually 3 to 6 months after practical completion." : undefined} style={{ padding: 14, marginBottom: 8, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderLeft: `4px solid ${tone}` }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, border: `3px solid ${tone}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: tone }}>{row.retention ? "Hold" : `${row.pct}%`}</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{row.retention ? "Retention holdback" : row.label}</div>
                  <div style={{ color: C.textMuted, fontSize: 13 }}>
                    {REPORT_STATUS_LABEL[row.status]} · {show(row.amount)}
                    {row.invoiceRef ? ` · ${row.invoiceRef}` : ""}
                    {row.date ? ` · ${row.date}` : ""}
                  </div>
                </div>
                {row.status === "ready" && (
                  <button type="button" onClick={() => void submitClaim(row)} style={{ ...quietBtn, background: C.amber, color: "#fff", borderColor: C.amber }}>Submit claim</button>
                )}
              </Card>
            );
          })}
          {payTab === "claims" && (
            <Card style={{ padding: 16 }}>
              <SummaryLine label="Total contract value" value={show(job.contractExGst)} />
              <SummaryLine label="Deposit received" value={show(depositReceived)} />
              <SummaryLine label="Progress claims invoiced" value={show(progressInvoiced)} />
              <SummaryLine label="Progress claims received" value={show(progressReceived)} />
              <SummaryLine label="Claimed to date" value={show(ledger.summary.claimedToDate)} />
              <SummaryLine label="Unclaimed remaining" value={show(roundCents(job.contractExGst - ledger.summary.claimedToDate))} />
            </Card>
          )}
          {payTab === "deposit" && (
            <>
              {reportRows.map(row => {
                const tone = row.retention ? C.amber : statusTone(row.status);
                return (
                  <Card key={row.id} style={{ padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", borderLeft: `4px solid ${tone}` }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{row.label} ({row.pct}%)</div>
                      <div style={{ color: C.textMuted, fontSize: 13 }}>{row.description}{row.date ? ` · ${row.date}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: tone }}>{show(row.amount)}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: tone }}>{row.retention ? "Retention holdback" : REPORT_STATUS_LABEL[row.status]}</div>
                    </div>
                  </Card>
                );
              })}
              <p style={{ color: C.textMuted, fontSize: 13 }}>The deposit is credited against the contract. Retention is held back from the final payment until the defect period ends.</p>
            </>
          )}
        </>
      )}
      {tab === "overruns" && (
        <>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>Contingency reserve</div>
            <div style={{ height: 12, background: C.bg, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: 12, width: `${contingency > 0 ? Math.max(0, Math.min(100, Math.round((contingLeft / contingency) * 100))) : 0}%`, background: contingLeft < contingency * 0.2 ? C.red : C.amber }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Used: {show(overrunAmount)}</span>
              <span>Remaining: {show(contingLeft)} of {show(contingency)}</span>
            </div>
          </Card>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Flagged cost overruns</div>
          {overrunAmount === 0 && <p style={{ color: C.textMuted }}>No unplanned costs yet. Other costs, and labour or supplier spend above the quote, appear here.</p>}
          {otherSpent > 0 && <OverrunRow label="Other costs" note="Logged outside labour and supplier invoices" amount={show(otherSpent)} />}
          {labourSpent > labourBudget && <OverrunRow label="Labour over quote" note="Timesheets above the quoted labour" amount={show(roundCents(labourSpent - labourBudget))} />}
          {materialsSpent > materialsBudget && <OverrunRow label="Supplier over quote" note="TLE and other supplier invoices above the quoted materials" amount={show(roundCents(materialsSpent - materialsBudget))} />}
        </>
      )}
      {tab === "accounting" && <AccountingConnect />}
      {drawer && (
        <form onSubmit={event => void addCost(event)} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "min(420px, 100%)", background: "#fff", borderLeft: `1px solid ${C.border}`, padding: 20, zIndex: 30, overflow: "auto" }}>
          <h2 style={{ marginTop: 0 }}>{drawer === "timesheet" ? "Timesheet" : drawer === "supplier" ? "Supplier invoice" : "Other cost"}</h2>
          <label style={labelStyle}>Date<input aria-label="Cost date" type="date" value={costDraft.date} onChange={event => setCostDraft(current => ({ ...current, date: event.target.value }))} style={fieldStyle} /></label>
          {drawer === "timesheet" && (
            <>
              <label style={labelStyle}>Role
                <select aria-label="Timesheet role" value={costDraft.roleId} onChange={event => setCostDraft(current => ({ ...current, roleId: event.target.value }))} style={fieldStyle}>
                  <option value="">Default hourly role</option>
                  {(loadLabourCard() || []).filter(role => role.chargeType === "hourly").map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Hours<input aria-label="Timesheet hours" inputMode="decimal" value={costDraft.hours} onChange={event => setCostDraft(current => ({ ...current, hours: event.target.value }))} style={fieldStyle} /></label>
              <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>
                Priced from the labour rate card
                {(() => {
                  const card = loadLabourCard() || [];
                  const role = card.find(item => item.id === costDraft.roleId) || defaultHourlyRole(card);
                  const amount = priceTimesheet(Number(costDraft.hours) || 0, role, labourRate);
                  return role ? ` · ${role.name} · ${show(amount)}` : ` · ${show(amount)}`;
                })()}
              </p>
            </>
          )}
          {drawer === "supplier" && (
            <>
              <label style={labelStyle}>Supplier<input aria-label="Supplier name" value={costDraft.supplier} onChange={event => setCostDraft(current => ({ ...current, supplier: event.target.value }))} style={fieldStyle} /></label>
              <label style={labelStyle}>Reference<input aria-label="Invoice reference" value={costDraft.reference} onChange={event => setCostDraft(current => ({ ...current, reference: event.target.value }))} style={fieldStyle} /></label>
            </>
          )}
          {drawer !== "timesheet" && <label style={labelStyle}>Amount ex GST<input aria-label="Cost amount" inputMode="decimal" value={costDraft.amount} onChange={event => setCostDraft(current => ({ ...current, amount: event.target.value }))} style={fieldStyle} /></label>}
          <label style={labelStyle}>Note<input aria-label="Cost note" value={costDraft.note} onChange={event => setCostDraft(current => ({ ...current, note: event.target.value }))} style={fieldStyle} /></label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <PrimaryButton type="submit">Save cost</PrimaryButton>
            <button type="button" onClick={() => setDrawer(null)} style={quietBtn}>Cancel</button>
          </div>
        </form>
      )}
      <Footer />
    </div>
  );
}

function BudgetBar({ label, spent, budget, show, color }: { label: string; spent: number; budget: number; show: (amount: number) => string; color: string }) {
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ color: C.textMuted }}>{show(spent)} / {show(budget)} · {pct}%</span>
      </div>
      <div style={{ height: 10, background: C.bg, borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: 10, width: `${pct}%`, background: spent > budget ? C.red : color, borderRadius: 5 }} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone, sub, accent }: { label: string; value: string; tone?: string; sub?: string; accent?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", borderTop: accent ? `3px solid ${accent}` : undefined }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: accent || tone || C.text }}>{value}</div>
      {sub && <div style={{ marginTop: 3, fontSize: 11, color: "#64748B" }}>{sub}</div>}
    </div>
  );
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 16, height: dashed ? 0 : 3, borderTop: dashed ? `2px dashed ${color}` : undefined, background: dashed ? undefined : color, borderRadius: 2 }} />
      {label}
    </span>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OverrunRow({ label, note, amount }: { label: string; note: string; amount: string }) {
  return (
    <Card style={{ padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderLeft: `4px solid ${C.red}` }}>
      <div>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div style={{ color: C.textMuted, fontSize: 13 }}>{note}</div>
      </div>
      <strong style={{ color: C.red }}>{amount}</strong>
    </Card>
  );
}

function statusTone(status: ReportClaimStatus): string {
  if (status === "received") return C.green;
  if (status === "ready") return C.amber;
  if (status === "invoiced" || status === "invoiced-draft") return C.orange;
  return C.textMuted;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

function costFromRow(row: { id?: string; spent_on?: string; kind?: string; amount?: number; hours?: number; role_name?: string | null; supplier?: string | null; reference?: string | null; note?: string | null }): LedgerCost {
  const kind = row.kind === "timesheet" || row.kind === "supplier" || row.kind === "other" ? row.kind : "other";
  return {
    id: row.id || `${row.spent_on}-cost`,
    date: String(row.spent_on || "").slice(0, 10),
    kind,
    amount: Number(row.amount) || 0,
    hours: Number(row.hours) || undefined,
    roleName: row.role_name || undefined,
    supplier: row.supplier || undefined,
    reference: row.reference || undefined,
    note: row.note || undefined,
  };
}

function fromRow(row: { id?: string; job_id?: string; spent_on?: string; materials?: number; labour_hours?: number; labour_cost?: number; note?: string | null }): ActualEntry {
  return {
    id: row.id,
    jobId: row.job_id || "",
    date: String(row.spent_on || "").slice(0, 10),
    materials: Number(row.materials) || 0,
    labourHours: Number(row.labour_hours) || 0,
    labourCost: Number(row.labour_cost) || 0,
    note: row.note || "",
  };
}

const quietBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: "#fff",
  color: C.text,
  fontWeight: 700,
  textDecoration: "none",
};
const cell: React.CSSProperties = { padding: 10, borderTop: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const headCell: React.CSSProperties = { textAlign: "left", padding: 10, background: C.ink, color: "#fff" };
const lightHead: React.CSSProperties = { textAlign: "left", padding: "8px 14px", background: "#F8FAFC", color: "#94A3B8", fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" };
const outlineBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  background: "#fff",
  color: C.text,
  fontWeight: 700,
  fontSize: 12,
};
const tabBtn: React.CSSProperties = {
  flexShrink: 0,
  minHeight: 44,
  padding: "8px 14px",
  border: "none",
  borderBottom: "2px solid transparent",
  background: "transparent",
  fontWeight: 700,
  marginBottom: -2,
  cursor: "pointer",
};
const burndownTab: React.CSSProperties = {
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
const labelStyle: React.CSSProperties = { fontSize: 13, color: C.textMuted };
const fieldStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 10px",
  fontSize: 16,
  background: C.bg,
  color: C.text,
};
