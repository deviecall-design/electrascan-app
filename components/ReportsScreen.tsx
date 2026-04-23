import { useMemo, useState } from "react";
import { submitTimesheet, submitMilestoneClaim } from "../services/reportsService";

// ─── Design tokens (mirror App.tsx) ──────────────
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
  purple: "#7C3AED", teal:   "#0EA5E9",
};

// ─── Props ────────────────────────────────────────
export interface ReportsScreenProps {
  projectName?: string;
  onBack: () => void;
}

// ─── Mock data (matching prototype) ───────────────
const B = {
  total: 36480, labour: 21888, materials: 14592,
  spentLabour: 8640, spentMaterials: 5200,
  contingency: 1800,
};

const WEEKS      = ["Start","W1","W2","W3","W4","W5","W6","W7","W8"];
const PLAN       = [36480,32800,29200,25600,22000,18400,14800,11200,7600];
const ACTUAL     = [36480,33200,29600,26100,22640];

interface HoursRow { week: string; planned: number; actual: number; labour: number; materials: number }
const HOURS: HoursRow[] = [
  { week: "Week 1 · 10 Mar", planned: 40, actual: 38, labour: 3280, materials: 890  },
  { week: "Week 2 · 17 Mar", planned: 40, actual: 42, labour: 3600, materials: 980  },
  { week: "Week 3 · 24 Mar", planned: 40, actual: 38, labour: 3200, materials: 810  },
  { week: "Week 4 · 31 Mar", planned: 40, actual: 30, labour: 2560, materials: 640  },
];

// Milestone status per Section 9.1 — Pending | Ready to Claim | Invoiced (Draft) | Invoiced | Received
interface MilestoneRow {
  label: string;
  pct: number;
  amount: number;
  status: "pending"|"ready"|"invoiced-draft"|"invoiced"|"received";
  claimDate: string|null;
  invoiceRef?: string;
  warning: boolean;
  retention?: boolean;
}
const MILESTONES_SEED: MilestoneRow[] = [
  { label: "Rough-in Complete",    pct: 25,  amount: 9120, status: "invoiced", claimDate: "17 Mar 2026", invoiceRef: "INV-2026-012", warning: false },
  { label: "First Fix Complete",   pct: 50,  amount: 9120, status: "ready",    claimDate: null,          warning: true  },
  { label: "Second Fix Complete",  pct: 75,  amount: 9120, status: "pending",  claimDate: null,          warning: false },
  { label: "Practical Completion", pct: 100, amount: 9120, status: "pending",  claimDate: null,          warning: false },
  { label: "Retention Holdback",   pct: 100, amount: 1824, status: "pending",  claimDate: null,          warning: false, retention: true },
];

interface OverrunRow { item: string; cat: string; amount: number; severity: "high"|"medium"|"low"; note: string }
const OVERRUNS: OverrunRow[] = [
  { item: "Copper cable surcharge", cat: "Materials", amount: 420, severity: "high",   note: "Spot market +8.2% since estimate locked" },
  { item: "Fuel & transport",       cat: "Labour",    amount: 180, severity: "medium", note: "4 additional site visits beyond scope"    },
  { item: "Insurance premium rise", cat: "Admin",     amount: 250, severity: "low",    note: "Annual policy renewal — 6.4% increase"   },
];

// Deposit/Splits rows — status values aligned with Section 9.1 terminology
type DepositStatus = "received" | "invoiced" | "pending";
interface DepositRow {
  label: string;
  pct: number;
  amount: number;
  status: DepositStatus;
  date: string | null;
  note: string;
  icon: string;
  retention?: boolean;
  tooltip?: string;
}
const DEPOSIT_ROWS: DepositRow[] = [
  { label: "Deposit on Signing",       pct: 10, amount: 3648, status: "received", date: "10 Mar 2026", note: "Paid on commencement",                    icon: "✅" },
  { label: "Rough-in Milestone (25%)", pct: 25, amount: 9120, status: "invoiced", date: "17 Mar 2026", note: "Invoice #INV-2026-012",                    icon: "📄" },
  { label: "First Fix Milestone (50%)",pct: 25, amount: 9120, status: "pending",  date: null,          note: "Pending milestone sign-off",               icon: "⏳" },
  { label: "Second Fix (75%)",         pct: 25, amount: 9120, status: "pending",  date: null,          note: "",                                         icon: "⏳" },
  {
    label: "Retention Release",
    pct: 5, amount: 1824, status: "pending", date: null,
    note: "Held until defect period ends",
    icon: "⏳",
    retention: true,
    tooltip: "Held until defect liability period ends. Typically 3–6 months post Practical Completion.",
  },
];

