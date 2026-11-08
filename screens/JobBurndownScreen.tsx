import React, { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
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
import QueryBanner from "../components/QueryBanner";
import { burnPercent, milestoneWeekIndex, paymentSchedule, spendAheadWarning, type ActualEntry } from "../lib/burndown";
import { formatAud, roundCents } from "../lib/quoteTotals";

interface Schedule {
  start: string;
  end: string;
}

export default function JobBurndownScreen() {
  const params = useParams();
  const jobId = decodeURIComponent(params.jobKey || "");
  const embedded = Boolean(useOutletContext<{ embedded?: boolean } | undefined>()?.embedded);
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const assemblies = loadAssemblies();
  const labourRate = loadLabourRate();
  const [entries, setEntries] = useState<ActualEntry[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({ start: "", end: "" });
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const [claims, setClaims] = useState<Array<{ milestone_id?: string; status?: string }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id?: string; source_ref?: string | null; job_name?: string | null }>>([]);
  const [costs, setCosts] = useState<LedgerCost[]>([]);
  const [drawer, setDrawer] = useState<CostKind | null>(null);
  const [gstMode, setGstMode] = useState<"ex" | "inc">("ex");
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [tab, setTab] = useState<"burn" | "burndown" | "hours" | "milestones">("burndown");
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
        if (!cancelled) setClaims((data as Array<{ milestone_id?: string; status?: string }> | null) ?? []);
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
  const supplierSpent = roundCents(ledger.weeks.reduce((sum, week) => sum + week.supplier + week.other, 0));
  const labourBudget = job.labourDollars > 0 ? job.labourDollars : job.contractExGst;
  const supplierBudget = job.labourDollars > 0 ? Math.max(0, roundCents(job.contractExGst - job.labourDollars)) : 0;
  const plannedHours = Math.round(job.hours * 10) / 10;
  const loggedHours = Math.round(ledger.weeks.reduce((sum, week) => sum + weekHours(week.items, plannedHours, ledger.weeks.length).actual, 0) * 10) / 10;
  const hoursGap = Math.round((loggedHours - plannedHours) * 10) / 10;
  const burnNote = spendAheadWarning(burnPercent(ledger.summary.costToDate, job.contractExGst), claimEvents.map(row => ({
    pct: scheduled.find(item => item.id === row.id)?.pct || 0,
    status: row.status === "paid" || row.status === "invoiced" ? "invoiced" as const : "not_due" as const,
  })));
  const milestoneMarks = claimEvents.map(row => ({
    label: row.label,
    amount: gstMode === "inc" ? incGst(row.amount) : row.amount,
    status: row.status,
    weekIndex: Math.max(0, ledger.weeks.findIndex(week => week.start === row.date)),
  }));

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
        <Link to="/projects" style={quietBtn}>Milestones</Link>
        <button type="button" onClick={exportLedger} style={quietBtn}>Export Excel</button>
      </div>
      <form onSubmit={saveDates} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>Start<input aria-label="Job start" type="date" value={schedule.start} onChange={event => setSchedule(current => ({ ...current, start: event.target.value }))} style={fieldStyle} /></label>
        <label style={labelStyle}>End<input aria-label="Job end" type="date" value={schedule.end} onChange={event => setSchedule(current => ({ ...current, end: event.target.value }))} style={fieldStyle} /></label>
        <PrimaryButton type="submit">Save dates</PrimaryButton>
      </form>
      <div role="tablist" aria-label="Job reports" style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: `2px solid ${C.border}`, marginBottom: 16 }}>
        {([
          ["burn", "Budget burn"],
          ["burndown", "Burndown"],
          ["hours", "Hours"],
          ["milestones", "Milestones"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...tabBtn, color: tab === id ? C.orange : C.textMuted, borderBottomColor: tab === id ? C.orange : "transparent" }}>{label}</button>
        ))}
      </div>
      {burnNote && <p role="status" style={{ color: C.ink, background: C.amberSoft, borderRadius: 12, padding: "12px 14px" }}>{burnNote}</p>}
      {tab === "burn" && (
        <>
          <div className="es-stat-grid" style={{ marginBottom: 16 }}>
            <Stat label={job.approved ? "Approved value" : "Projected value"} value={show(job.contractExGst)} />
            <Stat label="Cost to date" value={show(ledger.summary.costToDate)} />
            <Stat label="Remaining" value={show(ledger.summary.remaining)} tone={ledger.summary.remaining < 0 ? C.red : C.text} />
            <Stat label="Claimed to date" value={show(ledger.summary.claimedToDate)} />
            <Stat label="Paid to date" value={show(ledger.summary.paidToDate)} />
            <Stat label="Margin to date" value={`${ledger.summary.marginToDatePct}%`} />
            <Stat label="Forecast at completion" value={show(ledger.summary.forecastAtCompletion)} />
          </div>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 12 }}>Budget breakdown</div>
            <BudgetBar label="Labour" spent={labourSpent} budget={labourBudget} show={show} color={C.orange} />
            {supplierBudget > 0 && <BudgetBar label="Supplier and other" spent={supplierSpent} budget={supplierBudget} show={show} color="#0f172a" />}
          </Card>
          <div className="es-stat-grid">
            <Stat label="Planned hours" value={`${plannedHours}h`} />
            <Stat label="Logged hours" value={`${loggedHours}h`} />
            <Stat label="Hours variance" value={`${hoursGap > 0 ? "+" : ""}${hoursGap}h`} tone={hoursGap > 0 ? C.red : C.text} />
          </div>
        </>
      )}
      {tab === "burndown" && (
        <>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Budget burndown</div>
            {ledger.weeks.length === 0 ? (
              <p style={{ margin: 0, color: C.textMuted }}>No weeks yet. Set a start and end, or add a cost, and the ledger will open.</p>
            ) : (
              <LedgerChart
                weeks={ledger.weeks}
                milestones={milestoneMarks}
                format={amount => show(amount)}
                axis={amount => `$${formatAud(gstMode === "inc" ? incGst(amount) : amount)}`}
                baseline={job.contractExGst}
                today={asOf}
                forecastRemaining={forecastRemaining}
              />
            )}
          </Card>
          <Card style={{ padding: 0, marginBottom: 16, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, fontSize: 14 }}>
              <thead>
                <tr>{["Week", "Period", "Planned remaining", "Actual remaining", "Variance"].map(heading => <th key={heading} style={headCell}>{heading}</th>)}</tr>
              </thead>
              <tbody>
                {ledger.weeks.map((week, index) => {
                  const point = remainingAt(week, job.contractExGst, asOf);
                  const gap = point.actual == null ? null : roundCents(point.actual - point.planned);
                  return (
                    <tr key={week.start}>
                      <td style={cell}>{index === 0 ? "Start" : `W${index}`} · {week.start}</td>
                      <td style={cell}>{point.actual == null ? "Forecast" : "Logged"}</td>
                      <td style={cell}>{show(point.planned)}</td>
                      <td style={cell}>{point.actual == null ? "—" : show(point.actual)}</td>
                      <td style={{ ...cell, color: gap == null ? C.textMuted : gap < 0 ? C.red : C.green, fontWeight: 700 }}>{gap == null ? "—" : `${gap < 0 ? "Ahead " : "Under "}${show(Math.abs(gap))}`}</td>
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
            <button type="button" onClick={() => setDrawer("timesheet")} style={quietBtn}>Add timesheet</button>
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Payment schedule</div>
            <Link to="/projects" style={quietBtn}>Open milestones</Link>
          </div>
          {scheduled.map(row => {
            const claim = claimEvents.find(item => item.id === row.id);
            const status = claim?.status || "unpaid";
            const tone = status === "paid" ? C.green : status === "invoiced" ? C.orange : C.textMuted;
            return (
              <Card key={row.id} style={{ padding: 14, marginBottom: 8, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, border: `3px solid ${tone}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: tone }}>{row.pct}%</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{row.label}</div>
                  <div style={{ color: C.textMuted, fontSize: 13 }}>{row.description} · {show(row.amount)} · {status}{claim?.date ? ` · ${claim.date}` : ""}</div>
                </div>
              </Card>
            );
          })}
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Contract</span><strong>{show(job.contractExGst)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Claimed</span><strong>{show(ledger.summary.claimedToDate)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span>Unclaimed</span><strong>{show(roundCents(job.contractExGst - ledger.summary.claimedToDate))}</strong></div>
          </Card>
        </>
      )}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bgCard }}>
      <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: tone || C.text }}>{value}</div>
    </div>
  );
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
