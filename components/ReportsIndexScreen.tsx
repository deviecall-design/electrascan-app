import React, { useMemo, useState } from "react";
import {
  useProjects,
  estimateTotals,
  type Project,
} from "../contexts/ProjectContext";
import { useTenant } from "../contexts/TenantContext";

const C = {
  bg: "#0A1628",
  navy: "#0F1E35",
  card: "#132240",
  blue: "#1D6EFD",
  blueLt: "#4B8FFF",
  green: "#00C48C",
  greenDk: "#059669",
  amber: "#FFB020",
  red: "#FF4D4D",
  text: "#EDF2FF",
  muted: "#5C7A9E",
  border: "#1A3358",
  dim: "#8BA4C4",
  purple: "#7C3AED",
  teal: "#0EA5E9",
};

interface ReportsIndexProps {
  onBack: () => void;
}

type TileId = "budget" | "hours" | "milestones" | "overruns" | "accounting";
interface Tile {
  id: TileId;
  icon: string;
  title: string;
  sub: string;
  accent: string;
}
const TILES: Tile[] = [
  { id: "budget",      icon: "💰", title: "Budget Summary",   sub: "Live budget, approved vs pending",        accent: C.blue   },
  { id: "hours",       icon: "⏱️", title: "Hours & Labour",   sub: "Planned vs logged timesheets",            accent: C.amber  },
  { id: "milestones",  icon: "🚩", title: "Milestones",        sub: "Claim status across payment schedule",    accent: C.purple },
  { id: "overruns",    icon: "⚠️", title: "Overruns",          sub: "Flagged cost overruns & risk factors",    accent: C.red    },
  { id: "accounting",  icon: "🔗", title: "Accounting Sync",   sub: "MYOB, Xero, QuickBooks connectors",       accent: C.teal   },
];

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;

function loadApprovalStatus(projectId: string): "pending" | "approved" | "rejected" | undefined {
  try {
    const raw = window.localStorage.getItem(`electrascan_approvals_${projectId}`);
    if (!raw) return undefined;
    const entries = JSON.parse(raw) as Array<{ action?: string }>;
    if (!Array.isArray(entries)) return undefined;
    const last = [...entries].reverse().find(e => e.action === "approved" || e.action === "rejected");
    if (last?.action === "approved") return "approved";
    if (last?.action === "rejected") return "rejected";
    return "pending";
  } catch {
    return undefined;
  }
}

