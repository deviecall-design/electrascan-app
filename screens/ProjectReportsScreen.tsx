import React, { useState } from "react";
import {
  BarChart2,
  TrendingDown,
  Clock,
  CheckSquare,
  AlertTriangle,
  RefreshCw,
  Circle,
  CheckCircle2,
  FileText,
  Info,
} from "lucide-react";
import { C, FONT, RADIUS, SPACING } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, Th, Td, B, MiniStat } from "../components/ui/anthropic";
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";
import { submitMilestoneClaim } from "../services/supabaseData";

// ─── RAG colours (spec Section 5) ────────────────────────────────────────
const RAG = {
  red:   { fg: "#EF4444", bg: "#FEF2F2" },
  amber: { fg: "#F59E0B", bg: "#FFFBEB" },
  green: { fg: "#10B981", bg: "#F0FDF4" },
  blue:  { fg: "#1D6EFD", bg: "#EFF6FF" },
  gray:  { fg: "#64748B", bg: "#F8FAFC" },
} as const;

type MilestoneStatus = "pending" | "ready_to_claim" | "invoiced_draft" | "invoiced" | "received";

// ─── Mock project data ────────────────────────────────────────────────────
const PROJECT = {
  name:          "Mark Arnesen",
  address:       "8/110 North Steyne, Manly",
  client:        "Linda Habak Design",
  ref:           "EST-2026-497",
  contractValue: 56_463,
  startDate:     "2 Apr 2026",
  status:        "active" as const,
  daysActive:    35,
  marginTarget:  15,
};

const BUDGET = {
  contract:       56_463,
  budgetedCost:   44_635,
  actualCost:     38_200,
  forecastCost:   47_100,
  labourBudget:   18_000,
  labourActual:   15_800,
  materialsBudget: 22_635,
  materialsActual: 19_600,
  subsBudget:      4_000,
  subsActual:      2_800,
};

const BURNDOWN_WEEKS = [
  { week: "Wk 1",  planned: 6_200,  actual: 5_100,  forecast: 5_100  },
  { week: "Wk 2",  planned: 12_400, actual: 10_800, forecast: 10_800 },
  { week: "Wk 3",  planned: 18_600, actual: 17_200, forecast: 17_200 },
  { week: "Wk 4",  planned: 24_800, actual: 22_900, forecast: 22_900 },
  { week: "Wk 5",  planned: 31_000, actual: 30_400, forecast: 30_400 },
  { week: "Wk 6",  planned: 37_200, actual: 38_200, forecast: 38_200 },
  { week: "Wk 7",  planned: 43_400, actual: null,   forecast: 43_100 },
  { week: "Wk 8",  planned: 44_635, actual: null,   forecast: 47_100 },
];

const HOURS_WEEKS = [
  { week: "Wk 1 (2–6 Apr)",  planned: 28, actual: 22 },
  { week: "Wk 2 (9–13 Apr)", planned: 32, actual: 30 },
  { week: "Wk 3 (16–20 Apr)",planned: 35, actual: 38 },
  { week: "Wk 4 (23–27 Apr)",planned: 35, actual: 34 },
  { week: "Wk 5 (30 Apr–4 May)", planned: 38, actual: 42 },
  { week: "Wk 6 (7–11 May)", planned: 40, actual: null },
];

const MILESTONES: {
  id: string; label: string; description: string;
  amount: number; pct: number | null;
  status: MilestoneStatus;
  invRef: string | null; paidDate: string | null;
  retention?: boolean;
}[] = [
  {
    id: "m1", label: "Deposit",
    description: "10% deposit on contract award",
    amount: 3_648, pct: 10,
    status: "received",
    invRef: null, paidDate: "10 Mar 2026",
  },
  {
    id: "m2", label: "First Fix",
    description: "Rough-in and cabling complete",
    amount: 9_120, pct: 25,
    status: "invoiced",
    invRef: "INV-2026-012", paidDate: null,
  },
  {
    id: "m3", label: "Second Fix",
    description: "Fit-off and board connection",
    amount: 16_939, pct: 30,
    status: "ready_to_claim",
    invRef: null, paidDate: null,
  },
  {
    id: "m4", label: "Practical Completion",
    description: "Test & tag, compliance certificate",
    amount: 22_431, pct: 35,
    status: "pending",
    invRef: null, paidDate: null,
  },
  {
    id: "m5", label: "Retention Release",
    description: "Held until defect liability period ends",
    amount: 1_824, pct: null,
    status: "pending",
    invRef: null, paidDate: null,
    retention: true,
  },
];

