import React, { useEffect, useMemo, useState } from "react";
import { useProjects, estimateTotals, statusPalette, type Project } from "../contexts/ProjectContext";
import {
  fetchDashboardKpis,
  formatScanToQuote,
  type DashboardKpis,
} from "../services/dashboardKpiService";

/**
 * DashboardScreen (light theme — renders inside AppShell).
 * Shows KPI stat cards, recent projects, and quick actions.
 * The greeting/topbar now lives in AppShell.
 */

const C = {
  card:    "#FFFFFF",
  border:  "#E2E8F0",
  bgLight: "#F0F4F8",
  dark:    "#1E293B",
  grayMd:  "#64748B",
  grayLt:  "#94A3B8",
  blue:    "#1D6EFD",
  green:   "#10B981",
  amber:   "#F59E0B",
  red:     "#EF4444",
  purple:  "#8B5CF6",
  teal:    "#0EA5E9",
};

interface Props {
  onOpenProjects: () => void;
  onOpenProject: (project: Project) => void;
  onNewProject: () => void;
  onNewScan: () => void;
  onOpenRateLibrary?: () => void;
  onOpenReports?: () => void;
  onOpenEmail?: () => void;
  onOpenSettings?: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

// Status → accent bar colour for project cards.
function statusAccent(status: string): string {
  switch (status) {
    case "Active":  return C.blue;
    case "Won":     return C.green;
    case "Lost":    return C.red;
    case "On Hold": return C.amber;
    default:        return C.purple;
  }
}

const DashboardScreen: React.FC<Props> = ({
  onOpenProjects,
  onOpenProject,
  onNewProject,
  onNewScan,
  onOpenRateLibrary,
  onOpenReports,
  onOpenEmail,
}) => {
  const { projects } = useProjects();

  // Local-only fallback so the dashboard still has something useful to show
  // when Supabase is unreachable, the user is unauthenticated, or the
  // estimates table is empty for this owner.
  const localStats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

    const estimatesThisMonth = projects.reduce((sum, p) =>
      sum + p.estimates.filter(e => {
        const d = new Date(e.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
      }).length, 0);

    const pendingValue = projects.reduce((sum, p) =>
      sum + p.estimates
        .filter(e => !e.locked)
        .reduce((s, e) => s + estimateTotals(e).total, 0), 0);

    const won  = projects.filter(p => p.status === "Won").length;
    const lost = projects.filter(p => p.status === "Lost").length;
    const winRate = (won + lost) === 0 ? null : Math.round((won / (won + lost)) * 100);

    const diffs = projects
      .filter(p => p.scans.length > 0 && p.estimates.length > 0)
      .map(p => {
        const ms = new Date(p.estimates[0].createdAt).getTime() - new Date(p.scans[0].scannedAt).getTime();
        return ms / (1000 * 60 * 60 * 24);
      });
    const avgDays = diffs.length === 0 ? null : Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length * 10) / 10;

    return { estimatesThisMonth, pendingValue, winRate, avgDays };
  }, [projects]);

  // Live KPIs from Supabase. While loading we render skeleton placeholders;
  // on error we fall through to the local-only numbers above so the dashboard
  // never blanks out for a transient network issue.
  const [live, setLive] = useState<DashboardKpis | null>(null);
  const [kpiState, setKpiState] = useState<"loading" | "ready" | "error">("loading");
  const [kpiError, setKpiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setKpiState("loading");
    fetchDashboardKpis().then((res: { ok: true; kpis: DashboardKpis } | { ok: false; error: string }) => {
      if (cancelled) return;
      if (res.ok === true) {
        setLive(res.kpis);
        setKpiError(null);
        setKpiState("ready");
      } else {
        setLive(null);
        setKpiError(res.error);
        setKpiState("error");
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Use live numbers when present, otherwise fall back to local.
  const useLive = live && live.source === "supabase";
  const stats = {
    estimatesThisMonth: useLive ? live!.estimatesThisMonth : localStats.estimatesThisMonth,
    pendingValue:       useLive ? live!.pendingValue       : localStats.pendingValue,
    winRate:            useLive ? live!.winRate            : localStats.winRate,
    avgScanToQuote:     useLive ? formatScanToQuote(live!.avgScanToQuoteHours)
                                : (localStats.avgDays === null ? "—" : `${localStats.avgDays}d`),
  };

  const recent = useMemo(() => {
    return [...projects]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 6);
  }, [projects]);

  return (
    <div>
      {/* KPI stat cards */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: kpiState === "error" ? 8 : 24,
        }}
      >
        <StatCard label="Estimates This Month" value={String(stats.estimatesThisMonth)}                                                color={C.amber}  loading={kpiState === "loading"} />
        <StatCard label="Pending Value"        value={stats.pendingValue > 0 ? `$${(stats.pendingValue / 1000).toFixed(0)}k` : "$0"}   color={C.green}  loading={kpiState === "loading"} />
        <StatCard label="Win Rate"             value={stats.winRate === null ? "—" : `${stats.winRate}%`}                              color={C.blue}   loading={kpiState === "loading"} />
        <StatCard label="Avg Scan-to-Quote"    value={stats.avgScanToQuote}                                                            color={C.purple} loading={kpiState === "loading"} />
      </div>
      {kpiState === "error" && kpiError && (
        <div
          role="status"
          style={{
            background: `${C.red}10`,
            border: `1px solid ${C.red}33`,
            color: C.red,
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 12,
            marginBottom: 24,
          }}
        >
          KPI sync failed — showing local data. ({kpiError})
        </div>
      )}

      {/* Recent projects */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.dark }}>
              Recent Projects
            </div>
            <div style={{ fontSize: 13, color: C.grayMd, marginTop: 2 }}>
              Jump back into what you were working on
            </div>
          </div>
          <button
            onClick={onOpenProjects}
            style={{
              background: "transparent",
              color: C.blue,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            View all →
          </button>
        </div>

        {recent.length === 0 ? (
          <div
            style={{
              background: C.card,
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: C.dark }}>
              No projects yet
            </div>
            <div style={{ fontSize: 13, color: C.grayMd, marginBottom: 16 }}>
              Create your first project to get started.
            </div>
            <button
              onClick={onNewProject}
              style={{
                background: C.blue,
                color: "#fff",
                border: "none",
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ＋ New Project
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {recent.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p)} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
          Quick Actions
        </div>
        <div style={{ fontSize: 13, color: C.grayMd, marginBottom: 14 }}>
          Shortcuts to common workflows
        </div>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          <ActionCard icon="＋" title="New Project" subtitle="Start a fresh estimate" onClick={onNewProject} color={C.blue} />
          <ActionCard icon="⚡" title="Upload Drawing" subtitle="Scan a PDF to auto-detect components" onClick={onNewScan} color={C.amber} />
          {onOpenRateLibrary && (
            <ActionCard icon="🏪" title="Rate Library" subtitle="Wholesaler + custom rates" onClick={onOpenRateLibrary} color={C.green} />
          )}
          {onOpenReports && (
            <ActionCard icon="📈" title="Reports" subtitle="Budget, hours, milestones" onClick={onOpenReports} color={C.purple} />
          )}
          {onOpenEmail && (
            <ActionCard icon="📧" title="Email Inbox" subtitle="Forward drawings by email" onClick={onOpenEmail} color={C.red} />
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; color: string; loading?: boolean }> = ({
  label,
  value,
  color,
  loading,
}) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 18,
    }}
  >
    <div style={{ fontSize: 11, color: C.grayMd, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
      {label}
    </div>
    {loading ? (
      <div
        aria-label="Loading"
        style={{
          height: 28,
          width: "60%",
          borderRadius: 6,
          background: `linear-gradient(90deg, ${C.border} 0%, #F8FAFC 50%, ${C.border} 100%)`,
          backgroundSize: "200% 100%",
          animation: "es-skeleton 1.4s ease-in-out infinite",
        }}
      />
    ) : (
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    )}
  </div>
);

// Inject the skeleton keyframes once. Scoped via a stable id so multiple
// dashboard mounts don't duplicate the rule.
if (typeof document !== "undefined" && !document.getElementById("es-kpi-skeleton-style")) {
  const styleEl = document.createElement("style");
  styleEl.id = "es-kpi-skeleton-style";
  styleEl.textContent = `@keyframes es-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(styleEl);
}

const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
  const palette = statusPalette(project.status);
  const accent = statusAccent(project.status);
  const latestEstimate = project.estimates[project.estimates.length - 1];

  return (
    <button
      onClick={onClick}
      className="es-project-card"
      style={{
        textAlign: "left",
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 0,
        cursor: "pointer",
        color: C.dark,
        overflow: "hidden",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ height: 4, background: accent }} />
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {project.name}
            </div>
            <div style={{ fontSize: 11, color: C.grayMd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {project.address || project.clientName || "—"}
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 20,
              background: `${palette.bg}18`,
              color: palette.bg,
              alignSelf: "flex-start",
              whiteSpace: "nowrap",
            }}
          >
            {palette.label}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
            marginTop: 4,
          }}
        >
          <Stat val={String(project.scans.length)} label="Versions" />
          <Stat val={latestEstimate ? `${latestEstimate.lineItems.length}` : "—"} label="Est. Items" />
          <Stat val={fmtDate(project.updatedAt)} label="Updated" />
        </div>
      </div>
    </button>
  );
};

const Stat: React.FC<{ val: string; label: string }> = ({ val, label }) => (
  <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
    <div style={{ fontSize: 10, color: C.grayMd, marginTop: 2 }}>{label}</div>
  </div>
);

const ActionCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  color: string;
}> = ({ icon, title, subtitle, onClick, color }) => (
  <button
    onClick={onClick}
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      display: "flex",
      alignItems: "center",
      gap: 14,
      cursor: "pointer",
      textAlign: "left",
      color: C.dark,
      transition: "box-shadow 0.15s, transform 0.15s",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-1px)";
      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${color}18`,
        color,
        fontSize: 22,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, color: C.dark }}>{title}</div>
      <div style={{ fontSize: 12, color: C.grayMd }}>{subtitle}</div>
    </div>
  </button>
);

export default DashboardScreen;