const ReportsIndexScreen: React.FC<ReportsIndexProps> = ({ onBack }) => {
  const { projects } = useProjects();
  const { tenant } = useTenant();
  const [openTile, setOpenTile] = useState<TileId | null>(null);

  const kpis = useMemo(() => {
    const activeCount = projects.filter(p => p.status === "Active").length;
    const scansUsed = projects.reduce((s, p) => s + p.scans.length, 0);
    const totalValue = projects.reduce((s, p) => {
      const last = p.estimates[p.estimates.length - 1];
      if (!last) return s;
      return s + estimateTotals(last).total;
    }, 0);
    return {
      totalProjects: projects.length,
      activeCount,
      totalValue,
      scansUsed,
    };
  }, [projects]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      {/* Header */}
      <div
        style={{
          background: C.navy,
          borderBottom: `1px solid ${C.border}`,
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Reports</div>
            <div style={{ fontSize: 12, color: C.muted }}>{tenant.name} · internal dashboards</div>
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            background: C.card,
            color: C.blueLt,
            padding: "4px 10px",
            borderRadius: 20,
            letterSpacing: 1,
          }}
        >
          🔒 INTERNAL ONLY
        </span>
      </div>

      {/* KPI strip */}
      <div
        style={{
          padding: "20px 24px 0",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <KpiCard label="Active Projects" value={String(kpis.activeCount)} sub={`${kpis.totalProjects} total`} color={C.green} />
        <KpiCard label="Total Estimate Value" value={fmt(kpis.totalValue)} sub="inc GST" color={C.blue} />
        <KpiCard label="Scans Used" value={String(kpis.scansUsed)} sub="this tenant" color={C.amber} />
      </div>

      {/* Report tiles */}
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 12 }}>
          REPORTS
        </div>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {TILES.map(t => (
            <button
              key={t.id}
              onClick={() => setOpenTile(t.id)}
              style={{
                textAlign: "left",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderTop: `3px solid ${t.accent}`,
                borderRadius: 14,
                padding: 16,
                cursor: "pointer",
                color: C.text,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${t.accent}22`,
                  color: t.accent,
                  fontSize: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{t.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "28px 24px 40px", color: C.muted, fontSize: 11 }}>
        Budget Summary shows live data from your projects. Other reports are
        placeholders until the full reporting module ships.
      </div>

      {openTile === "budget" && (
        <BudgetSummaryModal projects={projects} onClose={() => setOpenTile(null)} />
      )}
      {openTile && openTile !== "budget" && (
        <ComingSoonModal
          title={TILES.find(t => t.id === openTile)?.title ?? "Report"}
          onClose={() => setOpenTile(null)}
        />
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; sub?: string; color: string }> = ({
  label,
  value,
  sub,
  color,
}) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 14,
      padding: 16,
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        letterSpacing: 0.6,
        marginBottom: 8,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>}
  </div>
);

function BudgetSummaryModal({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const rows = useMemo(() => {
    return projects
      .map(p => {
        const last = p.estimates[p.estimates.length - 1];
        const total = last ? estimateTotals(last).total : 0;
        const approvalStatus = p.approvalStatus ?? loadApprovalStatus(p.id) ?? "pending";
        return {
          id: p.id,
          name: p.name,
          number: last?.number ?? "—",
          total,
          approvalStatus,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [projects]);

  const approvedTotal = rows
    .filter(r => r.approvalStatus === "approved")
    .reduce((s, r) => s + r.total, 0);
  const pendingTotal = rows
    .filter(r => r.approvalStatus === "pending")
    .reduce((s, r) => s + r.total, 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Modal onClose={onClose} title="Budget Summary">
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>
        Live totals from every project's latest estimate. Approval status is
        pulled from the approval audit saved per project.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <MetricChip label="Total estimate value" value={fmt(grandTotal)} color={C.blue} />
        <MetricChip label="Approved" value={fmt(approvedTotal)} color={C.greenDk} />
        <MetricChip label="Pending" value={fmt(pendingTotal)} color={C.amber} />
      </div>

      {rows.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          No projects yet. Create a project to populate the budget summary.
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1.2fr",
              padding: "10px 14px",
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: 0.6,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div>PROJECT</div>
            <div>LATEST ESTIMATE</div>
            <div style={{ textAlign: "right" }}>VALUE</div>
            <div style={{ textAlign: "right" }}>APPROVAL</div>
          </div>
          {rows.map((r, i) => {
            const palette =
              r.approvalStatus === "approved"
                ? { bg: `${C.greenDk}22`, fg: C.greenDk, label: "Approved" }
                : r.approvalStatus === "rejected"
                  ? { bg: `${C.red}22`, fg: C.red, label: "Rejected" }
                  : { bg: `${C.amber}22`, fg: C.amber, label: "Pending" };
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.5fr 1fr 1.2fr",
                  padding: "10px 14px",
                  fontSize: 12,
                  borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ color: C.dim, fontSize: 11 }}>{r.number}</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>{fmt(r.total)}</div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: palette.bg,
                      color: palette.fg,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {palette.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function ComingSoonModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title={title}>
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 14,
          padding: "36px 20px",
          textAlign: "center",
          color: C.muted,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🚧</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Coming soon
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.55, maxWidth: 360, margin: "0 auto" }}>
          This report is queued in the reporting module. Budget Summary is live
          today — the rest will light up once the timesheet + milestone streams
          are connected.
        </div>
      </div>
    </Modal>
  );
}

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 300,
      background: "rgba(0,0,0,0.72)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: C.navy,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: 22,
        maxWidth: 760,
        width: "100%",
        maxHeight: "88vh",
        overflowY: "auto",
        color: C.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{title}</div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const MetricChip: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
  </div>
);

export default ReportsIndexScreen;