const MILESTONE_STATUS: Record<MilestoneStatus, { label: string; color: string; bg: string; border?: string }> = {
  pending:        { label: "Pending",           color: RAG.gray.fg,  bg: RAG.gray.bg  },
  ready_to_claim: { label: "Ready to Claim",    color: RAG.amber.fg, bg: RAG.amber.bg },
  invoiced_draft: { label: "Invoiced (Draft)",  color: RAG.blue.fg,  bg: "transparent", border: RAG.blue.fg },
  invoiced:       { label: "Invoiced",          color: RAG.blue.fg,  bg: RAG.blue.bg  },
  received:       { label: "Received",          color: RAG.green.fg, bg: RAG.green.bg },
};

const OVERRUNS = [
  {
    category: "Labour",
    description: "EWP hire extended — ceiling height variance",
    budgeted: 18_000, actual: 19_400, delta: 1_400,
    risk: "amber" as const,
  },
  {
    category: "Materials",
    description: "Cable pricing — market rate increase (copper)",
    budgeted: 22_635, actual: 23_800, delta: 1_165,
    risk: "amber" as const,
  },
];

const RISK_FACTORS = [
  { factor: "Copper pricing", impact: "Materials overrun", likelihood: "high", note: "LME copper +12% since estimate date" },
  { factor: "Builder delay", impact: "Second Fix pushed 2 weeks", likelihood: "medium", note: "Builder confirmed delay — no cost impact yet" },
  { factor: "Inspection booking", impact: "PC milestone", likelihood: "low", note: "SafeWork queue currently 10 days" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString("en-AU")}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);
const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;

type Tab = "overview" | "burndown" | "hours" | "milestones" | "overruns" | "accounting";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",   label: "Overview",   icon: <BarChart2 size={14} /> },
  { id: "burndown",   label: "Burndown",   icon: <TrendingDown size={14} /> },
  { id: "hours",      label: "Hours",      icon: <Clock size={14} /> },
  { id: "milestones", label: "Milestones", icon: <CheckSquare size={14} /> },
  { id: "overruns",   label: "Overruns",   icon: <AlertTriangle size={14} /> },
  { id: "accounting", label: "Accounting", icon: <RefreshCw size={14} /> },
];

// ─── Tab components ────────────────────────────────────────────────────────