const RISK_FACTORS = [
  { factor: "Copper spot price",      trend: "↑ +8.2%",  impact: "High"  as const, note: "LME copper at 5-yr high. Cable costs affected." },
  { factor: "Fuel / logistics",       trend: "↑ +4.1%",  impact: "Med"   as const, note: "Diesel surcharge applied by suppliers."          },
  { factor: "Interest rates",         trend: "↓ -0.25%", impact: "Low"   as const, note: "RBA cut May 2026. Minimal project impact."       },
  { factor: "Insurance premiums",     trend: "↑ +6.4%",  impact: "Low"   as const, note: "Annual renewal — passed through as admin cost."  },
  { factor: "General inflation (CPI)",trend: "2.8%",     impact: "Watch" as const, note: "Monitor for second fix phases."                  },
];

const ACCOUNTING_PLATFORMS = [
  { id: "myob",       name: "MYOB",      logo: "🟦", color: "#7B2FBE", desc: "MYOB Business · AccountRight",     features: ["Invoices","Timesheets","Job Costing","BAS"] },
  { id: "xero",       name: "Xero",      logo: "💙", color: "#13B5EA", desc: "Xero Accounting · Projects module", features: ["Invoices","Quotes","Expenses","Payroll"]     },
  { id: "quickbooks", name: "QuickBooks", logo: "🟩", color: "#2CA01C", desc: "QuickBooks Online · Advanced",      features: ["Invoices","Time tracking","Job costing","GST"]},
];

const SYNC_MAPPINGS = [
  ["📄","Approved estimates → Quotes"],
  ["🧾","Progress claims → Invoices"],
  ["⏱️","Weekly timesheets → Time entries"],
  ["💰","Milestone payments → Receipts"],
  ["📦","Materials costs → Expense claims"],
  ["👷","Labour hours → Payroll entries"],
];

type TabId = "overview" | "burndown" | "hours" | "milestones" | "overruns" | "accounting";
const TABS: [TabId, string][] = [
  ["overview",   "📊 Overview"],
  ["burndown",   "📉 Burndown"],
  ["hours",      "⏱ Hours"],
  ["milestones", "🚩 Milestones"],
  ["overruns",   "⚠️ Overruns"],
  ["accounting", "🔗 Accounting"],
];

// ─── Helpers ──────────────────────────────────────
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const sevColor: Record<string, string> = { high: C.red, medium: C.amber, low: C.muted };

// Section 9.1 — standardised status labels + colours (used for milestones & deposits)
const STATUS_COLOR: Record<string, string> = {
  "pending":        C.muted,
  "ready":          C.amber,
  "invoiced-draft": C.blue,
  "invoiced":       C.blue,
  "received":       C.green,
};
const STATUS_LABEL: Record<string, string> = {
  "pending":        "Pending",
  "ready":          "Ready to Claim",
  "invoiced-draft": "Invoiced (Draft)",
  "invoiced":       "Invoiced",
  "received":       "Received",
};

