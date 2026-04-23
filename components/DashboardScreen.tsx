import React, { useMemo } from "react";
import { useProjects, statusPalette, type Project } from "../contexts/ProjectContext";

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

  const stats = useMemo(() => {
    const activeCount = projects.filter(p => p.status === "Active").length;
    const thisMonth = new Date();
    const monthKey = `${thisMonth.getFullYear()}-${thisMonth.getMonth()}`;
    const estimatesThisMonth = projects.reduce((sum, p) => {
      return (
        sum +
        p.estimates.filter(e => {
          const d = new Date(e.createdAt);
          return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
        }).length
      );
    }, 0);
    const scansUsed = projects.reduce((sum, p) => sum + p.scans.length, 0);
    return {
      total: projects.length,
      active: activeCount,
      estimatesThisMonth,
      scansUsed,
    };
  }, [projects]);

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
          marginBottom: 24,
        }}
      >
        <StatCard label="Total Projects"         value={stats.total}              color={C.blue} />
        <StatCard label="Active Projects"        value={stats.active}             color={C.green} />
        <StatCard label="Estimates This Month"   value={stats.estimatesThisMonth} color={C.amber} />
        <StatCard label="Scans Used"             value={stats.scansUsed}          color={C.purple} />
      </div>

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

const StatCard: React.FC<{ label: string; value: number | string; color: string }> = ({
  label,
  value,
  color,
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
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
  </div>
);

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
