import React, { useEffect, useMemo, useState } from "react";
import { useProjects, estimateTotals, statusPalette, type Project } from "../contexts/ProjectContext";
import {
  fetchDashboardKpis,
  formatScanToQuote,
  type DashboardKpis,
} from "../services/dashboardKpiService";

/**
 * DashboardScreen — premium dark-blue SaaS upgrade.
 * KPI strip, recent projects grid, quick-action shelf.
 * The greeting/topbar lives in AppShell.
 */

const C = {
  // Surface hierarchy
  pageBg:    "#0f172a",   // slate-900 — page background (matches shell)
  cardBg:    "#1e293b",   // slate-800 — primary card surface
  cardBg2:   "#162032",   // slightly darker card variant
  cardHov:   "#253347",   // card hover
  border:    "#334155",   // slate-700
  borderLt:  "#1e3a5c",   // subtle border
  // Brand
  blue:      "#3b82f6",   // primary blue
  blueDk:    "#1d4ed8",   // dark blue
  blueGlow:  "#3b82f620", // blue glow
  teal:      "#0ea5e9",   // teal accent
  // Status
  green:     "#10b981",
  amber:     "#f59e0b",
  red:       "#ef4444",
  purple:    "#8b5cf6",
  // Text
  textPrim:  "#f1f5f9",   // slate-100
  textSec:   "#94a3b8",   // slate-400
  textMut:   "#64748b",   // slate-500
  white:     "#ffffff",
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

function statusAccent(status: string): string {
  switch (status) {
    case "Active":  return C.blue;
    case "Won":     return C.green;
    case "Lost":    return C.red;
    case "On Hold": return C.amber;
    default:        return C.purple;
  }
}

// ─── KPI icon glyphs (inline SVG paths via data-uri alternative) ─────────────
const KPI_ICONS: Record<string, React.ReactNode> = {
  estimates: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  pending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  winrate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  speed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
};

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

  const useLive = live !== null;
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
    <>
      <style>{DASHBOARD_CSS}</style>
      <div className="es-dash">

        {/* ── KPI strip ────────────────────────────────────────── */}
        <div className="es-kpi-grid">
          <KpiCard
            label="Estimates This Month"
            value={String(stats.estimatesThisMonth)}
            color={C.amber}
            icon={KPI_ICONS.estimates}
            loading={kpiState === "loading"}
          />
          <KpiCard
            label="Pending Value"
            value={stats.pendingValue > 0 ? `$${(stats.pendingValue / 1000).toFixed(0)}k` : "$0"}
            color={C.green}
            icon={KPI_ICONS.pending}
            loading={kpiState === "loading"}
          />
          <KpiCard
            label="Win Rate"
            value={stats.winRate === null ? "—" : `${stats.winRate}%`}
            color={C.blue}
            icon={KPI_ICONS.winrate}
            loading={kpiState === "loading"}
          />
          <KpiCard
            label="Avg Scan-to-Quote"
            value={stats.avgScanToQuote}
            color={C.purple}
            icon={KPI_ICONS.speed}
            loading={kpiState === "loading"}
          />
        </div>

        {kpiState === "error" && kpiError && (
          <div className="es-kpi-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            KPI sync failed — showing local data. ({kpiError})
          </div>
        )}

        {/* ── Recent projects ───────────────────────────────────── */}
        <section className="es-section">
          <div className="es-section-header">
            <div>
              <div className="es-section-title">Recent Projects</div>
              <div className="es-section-sub">Jump back into what you were working on</div>
            </div>
            <button className="es-link-btn" onClick={onOpenProjects}>
              View all
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="es-empty-state">
              <div className="es-empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="es-empty-title">No projects yet</div>
              <div className="es-empty-sub">Create your first project to get started.</div>
              <button className="es-btn-primary" onClick={onNewProject}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Project
              </button>
            </div>
          ) : (
            <div className="es-project-grid">
              {recent.map(p => (
                <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p)} />
              ))}
            </div>
          )}
        </section>

        {/* ── Quick actions ─────────────────────────────────────── */}
        <section className="es-section">
          <div className="es-section-header">
            <div>
              <div className="es-section-title">Quick Actions</div>
              <div className="es-section-sub">Shortcuts to common workflows</div>
            </div>
          </div>
          <div className="es-action-shelf">
            <ActionTile
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
              title="New Project"
              subtitle="Start a fresh estimate"
              onClick={onNewProject}
              color={C.blue}
            />
            <ActionTile
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
              title="Upload Drawing"
              subtitle="Scan a PDF to auto-detect components"
              onClick={onNewScan}
              color={C.amber}
            />
            {onOpenRateLibrary && (
              <ActionTile
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
                title="Rate Library"
                subtitle="Wholesaler + custom rates"
                onClick={onOpenRateLibrary}
                color={C.green}
              />
            )}
            {onOpenReports && (
              <ActionTile
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                title="Reports"
                subtitle="Budget, hours, milestones"
                onClick={onOpenReports}
                color={C.purple}
              />
            )}
            {onOpenEmail && (
              <ActionTile
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                title="Email Inbox"
                subtitle="Forward drawings by email"
                onClick={onOpenEmail}
                color={C.teal}
              />
            )}
          </div>
        </section>

      </div>
    </>
  );
};

