import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { GhostButton, PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchMilestoneClaimsForProject, fetchScans } from "../services/supabaseData";
import { loadAssemblies, loadLabourRate } from "../lib/assemblies";
import { priceItem } from "../lib/quoteSource";
import { defaultHourlyRole, loadLabourCard } from "../lib/labourRates";
import { readDetectedItems } from "../lib/scanRecord";
import { jobKey } from "../lib/jobTracker";
import { marginForQuote } from "../lib/margin";
import { approvalFromRow } from "../lib/approvalStatus";
import { formatQuotedValue } from "../lib/estimateMoney";
import BurndownChart from "../components/desktop/BurndownChart";
import QueryBanner from "../components/QueryBanner";
import {
  burnPercent,
  burnTone,
  burndownWeeks,
  milestoneStatus,
  milestoneWeekIndex,
  paymentSchedule,
  quoteContract,
  spendAheadWarning,
  sumActuals,
  type ActualEntry,
  type BurndownMilestone,
} from "../lib/burndown";

interface Schedule {
  start: string;
  end: string;
}

export default function JobBurndownScreen() {
  const params = useParams();
  const jobId = decodeURIComponent(params.jobKey || "");
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: estimates, loading: estimatesLoading } = useSupabaseQuery(fetchEstimates);
  const assemblies = loadAssemblies();
  const labourRate = loadLabourRate();
  const [entries, setEntries] = useState<ActualEntry[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({ start: "", end: "" });
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const [claims, setClaims] = useState<Array<{ milestone_id?: string; status?: string }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id?: string; source_ref?: string | null; job_name?: string | null }>>([]);
  const [form, setForm] = useState({ date: today(), materials: "", hours: "", cost: "", note: "" });
  const [saving, setSaving] = useState(false);

  const job = useMemo(() => {
    const matched = (scans as Array<{ id?: string; client?: string | null; file_name?: string; detected_items?: unknown }>).filter(scan => jobKey(scan.client, scan.file_name) === jobId);
    const estimate = (estimates as Array<{ client?: string | null; project_name?: string | null; reference?: string | null; ref?: string | null; margin_pct?: number | null; status?: string | null; approval_status?: string | null; value?: number | null }>).find(row => jobKey(row.client, row.project_name) === jobId);
    let sell = 0;
    let hours = 0;
    let labourDollars = 0;
    for (const scan of matched) {
      for (const item of readDetectedItems(scan.detected_items)) {
        if (item.status === "rejected" || item.qty <= 0) continue;
        const quote = priceItem(item, [], assemblies, labourRate, [], loadLabourCard());
        sell += item.qty * quote.sellUnit;
        hours += item.qty * quote.labourHours;
        labourDollars += item.qty * quote.labourUnit;
      }
    }
    const margin = marginForQuote(estimate?.margin_pct);
    const contract = quoteContract(sell, margin);
    const approved = estimate ? ["approved", "materials_sent"].includes(approvalFromRow(estimate)) : false;
    return {
      name: estimate?.client || matched[0]?.client || matched[0]?.file_name || jobId,
      reference: estimate?.reference || estimate?.ref || "",
      approved,
      sell,
      hours,
      labourDollars,
      margin,
      contract: contract.total,
      scanId: matched[0]?.id,
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

  const totals = sumActuals(entries);
  const weeks = schedule.start && schedule.end
    ? burndownWeeks({ contract: job.contract, plannedHours: job.hours, start: schedule.start, end: schedule.end, actuals: entries })
    : [];
  const milestones: BurndownMilestone[] = paymentSchedule(job.contract).map((row, index) => {
    const invoice = invoices.find(item => item.source_ref === row.id && (!item.job_name || item.job_name === job.name));
    const claim = claims.find(item => item.milestone_id === row.id);
    return {
      ...row,
      invoiceId: invoice?.id || null,
      status: milestoneStatus({
        index,
        count: 6,
        weeks,
        invoiced: Boolean(invoice) || claim?.status === "invoiced_draft",
        paid: claim?.status === "received",
      }),
    };
  });
  const burn = burnPercent(totals.cost, job.contract);
  const tone = burnTone(burn);
  const warning = spendAheadWarning(burn, milestones);
  const remaining = Math.round((job.contract - totals.cost) * 100) / 100;

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

  async function logActual(event: React.FormEvent) {
    event.preventDefault();
    const materials = Math.max(0, Number(form.materials) || 0);
    const labourHours = Math.max(0, Number(form.hours) || 0);
    const roleRate = defaultHourlyRole(loadLabourCard() || [])?.rate;
    const labourCost = Math.max(0, Number(form.cost) || labourHours * (roleRate || labourRate));
    if (!form.date || (materials === 0 && labourHours === 0 && labourCost === 0)) return;
    const entry: ActualEntry = {
      id: `local-${Date.now()}`,
      jobId,
      date: form.date,
      materials,
      labourHours,
      labourCost,
      note: form.note.trim(),
    };
    const next = [...entries, entry].sort((a, b) => a.date.localeCompare(b.date));
    setEntries(next);
    writeJson(`es-job-actuals:${jobId}`, next);
    setSaving(true);
    const res = await fetch("/api/beta/records?kind=actuals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: jobId,
        spent_on: entry.date,
        materials,
        labour_hours: labourHours,
        labour_cost: labourCost,
        note: entry.note,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => ({})) : {};
      setMigrationNote(body.error || "The entry is kept in this browser.");
    }
    const summed = sumActuals(next);
    await fetch("/api/beta/records?kind=jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_key: jobId,
        name: job.name,
        stage: "in_progress",
        quoted_sell: job.sell,
        actual_materials: summed.materials,
        actual_hours: summed.hours,
        labour_rate: labourRate,
      }),
    }).catch(() => undefined);
    setForm({ date: today(), materials: "", hours: "", cost: "", note: "" });
  }

  if (!loading && !estimatesLoading && !job.approved) {
    return (
      <div className="anim-in">
        <PageHeader crumb="Jobs" title="Burndown" sub="An approved quote is the budget for this view." />
        <EmptyState
          title="No approved quote for this job"
          body="Approve the estimate first. The burndown uses that quote, not a sample budget."
          ctaLabel="Back to jobs"
          onCta={() => { window.location.assign("/jobs"); }}
        />
        <Footer />
      </div>
    );
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={loading || estimatesLoading} error={error} noun="the job" />
      <PageHeader
        crumb="Jobs"
        title={job.name || "Job burndown"}
        sub={[job.reference, `${job.margin}% margin from the quote`].filter(Boolean).join(" · ")}
        cta={<span className="es-approved-badge">Approved</span>}
      />
      <p style={{ marginTop: 0 }}>
        <Link to="/jobs">All jobs</Link>
        {job.reference ? <> · <Link to="/approvals">Approved quote {job.reference}</Link></> : null}
        {job.scanId ? <> · <Link to={`/detection/${job.scanId}`}>Takeoff</Link></> : null}
      </p>
      {migrationNote && (
        <p style={{ color: C.amber, background: C.amberSoft, borderRadius: 12, padding: "10px 12px" }}>{migrationNote}</p>
      )}

      <div className="es-stat-grid" style={{ marginBottom: 16 }}>
        <Stat label="Budget burn" value={`${burn}%`} tone={tone === "red" ? C.red : tone === "amber" ? C.amber : C.green} />
        <Stat label="Quoted contract" value={formatQuotedValue(job.contract)} />
        <Stat label="Spent" value={formatQuotedValue(totals.cost)} />
        <Stat label="Remaining" value={formatQuotedValue(remaining)} />
      </div>
      {warning && (
        <p style={{ color: C.red, fontWeight: 700, background: C.redSoft, borderRadius: 12, padding: "10px 12px" }}>{warning}</p>
      )}

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Job dates</h2>
        <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
          The planned line spreads the quoted sell and labour hours from these dates. Nothing is assumed before you set them.
        </p>
        <form onSubmit={saveDates} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <label style={labelStyle}>Start
            <input aria-label="Job start" type="date" value={schedule.start} onChange={event => setSchedule(current => ({ ...current, start: event.target.value }))} style={fieldStyle} />
          </label>
          <label style={labelStyle}>End
            <input aria-label="Job end" type="date" value={schedule.end} onChange={event => setSchedule(current => ({ ...current, end: event.target.value }))} style={fieldStyle} />
          </label>
          <PrimaryButton type="submit">Save dates</PrimaryButton>
        </form>
      </Card>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Budget burndown</h2>
        <BurndownChart weeks={weeks} plannedKey="plannedSpend" actualKey="actualSpend" max={Math.max(job.contract, totals.cost, 1)} format={value => formatQuotedValue(value)} />
      </Card>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Hours</h2>
        <p style={{ margin: "0 0 8px", color: C.textMuted, fontSize: 14 }}>
          Planned hours are the labour hours on the quoted assemblies ({Math.round(job.hours * 10) / 10} h). Planned labour cost is {formatQuotedValue(job.labourDollars)} ex GST at the same rates. Actual hours come from the log.
        </p>
        <BurndownChart weeks={weeks} plannedKey="plannedHours" actualKey="actualHours" max={Math.max(job.hours, totals.hours, 1)} format={value => `${Math.round(value)} h`} />
      </Card>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Payment milestones</h2>
        {milestones.map((milestone, index) => (
          <div key={milestone.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontWeight: 700 }}>{milestone.label}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                {milestone.description} · week {weeks.length ? milestoneWeekIndex(index, milestones.length, weeks.length) + 1 : "—"} · {statusLabel(milestone.status)}
              </div>
            </div>
            <div style={{ fontFamily: FONT.mono, fontWeight: 700 }}>
              {formatQuotedValue(milestone.amount)} · {milestone.pct}%
              {milestone.invoiceId ? <> · <Link to="/projects">Draft invoice</Link></> : null}
            </div>
          </div>
        ))}
      </Card>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Log actuals</h2>
        <p style={{ margin: "0 0 12px", color: C.textMuted, fontSize: 14 }}>
          Each entry is dated. The totals above are the sum of this log, not a single overwritten figure.
        </p>
        <form onSubmit={event => void logActual(event)} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input aria-label="Actual date" type="date" value={form.date} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} style={fieldStyle} />
          <input aria-label="Materials cost" inputMode="decimal" placeholder="Materials" value={form.materials} onChange={event => setForm(current => ({ ...current, materials: event.target.value }))} style={fieldStyle} />
          <input aria-label="Labour hours" inputMode="decimal" placeholder="Hours" value={form.hours} onChange={event => setForm(current => ({ ...current, hours: event.target.value }))} style={fieldStyle} />
          <input aria-label="Labour cost" inputMode="decimal" placeholder="Labour cost" value={form.cost} onChange={event => setForm(current => ({ ...current, cost: event.target.value }))} style={fieldStyle} />
          <input aria-label="Actual note" placeholder="Note" value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} style={{ ...fieldStyle, minWidth: 180 }} />
          <GhostButton type="submit" disabled={saving}>{saving ? "Saving…" : "Add entry"}</GhostButton>
        </form>
        {entries.length === 0 && <p style={{ color: C.textMuted }}>No actuals logged yet.</p>}
        {entries.map(entry => (
          <div key={entry.id || `${entry.date}-${entry.note}`} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, fontSize: 14 }}>
            {entry.date} · materials {formatQuotedValue(entry.materials)} · {entry.labourHours} h · labour {formatQuotedValue(entry.labourCost)}
            {entry.note ? ` · ${entry.note}` : ""}
          </div>
        ))}
      </Card>
      <Footer />
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

function statusLabel(status: BurndownMilestone["status"]): string {
  if (status === "not_due") return "Not due";
  if (status === "due") return "Due";
  if (status === "invoiced") return "Invoiced";
  return "Paid";
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