// ─── Component ────────────────────────────────────
export default function ReportsScreen({
  projectName = "Riverside Apartments",
  onBack,
}: ReportsScreenProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [payTab, setPayTab] = useState<"schedule"|"claims"|"deposit">("schedule");
  const [milestones, setMilestones] = useState<MilestoneRow[]>(MILESTONES_SEED);
  const [syncState, setSyncState] = useState<Record<string, "idle"|"connecting"|"connected">>({ myob: "connected", xero: "idle", quickbooks: "idle" });
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<"idle"|"ok"|"local">("idle");

  const totalSpent   = B.spentLabour + B.spentMaterials;
  const remaining    = B.total - totalSpent;
  const pctBurnt     = (totalSpent / B.total * 100).toFixed(1);
  const labourPct    = Math.round(B.spentLabour / B.labour * 100);
  const matPct       = Math.round(B.spentMaterials / B.materials * 100);
  const totalOverrun = OVERRUNS.reduce((s, o) => s + o.amount, 0);
  const contingLeft  = B.contingency - totalOverrun;
  const totalPlanned = HOURS.reduce((s, h) => s + h.planned, 0);
  const totalActual  = HOURS.reduce((s, h) => s + h.actual, 0);
  const claimed                 = milestones.filter(m => m.status === "invoiced" || m.status === "invoiced-draft" || m.status === "received").reduce((s, m) => s + m.amount, 0);
  const progressClaimsInvoiced  = milestones.filter(m => (m.status === "invoiced" || m.status === "invoiced-draft") && !m.retention).reduce((s, m) => s + m.amount, 0);
  const progressClaimsReceived  = milestones.filter(m => m.status === "received" && !m.retention).reduce((s, m) => s + m.amount, 0);
  const depositRow              = DEPOSIT_ROWS[0];
  const depositReceived         = depositRow.status === "received" ? depositRow.amount : 0;
  const depositInvoiceRef       = milestones.find(m => m.status === "invoiced" && !m.retention)?.invoiceRef ?? "";
  const totalReceivedToDate     = depositReceived + progressClaimsReceived;
  const outstanding             = B.total - totalReceivedToDate;

  // SVG burndown
  const CW = 420, CH = 120, steps = WEEKS.length - 1;
  const xFor = (i: number) => Math.round((i / steps) * CW);
  const yFor = (v: number) => Math.round(CH - (v / B.total) * CH);
  const planPath = PLAN.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
  const actPath  = ACTUAL.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
  const planArea = planPath + ` L${CW},${CH} L0,${CH} Z`;
  const actArea  = actPath  + ` L${xFor(ACTUAL.length - 1)},${CH} L0,${CH} Z`;

  const handleSync = (sys: string) => {
    setSyncing(sys);
    window.setTimeout(() => { setSyncing(null); setSyncState(p => ({ ...p, [sys]: "connected" })); }, 2200);
  };

  const claimMilestone = async (idx: number) => {
    const m = milestones[idx];
    // Per Section 9.2: Submit Claim transitions Ready → Invoiced (Draft), pending finance approval in MYOB.
    setMilestones(prev => prev.map((x, i) => i === idx ? { ...x, status: "invoiced-draft" as const, claimDate: new Date().toLocaleDateString("en-AU"), warning: false } : x));
    const res = await submitMilestoneClaim({ projectName, milestone: m.label, amount: m.amount });
    setSyncMsg(res.ok ? "ok" : "local");
    window.setTimeout(() => setSyncMsg("idle"), 1800);
  };

  const handleSubmitTimesheet = async () => {
    const last = HOURS[HOURS.length - 1];
    const res = await submitTimesheet({ projectName, week: last.week, planned: last.planned, actual: last.actual, labour: last.labour, materials: last.materials });
    setSyncMsg(res.ok ? "ok" : "local");
    window.setTimeout(() => setSyncMsg("idle"), 1800);
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, background: C.card, color: C.blueLt, padding: "3px 9px", borderRadius: 20, letterSpacing: "1px" }}>🔒 INTERNAL ONLY</span>
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Project Reports</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{projectName}</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 96px" }}>
        {/* Alert banners */}
        <AlertBanner color={C.amber} icon="⚠️" title="50% Milestone Warning" body={`Budget is ${pctBurnt}% burnt. First Fix milestone not yet reached. Finance team notified.`} />
        <AlertBanner color={C.red} icon="🔺" title="Overrun Alert" body={`${fmt(totalOverrun)} in unplanned costs detected (copper, fuel, insurance). ${fmt(contingLeft)} contingency remaining.`} />

        {/* Tab bar */}
        <div className="filter-tabs" style={{ marginBottom: 14 }}>
          {TABS.map(([id, lbl]) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                flexShrink: 0, background: active ? `${C.blue}22` : C.card,
                border: `1px solid ${active ? C.blue : C.border}`, color: active ? C.blueLt : C.muted,
                fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
              }}>{lbl}</button>
            );
          })}
        </div>

        {syncMsg !== "idle" && (
          <div style={{ fontSize: 11, textAlign: "center", color: syncMsg === "ok" ? C.green : C.amber, marginBottom: 10 }}>
            {syncMsg === "ok" ? "Saved" : "Saved locally · cloud sync unavailable"}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <StatCard label="Total Budget" value={fmt(B.total)} sub="EST-2026-004 approved" accent={C.blue} />
              <StatCard label="Spent to Date" value={fmt(totalSpent)} sub={`${pctBurnt}% of budget`} accent={C.amber} />
              <StatCard label="Remaining" value={fmt(remaining)} sub={`${(100 - Number(pctBurnt)).toFixed(1)}% left`} accent={C.green} />
              <StatCard label="Claimed" value={fmt(claimed)} sub={`${milestones.filter(m => m.status === "invoiced" || m.status === "invoiced-draft" || m.status === "received").length} of ${milestones.filter(m => !m.retention).length} milestones`} accent={C.purple} />
            </div>

            <SectionLabel>Budget Breakdown</SectionLabel>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
              <BarRow label="Labour" spent={B.spentLabour} budget={B.labour} pct={labourPct} color={C.blue} />
              <BarRow label="Materials" spent={B.spentMaterials} budget={B.materials} pct={matPct} color={C.purple} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <span>Contingency: {fmt(B.contingency)}</span>
                <span style={{ color: contingLeft < 500 ? C.red : C.green, fontWeight: 700 }}>Remaining: {fmt(contingLeft)}</span>
              </div>
            </div>

            <SectionLabel>Hours Summary</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <MiniStat label="Planned Total" value={`${totalPlanned * 2}h`} sub="8-week plan" />
              <MiniStat label="Logged So Far" value={`${totalActual}h`} sub={`${HOURS.length} weeks in`} />
              <MiniStat label="Variance" value={`+${totalActual - totalPlanned}h`} sub="Tracking over" color={C.amber} />
            </div>
          </>
        )}

        {/* ── BURNDOWN ── */}
        {tab === "burndown" && (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 14px 10px", marginBottom: 14, overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Budget Burndown</div>
                <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
                  <span style={{ color: C.muted }}>— <span style={{ color: C.blue }}>Planned</span></span>
                  <span style={{ color: C.muted }}>— <span style={{ color: C.green }}>Actual</span></span>
                  <span style={{ color: C.muted }}>-- <span style={{ color: C.amber }}>Forecast</span></span>
                </div>
              </div>
              <svg viewBox={`0 0 ${CW + 40} ${CH + 30}`} style={{ width: "100%", minWidth: 300, display: "block" }}>
                {[0, 0.25, 0.5, 0.75, 1].map(f => (
                  <g key={f}>
                    <line x1="36" y1={yFor(B.total * f)} x2={CW + 36} y2={yFor(B.total * f)} stroke={C.border} strokeWidth="1" />
                    <text x="32" y={yFor(B.total * f) + 4} textAnchor="end" fontSize="8" fill={C.muted}>${Math.round(B.total * f / 1000)}k</text>
                  </g>
                ))}
                {WEEKS.map((w, i) => (
                  <text key={i} x={xFor(i) + 36} y={CH + 18} textAnchor="middle" fontSize="8" fill={C.muted}>{w}</text>
                ))}
                <g transform="translate(36,0)">
                  <path d={planArea} fill={C.blue} fillOpacity="0.08" />
                  <path d={actArea}  fill={C.green} fillOpacity="0.12" />
                  <path d={planPath} fill="none" stroke={C.blue} strokeWidth="2" strokeDasharray="5,3" />
                  <path d={actPath}  fill="none" stroke={C.green} strokeWidth="2.5" />
                  {ACTUAL.map((v, i) => (
                    <circle key={i} cx={xFor(i)} cy={yFor(v)} r="3.5" fill={C.green} stroke={C.navy} strokeWidth="1.5" />
                  ))}
                  <line x1={xFor(ACTUAL.length - 1)} y1={yFor(ACTUAL[ACTUAL.length - 1])} x2={CW} y2={yFor(7600)} stroke={C.amber} strokeWidth="1.5" strokeDasharray="4,4" />
                </g>
              </svg>
            </div>
            <SectionLabel>Weekly Detail</SectionLabel>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {WEEKS.map((w, i) => {
                const plan = PLAN[i];
                const act = ACTUAL[i];
                const variance = act !== undefined ? act - plan : null;
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr", gap: 4, padding: "10px 12px",
                    borderBottom: i < WEEKS.length - 1 ? `1px solid ${C.border}` : "none",
                    background: i % 2 === 0 ? C.card : C.navy,
                    fontSize: 11, alignItems: "center",
                  }}>
                    <div style={{ fontWeight: 700, color: C.blueLt }}>{w}</div>
                    <div style={{ color: C.muted }}>{fmt(plan)}</div>
                    <div style={{ color: act !== undefined ? C.green : C.muted, fontWeight: 600 }}>{act !== undefined ? fmt(act) : "—"}</div>
                    <div style={{ fontWeight: 700, color: variance === null ? C.muted : variance > 0 ? C.red : C.green, textAlign: "right" }}>
                      {variance === null ? "—" : `${variance > 0 ? "+" : ""}${fmt(Math.abs(variance))}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── HOURS ── */}
        {tab === "hours" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <StatCard label="Planned (total)" value={`${totalPlanned * 2}h`} accent={C.blue} />
              <StatCard label="Logged (4 wks)" value={`${totalActual}h`} accent={C.green} />
              <StatCard label="Remaining Est." value={`${totalPlanned * 2 - totalActual}h`} accent={C.muted} />
              <StatCard label="Variance" value={`+${totalActual - totalPlanned}h`} accent={C.amber} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionLabel>Weekly Timesheet</SectionLabel>
              <button onClick={handleSubmitTimesheet} style={{
                background: C.blue, border: "none", color: "#fff", fontSize: 11, fontWeight: 700,
                padding: "7px 12px", borderRadius: 8, cursor: "pointer",
              }}>+ Submit Timesheet</button>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              {HOURS.map((h, i) => {
                const v = h.actual - h.planned;
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr 50px 50px 70px 70px 50px", gap: 4, padding: "10px 12px",
                    borderBottom: i < HOURS.length - 1 ? `1px solid ${C.border}` : "none",
                    background: i % 2 === 0 ? C.card : C.navy,
                    fontSize: 11, alignItems: "center",
                  }}>
                    <div style={{ fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.week}</div>
                    <div style={{ textAlign: "center", color: C.muted }}>{h.planned}h</div>
                    <div style={{ textAlign: "center", fontWeight: 700, color: h.actual > h.planned ? C.red : C.green }}>{h.actual}h</div>
                    <div style={{ textAlign: "right", color: C.muted }}>{fmt(h.labour)}</div>
                    <div style={{ textAlign: "right", color: C.muted }}>{fmt(h.materials)}</div>
                    <div style={{ textAlign: "right", fontWeight: 700, color: v > 0 ? C.red : C.green }}>{v > 0 ? "+" : ""}{v}h</div>
                  </div>
                );
              })}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 50px 50px 70px 70px 50px", gap: 4, padding: "10px 12px",
                borderTop: `2px solid ${C.border}`, background: C.navy, fontSize: 11, fontWeight: 700, alignItems: "center",
              }}>
                <div style={{ color: C.text }}>TOTALS</div>
                <div style={{ textAlign: "center", color: C.text }}>{totalPlanned}h</div>
                <div style={{ textAlign: "center", color: totalActual > totalPlanned ? C.red : C.green }}>{totalActual}h</div>
                <div style={{ textAlign: "right", color: C.text }}>{fmt(HOURS.reduce((s, h) => s + h.labour, 0))}</div>
                <div style={{ textAlign: "right", color: C.text }}>{fmt(HOURS.reduce((s, h) => s + h.materials, 0))}</div>
                <div style={{ textAlign: "right", color: C.red }}>+{totalActual - totalPlanned}h</div>
              </div>
            </div>
          </>
        )}

        {/* ── MILESTONES ── */}
        {tab === "milestones" && (
          <>
            <div className="filter-tabs" style={{ marginBottom: 14 }}>
              {([["schedule","Payment Schedule"],["claims","Claim Status"],["deposit","Deposit + Splits"]] as const).map(([id, lbl]) => {
                const active = payTab === id;
                return (
                  <button key={id} onClick={() => setPayTab(id)} style={{
                    flexShrink: 0, background: active ? C.blue : C.card,
                    border: `1px solid ${active ? C.blue : C.border}`,
                    color: active ? "#fff" : C.muted,
                    fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 20, cursor: "pointer",
                  }}>{lbl}</button>
                );
              })}
            </div>

            {payTab === "schedule" && (
              <>
                {milestones.map((m, idx) => {
                  // Retention row uses amber framing (amber / pending per Section 9.5)
                  const color = m.retention ? C.amber : STATUS_COLOR[m.status];
                  const statusLabel = STATUS_LABEL[m.status];
                  return (
                    <div key={idx} title={m.retention ? "Held until defect liability period ends. Typically 3–6 months post Practical Completion." : undefined} style={{
                      background: C.card, border: `1px solid ${m.warning ? `${C.amber}55` : m.retention ? `${C.amber}55` : C.border}`,
                      borderLeft: `4px solid ${color}`, borderRadius: 14,
                      padding: "14px 16px", marginBottom: 10,
                      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 24, border: `3px solid ${color}`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <div style={{ fontSize: m.retention ? 16 : 13, fontWeight: 800, color }}>{m.retention ? "🔒" : `${m.pct}%`}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                            {m.retention ? "Retention Holdback — pending defect period" : m.label}
                          </span>
                          {m.retention && <Pill text="⏳ RETENTION HOLDBACK" color={C.amber} />}
                          {!m.retention && m.status === "ready"          && <Pill text="⚠️ READY TO CLAIM"  color={C.amber} />}
                          {!m.retention && m.status === "invoiced-draft" && <Pill text="📝 INVOICED (DRAFT)" color={C.blue}  />}
                          {!m.retention && m.status === "invoiced"       && <Pill text="📄 INVOICED"         color={C.blue}  />}
                          {!m.retention && m.status === "received"       && <Pill text="✓ RECEIVED"          color={C.green} />}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {m.retention ? "Holdback:" : "Claim:"} <strong style={{ color: C.text }}>{fmt(m.amount)}</strong>
                          {m.invoiceRef && <span style={{ color: C.blueLt, marginLeft: 8 }}>{m.invoiceRef}</span>}
                          {m.claimDate && <span style={{ color: C.dim, marginLeft: 8 }}>Submitted {m.claimDate}</span>}
                          {m.warning && <span style={{ color: C.amber, marginLeft: 8 }}>Finance notified</span>}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        {m.retention ? (
                          <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>{statusLabel}</span>
                        ) : m.status === "ready" ? (
                          <button onClick={() => claimMilestone(idx)} style={{
                            padding: "7px 14px", background: C.amber, color: "#fff",
                            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer",
                          }}>Submit Claim</button>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[m.status] }}>
                            {m.status === "received" ? `✓ ${fmt(m.amount)}` : statusLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <InfoBanner text="Milestone notifications trigger automatically: Finance alert at 50% remaining, warning at 25%, critical at 10%." />
              </>
            )}

            {payTab === "claims" && (() => {
              // Section 9.3 — deposit shown as a separate line above progress claims
              const rows: Array<{ label: string; val: string; hint?: string; color: string; divider?: boolean }> = [
                { label: "Total Contract Value",     val: fmt(B.total),                 color: C.blue                                                 },
                { label: "Deposit Received",         val: fmt(depositReceived),         color: C.green,  hint: depositRow.date ? `paid ${depositRow.date}` : undefined },
                { label: "Progress Claims Invoiced", val: fmt(progressClaimsInvoiced),  color: C.blue,   hint: depositInvoiceRef || undefined                           },
                { label: "Progress Claims Received", val: fmt(progressClaimsReceived),  color: C.muted,  hint: "awaiting payment",              divider: true          },
                { label: "Total Received to Date",   val: fmt(totalReceivedToDate),     color: C.green                                                },
                { label: "Outstanding",              val: fmt(outstanding),             color: C.amber                                                },
              ];
              return (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                    Claim Summary
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10,
                      padding: "10px 0",
                      borderTop: r.divider ? `2px solid ${C.border}` : "none",
                      borderBottom: i < rows.length - 1 && !rows[i + 1]?.divider ? `1px solid ${C.border}` : "none",
                    }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{r.label}</span>
                      <span style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: r.color }}>{r.val}</span>
                        {r.hint && <span style={{ fontSize: 10, color: C.dim, display: "block", marginTop: 2 }}>({r.hint})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {payTab === "deposit" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DEPOSIT_ROWS.map((p, i) => {
                  // Retention row = amber Retention Holdback badge (Section 9.4)
                  const statusColor = p.retention ? C.amber : STATUS_COLOR[p.status];
                  const statusLabel = p.retention ? "Retention Holdback" : STATUS_LABEL[p.status];
                  return (
                    <div key={i} title={p.tooltip} style={{
                      background: C.card, border: `1px solid ${p.retention ? `${C.amber}55` : C.border}`,
                      borderLeft: `4px solid ${statusColor}`, borderRadius: 12,
                      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${statusColor}22`, border: `1px solid ${statusColor}55`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                      }}>{p.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{p.note}{p.date && ` · ${p.date}`}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: statusColor }}>{fmt(p.amount)}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: statusColor, letterSpacing: "0.5px", textTransform: "uppercase" }}>{statusLabel}</div>
                      </div>
                    </div>
                  );
                })}
                {/* Section 9.4 reconciliation note */}
                <div style={{
                  background: `${C.blue}10`, border: `1px solid ${C.blue}33`, borderRadius: 10,
                  padding: "10px 14px", fontSize: 11, color: C.blueLt, lineHeight: 1.55, marginTop: 4,
                }}>
                  💡 Deposit ({fmt(depositReceived)}) credited against contract total. Retention ({fmt(DEPOSIT_ROWS[DEPOSIT_ROWS.length - 1].amount)}) held from final milestone payment.
                </div>
              </div>
            )}
          </>
        )}

        {/* ── OVERRUNS ── */}
        {tab === "overruns" && (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
              <SectionLabel>Contingency Reserve</SectionLabel>
              <div style={{ height: 12, background: C.border, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: 12, borderRadius: 6, width: `${(contingLeft / B.contingency) * 100}%`, background: contingLeft < 500 ? C.red : C.amber, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted }}>
                <span>Used: <strong style={{ color: C.red }}>{fmt(totalOverrun)}</strong></span>
                <span>Remaining: <strong style={{ color: contingLeft < 500 ? C.red : C.amber }}>{fmt(contingLeft)}</strong> of {fmt(B.contingency)}</span>
              </div>
            </div>

            <SectionLabel>Flagged Cost Overruns</SectionLabel>
            {OVERRUNS.map((o, i) => {
              const sc = sevColor[o.severity] ?? C.muted;
              return (
                <div key={i} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${sc}`,
                  borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{o.item}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{o.note}</div>
                    <Pill text={`${o.cat} · ${o.severity.toUpperCase()}`} color={sc} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: sc }}>{fmt(o.amount)}</div>
                </div>
              );
            })}

            <SectionLabel style={{ marginTop: 16 }}>External Risk Factors</SectionLabel>
            {RISK_FACTORS.map((r, i) => {
              const impactColor = r.impact === "High" ? C.red : r.impact === "Med" ? C.amber : C.muted;
              return (
                <div key={i} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "10px 12px", marginBottom: 6,
                  display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.factor}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{r.note}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: r.trend.startsWith("↑") ? C.red : r.trend.startsWith("↓") ? C.green : C.muted }}>{r.trend}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 12,
                    background: `${impactColor}22`, color: impactColor, whiteSpace: "nowrap",
                  }}>{r.impact}</span>
                </div>
              );
            })}
          </>
        )}

        {/* ── ACCOUNTING ── */}
        {tab === "accounting" && (
          <>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
              Sync your approved estimate and invoices to your accounting platform. Once connected, timesheets, invoices and payment milestones push automatically.
            </div>
            {ACCOUNTING_PLATFORMS.map(p => {
              const status = syncState[p.id] ?? "idle";
              return (
                <div key={p.id} style={{
                  background: C.card, border: `1px solid ${status === "connected" ? `${p.color}44` : C.border}`,
                  borderRadius: 14, padding: "16px", marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                }}>
                  <div style={{ fontSize: 30 }}>{p.logo}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{p.name}</span>
                      {status === "connected" && <Pill text="✓ Connected" color={C.green} />}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{p.desc}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.features.map(f => (
                        <span key={f} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: C.navy, color: C.dim, fontWeight: 600, border: `1px solid ${C.border}` }}>{f}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {status === "connected" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                        <button onClick={() => handleSync(p.id)} disabled={syncing === p.id} style={{
                          padding: "7px 14px", background: p.color, color: "#fff", border: "none",
                          borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer",
                          opacity: syncing === p.id ? 0.7 : 1,
                        }}>{syncing === p.id ? "⏳ Syncing…" : "🔄 Sync"}</button>
                        <span style={{ fontSize: 9, color: C.muted }}>Last: Today 7:02am</span>
                      </div>
                    ) : (
                      <button onClick={() => handleSync(p.id)} disabled={syncing === p.id} style={{
                        padding: "8px 16px", background: syncing === p.id ? C.card : p.color,
                        color: syncing === p.id ? C.muted : "#fff", border: `1px solid ${syncing === p.id ? C.border : p.color}`,
                        borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: "pointer",
                      }}>{syncing === p.id ? "⏳ Connecting…" : "Connect"}</button>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{
              background: `${C.blue}10`, border: `1px solid ${C.blue}33`, borderRadius: 12,
              padding: "12px 14px", marginTop: 6,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.blueLt, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                What syncs automatically once connected
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {SYNC_MAPPINGS.map(([ic, lbl], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.blueLt }}>
                    <span>{ic}</span><span>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`,
        display: "flex", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}>
        <button onClick={onBack} style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Back</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>📧</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Finance</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20, opacity: 0.9 }}>📈</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Reports</div>
          <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Shared primitives ───────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${accent}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? C.text }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.text, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function BarRow({ label, spent, budget, pct, color }: { label: string; spent: number; budget: number; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: C.text }}>{label}</span>
        <span style={{ color: C.muted }}>{fmt(spent)} / {fmt(budget)} <strong style={{ color, marginLeft: 4 }}>{pct}%</strong></span>
      </div>
      <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: 8, background: color, borderRadius: 4, width: `${pct}%`, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function SectionLabel({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8, ...s }}>{children}</div>
  );
}

function AlertBanner({ color, icon, title, body }: { color: string; icon: string; title: string; body: string }) {
  return (
    <div style={{
      background: `${color}14`, border: `1px solid ${color}44`, borderLeft: `4px solid ${color}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 8,
      display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12,
    }}>
      <span>{icon}</span>
      <div style={{ lineHeight: 1.5 }}>
        <strong style={{ color }}>{title} — </strong>
        <span style={{ color: C.text }}>{body}</span>
      </div>
    </div>
  );
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, background: `${color}22`, color,
      padding: "2px 7px", borderRadius: 20, marginTop: 4, display: "inline-block",
    }}>{text}</span>
  );
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: 10, background: `${C.blue}10`, border: `1px solid ${C.blue}33`,
      borderRadius: 10, padding: "10px 14px", fontSize: 11, color: C.blueLt, lineHeight: 1.55,
    }}>💡 {text}</div>
  );
}