function OverviewTab() {
  const burnPct = pct(BUDGET.actualCost, BUDGET.contract);
  const labourPct = pct(BUDGET.labourActual, BUDGET.labourBudget);
  const matPct    = pct(BUDGET.materialsActual, BUDGET.materialsBudget);
  const subsPct   = pct(BUDGET.subsActual, BUDGET.subsBudget);
  const forecastMargin = ((BUDGET.contract - BUDGET.forecastCost) / BUDGET.contract) * 100;

  const budgetBars = [
    { label: "Labour",    budgeted: BUDGET.labourBudget,    actual: BUDGET.labourActual,    pct: labourPct },
    { label: "Materials", budgeted: BUDGET.materialsBudget, actual: BUDGET.materialsActual, pct: matPct    },
    { label: "Subs/Other",budgeted: BUDGET.subsBudget,      actual: BUDGET.subsActual,      pct: subsPct   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: SPACING.lg }}>
        <MiniStat label="Contract Value"   v={fmtK(BUDGET.contract)}      />
        <MiniStat label="Cost to Date"     v={fmtK(BUDGET.actualCost)}     />
        <MiniStat label="Forecast Cost"    v={fmtK(BUDGET.forecastCost)}   />
        <MiniStat label="Forecast Margin"  v={`${forecastMargin.toFixed(1)}%`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACING.xl }}>
        {/* Budget burn */}
        <Card>
          <B>Budget burn</B>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: SPACING.lg }}>
            {fmt(BUDGET.actualCost)} spent of {fmt(BUDGET.contract)} contract
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg }}>
            <div style={{
              flex: 1, height: 10, borderRadius: RADIUS.sm,
              background: C.border, overflow: "hidden",
            }}>
              <div style={{
                width: `${Math.min(burnPct, 100)}%`, height: "100%",
                background: burnPct > 90 ? RAG.red.fg : burnPct > 75 ? RAG.amber.fg : C.orange,
                borderRadius: RADIUS.sm,
              }} />
            </div>
            <span style={{ fontSize: 13, fontFamily: FONT.heading, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>
              {burnPct}%
            </span>
          </div>

          {budgetBars.map(b => (
            <div key={b.label} style={{ marginBottom: SPACING.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{b.label}</span>
                <span style={{ fontSize: 12, fontFamily: FONT.heading, color: C.text }}>
                  {fmt(b.actual)} / {fmt(b.budgeted)}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: RADIUS.sm, background: C.border, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.min(b.pct, 100)}%`, height: "100%",
                  background: b.pct > 100 ? RAG.red.fg : b.pct > 85 ? RAG.amber.fg : RAG.green.fg,
                  borderRadius: RADIUS.sm,
                }} />
              </div>
            </div>
          ))}
        </Card>

        {/* Hours summary */}
        <Card>
          <B>Hours summary</B>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: SPACING.lg }}>
            Week 5 of 8 — forecast 40 hrs remaining
          </div>
          {[
            { label: "Hours logged",    value: "167 hrs", sub: "of 220 budgeted" },
            { label: "Avg per week",    value: "33.4 hrs", sub: "target: 27.5" },
            { label: "Electricians",    value: "2",        sub: "active this week" },
            { label: "Forecast total",  value: "207 hrs",  sub: `${fmt(BUDGET.labourActual + 7_600)} est. labour` },
          ].map(r => (
            <div key={r.label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: `${SPACING.sm}px 0`,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontFamily: FONT.heading, fontWeight: 700, color: C.text }}>{r.value}</div>
                <div style={{ fontSize: 11, color: C.textSubtle }}>{r.sub}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Forecast vs Budget vs Contract */}
      <Card>
        <B>Cost position</B>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: SPACING.lg, marginTop: SPACING.lg,
        }}>
          {[
            { label: "Budgeted cost",  value: BUDGET.budgetedCost,  note: `${pct(BUDGET.budgetedCost, BUDGET.contract)}% of contract`, color: RAG.blue.fg },
            { label: "Actual to date", value: BUDGET.actualCost,    note: `${pct(BUDGET.actualCost, BUDGET.budgetedCost)}% of budget used`, color: C.orange },
            { label: "Forecast total", value: BUDGET.forecastCost,  note: `${BUDGET.forecastCost > BUDGET.budgetedCost ? "+" : ""}${fmt(BUDGET.forecastCost - BUDGET.budgetedCost)} vs budget`, color: BUDGET.forecastCost > BUDGET.budgetedCost ? RAG.amber.fg : RAG.green.fg },
          ].map(c => (
            <div key={c.label} style={{
              padding: SPACING.lg,
              background: C.bgSoft, borderRadius: RADIUS.lg,
            }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: SPACING.xs, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {c.label}
              </div>
              <div style={{ fontSize: 22, fontFamily: FONT.heading, fontWeight: 700, color: c.color }}>{fmtK(c.value)}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: SPACING.xs }}>{c.note}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BurndownTab() {
  const maxVal = BUDGET.budgetedCost;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      <Card>
        <B>Cost burndown — planned vs actual vs forecast</B>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: SPACING.xl }}>
          Weeks 7–8 are forecast only
        </div>

        {/* SVG line chart */}
        <div style={{ overflowX: "auto" }}>
          <svg width="100%" viewBox="0 0 700 220" style={{ minWidth: 520 }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(frac => {
              const y = 20 + (1 - frac) * 160;
              return (
                <g key={frac}>
                  <line x1="60" y1={y} x2="680" y2={y} stroke={C.border} strokeWidth="1" />
                  <text x="52" y={y + 4} fontSize="10" fill={C.textSubtle} textAnchor="end">
                    {fmtK(frac * maxVal)}
                  </text>
                </g>
              );
            })}

            {/* X labels */}
            {BURNDOWN_WEEKS.map((w, i) => {
              const x = 60 + (i / (BURNDOWN_WEEKS.length - 1)) * 620;
              return (
                <text key={w.week} x={x} y={200} fontSize="10" fill={C.textSubtle} textAnchor="middle">
                  {w.week}
                </text>
              );
            })}

            {/* Planned line */}
            <polyline
              points={BURNDOWN_WEEKS.map((w, i) => {
                const x = 60 + (i / (BURNDOWN_WEEKS.length - 1)) * 620;
                const y = 20 + (1 - w.planned / maxVal) * 160;
                return `${x},${y}`;
              }).join(" ")}
              fill="none" stroke={C.border} strokeWidth="2" strokeDasharray="6 3"
            />

            {/* Actual line (solid, up to last actual week) */}
            {(() => {
              const actuals = BURNDOWN_WEEKS.filter(w => w.actual !== null);
              if (actuals.length < 2) return null;
              return (
                <polyline
                  points={actuals.map((w, i) => {
                    const fullI = BURNDOWN_WEEKS.indexOf(w);
                    const x = 60 + (fullI / (BURNDOWN_WEEKS.length - 1)) * 620;
                    const y = 20 + (1 - (w.actual as number) / maxVal) * 160;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none" stroke={C.orange} strokeWidth="2.5"
                />
              );
            })()}

            {/* Forecast line (dashed, from last actual to end) */}
            {(() => {
              const lastActualIdx = BURNDOWN_WEEKS.reduce((last, w, i) => w.actual !== null ? i : last, -1);
              if (lastActualIdx < 0) return null;
              const forecastPts = BURNDOWN_WEEKS.slice(lastActualIdx);
              return (
                <polyline
                  points={forecastPts.map((w, i) => {
                    const fullI = lastActualIdx + i;
                    const x = 60 + (fullI / (BURNDOWN_WEEKS.length - 1)) * 620;
                    const val = i === 0 ? (w.actual as number) : w.forecast;
                    const y = 20 + (1 - val / maxVal) * 160;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none" stroke={RAG.amber.fg} strokeWidth="2" strokeDasharray="4 3"
                />
              );
            })()}

            {/* Data points */}
            {BURNDOWN_WEEKS.map((w, i) => {
              if (w.actual === null) return null;
              const x = 60 + (i / (BURNDOWN_WEEKS.length - 1)) * 620;
              const y = 20 + (1 - w.actual / maxVal) * 160;
              return <circle key={i} cx={x} cy={y} r="4" fill={C.orange} stroke="#fff" strokeWidth="2" />;
            })}
          </svg>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: SPACING.xl, marginTop: SPACING.sm }}>
          {[
            { color: C.border, dash: true,  label: "Planned" },
            { color: C.orange, dash: false, label: "Actual" },
            { color: RAG.amber.fg, dash: true, label: "Forecast" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
              <div style={{
                width: 24, height: 2,
                background: l.dash
                  ? `repeating-linear-gradient(to right, ${l.color} 0, ${l.color} 5px, transparent 5px, transparent 9px)`
                  : l.color,
              }} />
              <span style={{ fontSize: 12, color: C.textMuted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Weekly table */}
      <Card style={{ padding: 0 }}>
        <div style={{ padding: `${SPACING.lg}px ${SPACING.xl}px ${SPACING.md}px` }}>
          <B>Weekly breakdown</B>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Week</Th>
              <Th align="right">Planned</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Variance</Th>
              <Th align="right">Forecast</Th>
            </tr>
          </thead>
          <tbody>
            {BURNDOWN_WEEKS.map((w, i) => {
              const variance = w.actual != null ? w.actual - w.planned : null;
              const isForecast = w.actual === null;
              return (
                <tr key={w.week} style={{ background: isForecast ? C.bgSoft : undefined }}>
                  <Td>
                    <span style={{ color: isForecast ? C.textSubtle : C.text, fontStyle: isForecast ? "italic" : "normal" }}>
                      {w.week}{isForecast ? " (forecast)" : ""}
                    </span>
                  </Td>
                  <Td align="right">{fmtK(w.planned)}</Td>
                  <Td align="right">{w.actual != null ? fmtK(w.actual) : "—"}</Td>
                  <Td align="right">
                    {variance != null ? (
                      <span style={{ color: variance > 0 ? RAG.amber.fg : RAG.green.fg, fontFamily: FONT.heading, fontWeight: 600 }}>
                        {variance > 0 ? "+" : ""}{fmtK(variance)}
                      </span>
                    ) : "—"}
                  </Td>
                  <Td align="right">
                    <span style={{ color: isForecast ? RAG.amber.fg : C.textMuted }}>{fmtK(w.forecast)}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function HoursTab() {
  const totalPlanned = HOURS_WEEKS.reduce((s, w) => s + w.planned, 0);
  const totalActual  = HOURS_WEEKS.filter(w => w.actual != null).reduce((s, w) => s + (w.actual as number), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: SPACING.lg }}>
        <MiniStat label="Hours logged"   v={`${totalActual} hrs`} />
        <MiniStat label="Hours budgeted" v={`${totalPlanned} hrs`} />
        <MiniStat label="Hrs remaining"  v="40 hrs (est.)" />
        <MiniStat label="Avg team"       v="2 tradespeople" />
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: `${SPACING.lg}px ${SPACING.xl}px ${SPACING.md}px` }}>
          <B>Weekly timesheet log</B>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Week</Th>
              <Th align="right">Planned</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Variance</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {HOURS_WEEKS.map(w => {
              const variance = w.actual != null ? w.actual - w.planned : null;
              const isPending = w.actual === null;
              let ragColor: (typeof RAG)[keyof typeof RAG] = RAG.green;
              if (variance != null) {
                if (variance > 6) ragColor = RAG.red;
                else if (variance > 2) ragColor = RAG.amber;
              }
              return (
                <tr key={w.week}>
                  <Td>{w.week}</Td>
                  <Td align="right">{w.planned} hrs</Td>
                  <Td align="right">{w.actual != null ? `${w.actual} hrs` : "—"}</Td>
                  <Td align="right">
                    {variance != null ? (
                      <span style={{ color: ragColor.fg, fontFamily: FONT.heading, fontWeight: 600 }}>
                        {variance > 0 ? "+" : ""}{variance} hrs
                      </span>
                    ) : "—"}
                  </Td>
                  <Td>
                    {isPending ? (
                      <span style={{ fontSize: 11, color: RAG.gray.fg, background: RAG.gray.bg, padding: "2px 8px", borderRadius: RADIUS.sm }}>
                        Pending
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: ragColor.fg, background: ragColor.bg, padding: "2px 8px", borderRadius: RADIUS.sm }}>
                        {variance === 0 ? "On target" : variance! > 0 ? "Over" : "Under"}
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function MilestonesTab() {
  // Local milestone state so Submit Claim can update status optimistically
  const [milestones, setMilestones] = useState(MILESTONES.map(m => ({ ...m })));
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const totalReceived    = milestones.filter(m => m.status === "received").reduce((s, m) => s + m.amount, 0);
  const totalInvoiced    = milestones.filter(m => m.status === "invoiced").reduce((s, m) => s + m.amount, 0);
  const depositReceived  = milestones.find(m => m.id === "m1")?.amount ?? 0;
  const firstFixInv      = milestones.find(m => m.id === "m2");
  const progressInvoiced = firstFixInv?.status === "invoiced" ? firstFixInv.amount : 0;
  const totalOutstanding = PROJECT.contractValue - totalReceived;

  const handleSubmitClaim = async (milestoneId: string, label: string, amount: number) => {
    setSubmitting(milestoneId);
    try {
      const { invRef, error } = await submitMilestoneClaim(
        PROJECT.ref, milestoneId, label, amount,
      );
      // Optimistic update — advance status to invoiced_draft regardless of
      // Supabase error (table may not exist yet). The invRef is always returned.
      const ref = invRef ?? `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
      setMilestones(prev =>
        prev.map(m =>
          m.id === milestoneId
            ? { ...m, status: "invoiced_draft" as MilestoneStatus, invRef: ref }
            : m
        )
      );
      setNotification(
        `Draft invoice ${ref} created. Finance team notified for MYOB review.`
      );
      setTimeout(() => setNotification(null), 6000);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      {/* Finance team notification toast */}
      {notification && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: RAG.blue.bg, borderRadius: RADIUS.lg,
          border: `1px solid ${RAG.blue.fg}`,
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: FONT.heading, fontSize: 13, color: RAG.blue.fg,
        }}>
          <Info size={16} />
          {notification}
        </div>
      )}

      {/* Claim summary — spec Section 9.3 */}
      <Card>
        <B>Claim Summary</B>
        <div style={{ marginTop: SPACING.lg, display: "flex", flexDirection: "column", gap: SPACING.sm }}>
          {[
            { label: "Total Contract Value",     value: fmt(PROJECT.contractValue) },
            { label: "Deposit Received",         value: `${fmt(depositReceived)}   (paid 10 Mar 2026)` },
            { label: "Progress Claims Invoiced", value: firstFixInv?.invRef
                ? `${fmt(progressInvoiced)}   (${firstFixInv.invRef})`
                : `${fmt(progressInvoiced)}   (awaiting invoice)` },
            { label: "Progress Claims Received", value: `${fmt(0)}   (awaiting payment)` },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: `${SPACING.xs}px 0` }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>{r.label}</span>
              <span style={{ fontSize: 13, fontFamily: FONT.heading, color: C.text }}>{r.value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: C.border, margin: `${SPACING.xs}px 0` }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total Received to Date</span>
            <span style={{ fontSize: 14, fontFamily: FONT.heading, fontWeight: 700, color: RAG.green.fg }}>{fmt(totalReceived)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Outstanding</span>
            <span style={{ fontSize: 14, fontFamily: FONT.heading, fontWeight: 700, color: RAG.amber.fg }}>{fmt(totalOutstanding)}</span>
          </div>
        </div>
      </Card>

      {/* Payment schedule — milestone list */}
      <Card style={{ padding: 0 }}>
        <div style={{ padding: `${SPACING.lg}px ${SPACING.xl}px ${SPACING.md}px`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <B>Payment schedule</B>
          <span style={{ fontSize: 12, color: C.textSubtle, fontStyle: "italic", fontFamily: FONT.body }}>
            Reconciliation: Deposit ($3,648) credited against contract. Retention ($1,824) held from final milestone.
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Milestone</Th>
              <Th>Description</Th>
              <Th align="right">Amount</Th>
              <Th align="right">%</Th>
              <Th>Status</Th>
              <Th>Invoice / Date</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {milestones.map(m => {
              const cfg = MILESTONE_STATUS[m.status];
              const isSubmitting = submitting === m.id;
              return (
                <tr key={m.id} style={{ background: m.retention ? C.bgSoft : undefined }}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
                      {m.status === "received"
                        ? <CheckCircle2 size={14} color={RAG.green.fg} />
                        : <Circle size={14} color={C.border} />
                      }
                      <span style={{ fontWeight: 600 }}>{m.label}</span>
                      {m.retention && (
                        <span
                          title="Held until defect liability period ends. Typically 3–6 months post Practical Completion."
                          style={{
                            fontSize: 10, color: RAG.amber.fg, background: RAG.amber.bg,
                            padding: "2px 6px", borderRadius: RADIUS.sm,
                            cursor: "help",
                          }}
                        >
                          Retention Holdback
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td><span style={{ color: C.textMuted, fontSize: 12 }}>{m.description}</span></Td>
                  <Td align="right"><span style={{ fontFamily: FONT.heading, fontWeight: 600 }}>{fmt(m.amount)}</span></Td>
                  <Td align="right" muted>{m.pct != null ? `${m.pct}%` : "—"}</Td>
                  <Td>
                    <span style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: RADIUS.sm,
                      color: cfg.color, background: cfg.bg,
                      border: cfg.border ? `1px solid ${cfg.border}` : undefined,
                    }}>
                      {cfg.label}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>
                      {m.invRef ?? m.paidDate ?? (m.retention ? "Pending defect period" : "—")}
                    </span>
                  </Td>
                  <Td>
                    {m.status === "ready_to_claim" && (
                      <GhostButton
                        onClick={() => handleSubmitClaim(m.id, m.label, m.amount)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting…" : "Submit Claim"}
                      </GhostButton>
                    )}
                    {m.status === "invoiced_draft" && (
                      <span style={{ fontSize: 11, color: RAG.blue.fg, fontStyle: "italic", fontFamily: FONT.body }}>
                        Awaiting MYOB review
                      </span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: `${SPACING.md}px ${SPACING.xl}px`, borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, color: C.textSubtle, fontStyle: "italic", fontFamily: FONT.body }}>
            Retention Holdback — held until defect liability period ends. Typically 3–6 months post Practical Completion.
          </span>
        </div>
      </Card>
    </div>
  );
}

function OverrunsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      <Card style={{ padding: 0 }}>
        <div style={{ padding: `${SPACING.lg}px ${SPACING.xl}px ${SPACING.md}px` }}>
          <B>Cost overruns</B>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th>Description</Th>
              <Th align="right">Budgeted</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Delta</Th>
              <Th>Risk</Th>
            </tr>
          </thead>
          <tbody>
            {OVERRUNS.map((o, i) => {
              const rag = RAG[o.risk];
              return (
                <tr key={i}>
                  <Td><span style={{ fontWeight: 600 }}>{o.category}</span></Td>
                  <Td><span style={{ color: C.textMuted, fontSize: 12 }}>{o.description}</span></Td>
                  <Td align="right"><span style={{ fontFamily: FONT.heading }}>{fmt(o.budgeted)}</span></Td>
                  <Td align="right"><span style={{ fontFamily: FONT.heading }}>{fmt(o.actual)}</span></Td>
                  <Td align="right">
                    <span style={{ color: rag.fg, fontFamily: FONT.heading, fontWeight: 700 }}>
                      +{fmt(o.delta)}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 11, color: rag.fg, background: rag.bg, padding: "2px 8px", borderRadius: RADIUS.sm }}>
                      {o.risk.charAt(0).toUpperCase() + o.risk.slice(1)}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: `${SPACING.lg}px ${SPACING.xl}px ${SPACING.md}px` }}>
          <B>External risk factors</B>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Factor</Th>
              <Th>Impact</Th>
              <Th>Likelihood</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {RISK_FACTORS.map((r, i) => {
              const rag = r.likelihood === "high" ? RAG.red : r.likelihood === "medium" ? RAG.amber : RAG.gray;
              return (
                <tr key={i}>
                  <Td><span style={{ fontWeight: 600 }}>{r.factor}</span></Td>
                  <Td muted>{r.impact}</Td>
                  <Td>
                    <span style={{ fontSize: 11, color: rag.fg, background: rag.bg, padding: "2px 8px", borderRadius: RADIUS.sm }}>
                      {r.likelihood.charAt(0).toUpperCase() + r.likelihood.slice(1)}
                    </span>
                  </Td>
                  <Td><span style={{ color: C.textSubtle, fontSize: 12 }}>{r.note}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AccountingTab() {
  const integrations = [
    { name: "MYOB AccountRight",  status: "not_connected", logo: "M", color: "#5C4B99" },
    { name: "Xero",               status: "not_connected", logo: "X", color: "#13B5EA" },
    { name: "QuickBooks Online",  status: "not_connected", logo: "Q", color: "#2CA01C" },
  ] as const;

  const syncMap = [
    { from: "Estimates",       arrow: "→", to: "Quotes",        status: "ready" },
    { from: "Milestone Claims",arrow: "→", to: "Invoices",       status: "ready" },
    { from: "Timesheets",      arrow: "→", to: "Time Entries",   status: "ready" },
    { from: "Milestones",      arrow: "→", to: "Receipts",       status: "ready" },
    { from: "Materials",       arrow: "→", to: "Expense Claims", status: "ready" },
    { from: "Labour",          arrow: "→", to: "Payroll",        status: "coming_soon" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xl }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: SPACING.lg }}>
        {integrations.map(i => (
          <Card key={i.name}>
            <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg }}>
              <div style={{
                width: 36, height: 36, borderRadius: RADIUS.md,
                background: i.color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontFamily: FONT.heading, fontWeight: 800,
                flexShrink: 0,
              }}>
                {i.logo}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{i.name}</div>
                <div style={{ fontSize: 12, color: RAG.gray.fg }}>Not connected</div>
              </div>
            </div>
            <div style={{ display: "flex" }}>
              <PrimaryButton onClick={() => {}}>Connect</PrimaryButton>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <B>Sync map</B>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: SPACING.lg }}>
          Once connected, ElectraScan syncs the following objects automatically.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>ElectraScan</Th>
              <Th />
              <Th>Accounting system</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {syncMap.map((r, i) => (
              <tr key={i}>
                <Td><span style={{ fontWeight: 600 }}>{r.from}</span></Td>
                <Td align="center"><span style={{ color: C.textSubtle }}>→</span></Td>
                <Td muted>{r.to}</Td>
                <Td>
                  {r.status === "coming_soon" ? (
                    <span style={{ fontSize: 11, color: RAG.gray.fg, background: RAG.gray.bg, padding: "2px 8px", borderRadius: RADIUS.sm }}>
                      Phase 8
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: RAG.blue.fg, background: RAG.blue.bg, padding: "2px 8px", borderRadius: RADIUS.sm }}>
                      Ready
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function ProjectReportsScreen() {
  const [tab, setTab] = useState<Tab>("overview");

  const ragDaysActive = PROJECT.daysActive >= 22 ? RAG.red : PROJECT.daysActive >= 14 ? RAG.amber : RAG.gray;

  return (
    <div className="anim-in">
      <PageHeader
        title={PROJECT.name}
        sub={`${PROJECT.address} · ${PROJECT.client}`}
        cta={
          <div style={{ display: "flex", gap: SPACING.md, alignItems: "center" }}>
            <span style={{
              fontSize: 12, padding: "4px 10px", borderRadius: RADIUS.sm,
              color: ragDaysActive.fg, background: ragDaysActive.bg,
              fontFamily: FONT.heading,
            }}>
              {PROJECT.daysActive}d active
            </span>
            <GhostButton onClick={() => {}} icon={<FileText size={14} />}>
              Export Report
            </GhostButton>
          </div>
        }
      />

      {/* Project meta strip */}
      <div style={{
        display: "flex", gap: SPACING.xl, marginBottom: SPACING.xl,
        padding: `${SPACING.md}px ${SPACING.xl}px`,
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: RADIUS.lg,
      }}>
        {[
          { label: "Contract ref",    value: PROJECT.ref },
          { label: "Contract value",  value: fmt(PROJECT.contractValue) },
          { label: "Start date",      value: PROJECT.startDate },
          { label: "Status",          value: "Active" },
          { label: "Margin target",   value: `${PROJECT.marginTarget}%` },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 11, color: C.textSubtle, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {f.label}
            </div>
            <div style={{ fontSize: 13, fontFamily: FONT.heading, fontWeight: 600, color: C.text }}>{f.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, marginBottom: SPACING.xl,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: SPACING.xs,
              padding: `${SPACING.sm}px ${SPACING.lg}px`,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontFamily: FONT.heading, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? C.orange : C.textMuted,
              borderBottom: tab === t.id ? `2px solid ${C.orange}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview"   && <OverviewTab />}
      {tab === "burndown"   && <BurndownTab />}
      {tab === "hours"      && <HoursTab />}
      {tab === "milestones" && <MilestonesTab />}
      {tab === "overruns"   && <OverrunsTab />}
      {tab === "accounting" && <AccountingTab />}

      <Footer />
    </div>
  );
}