// ─── KpiCard ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
  loading?: boolean;
}> = ({ label, value, color, icon, loading }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="es-kpi-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? color + "55" : C.border,
        boxShadow: hovered ? `0 0 0 1px ${color}33, 0 8px 24px rgba(0,0,0,0.3)` : "0 1px 3px rgba(0,0,0,0.2)",
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 3, background: color, borderRadius: "4px 4px 0 0", margin: "-1px -1px 0", position: "relative", top: 0 }} />

      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.textMut,
            lineHeight: 1.2,
          }}>
            {label}
          </div>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: color + "18",
            color,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {icon}
          </div>
        </div>

        {loading ? (
          <div className="es-skeleton" style={{ height: 32, width: "55%", borderRadius: 6 }} />
        ) : (
          <div style={{
            fontSize: 30,
            fontWeight: 800,
            color: C.textPrim,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
};

// Inject skeleton keyframes once
if (typeof document !== "undefined" && !document.getElementById("es-kpi-skeleton-style")) {
  const styleEl = document.createElement("style");
  styleEl.id = "es-kpi-skeleton-style";
  styleEl.textContent = `@keyframes es-skeleton { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }`;
  document.head.appendChild(styleEl);
}

// ─── ProjectCard ─────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
  const palette = statusPalette(project.status);
  const accent = statusAccent(project.status);
  const latestEstimate = project.estimates[project.estimates.length - 1];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="es-project-card"
      style={{
        background: hovered ? C.cardHov : C.cardBg,
        borderColor: hovered ? accent + "66" : C.border,
        boxShadow: hovered
          ? `0 0 0 1px ${accent}33, 0 8px 28px rgba(0,0,0,0.35)`
          : "0 1px 3px rgba(0,0,0,0.2)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Colour-coded top stripe */}
      <div style={{ height: 3, background: accent, borderRadius: "4px 4px 0 0", margin: "-1px -1px 0", position: "relative", top: 0 }} />

      <div style={{ padding: "14px 16px 16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.textPrim,
              marginBottom: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {project.name}
            </div>
            <div style={{
              fontSize: 11,
              color: C.textMut,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {project.address || project.clientName || "—"}
            </div>
          </div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 20,
            background: accent + "20",
            color: accent,
            border: `1px solid ${accent}44`,
            alignSelf: "flex-start",
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
          }}>
            {palette.label}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex",
          gap: 0,
          paddingTop: 10,
          borderTop: `1px solid ${C.border}`,
          marginTop: 2,
        }}>
          <MiniStat val={String(project.scans.length)} label="Versions" />
          <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "0 8px" }} />
          <MiniStat val={latestEstimate ? `${latestEstimate.lineItems.length}` : "—"} label="Est. Items" />
          <div style={{ width: 1, background: C.border, alignSelf: "stretch", margin: "0 8px" }} />
          <MiniStat val={fmtDate(project.updatedAt)} label="Updated" />
        </div>
      </div>
    </button>
  );
};

const MiniStat: React.FC<{ val: string; label: string }> = ({ val, label }) => (
  <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</div>
    <div style={{ fontSize: 10, color: C.textMut, marginTop: 1 }}>{label}</div>
  </div>
);

// ─── ActionTile ──────────────────────────────────────────────────────────────

const ActionTile: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  color: string;
}> = ({ icon, title, subtitle, onClick, color }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="es-action-tile"
      style={{
        background: hovered ? C.cardHov : C.cardBg,
        borderColor: hovered ? color + "66" : C.border,
        boxShadow: hovered ? `0 0 0 1px ${color}33, 0 6px 20px rgba(0,0,0,0.3)` : "0 1px 3px rgba(0,0,0,0.2)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <div style={{
        width: 42, height: 42,
        borderRadius: 10,
        background: color + "18",
        border: `1px solid ${color}30`,
        color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        transition: "background 0.15s",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrim, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.textMut, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      <div style={{
        color: hovered ? color : C.textMut,
        transition: "color 0.15s, transform 0.15s",
        transform: hovered ? "translateX(2px)" : "translateX(0)",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </button>
  );
};

export default DashboardScreen;

// ─── Dashboard CSS ────────────────────────────────────────────────────────────
const DASHBOARD_CSS = `
.es-dash {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* KPI grid */
.es-kpi-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.es-kpi-card {
  background: ${C.cardBg};
  border: 1px solid ${C.border};
  border-radius: 12px;
  overflow: hidden;
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

/* KPI error banner */
.es-kpi-error {
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${C.red}0f;
  border: 1px solid ${C.red}33;
  color: ${C.red};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  margin-top: -12px;
}

/* Skeleton */
.es-skeleton {
  background: linear-gradient(90deg, ${C.border} 0%, #2d3d52 50%, ${C.border} 100%);
  background-size: 200% 100%;
  animation: es-skeleton 1.4s ease-in-out infinite;
  border-radius: 6px;
}

/* Section */
.es-section {}
.es-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.es-section-title {
  font-size: 16px;
  font-weight: 700;
  color: ${C.textPrim};
  line-height: 1.2;
}
.es-section-sub {
  font-size: 12px;
  color: ${C.textMut};
  margin-top: 3px;
}

/* Link button */
.es-link-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  color: ${C.blue};
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.15s;
}
.es-link-btn:hover {
  color: #60a5fa;
}

/* Primary button */
.es-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: ${C.blue};
  color: #fff;
  border: none;
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.es-btn-primary:hover {
  background: ${C.blueDk};
  transform: translateY(-1px);
}

/* Empty state */
.es-empty-state {
  background: ${C.cardBg};
  border: 1px dashed ${C.border};
  border-radius: 12px;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}
.es-empty-icon {
  width: 52px; height: 52px;
  border-radius: 14px;
  background: ${C.blue}18;
  color: ${C.blue};
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}
.es-empty-title {
  font-size: 15px;
  font-weight: 700;
  color: ${C.textPrim};
}
.es-empty-sub {
  font-size: 13px;
  color: ${C.textMut};
  margin-bottom: 8px;
}

/* Project grid */
.es-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.es-project-card {
  text-align: left;
  border: 1px solid;
  border-radius: 12px;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition: background 0.15s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}

/* Action shelf */
.es-action-shelf {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.es-action-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid;
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
}
`;
