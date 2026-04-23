import React, { useMemo } from "react";
import { useProjects, statusPalette, type Project } from "../contexts/ProjectContext";
import { useTenant } from "../contexts/TenantContext";

const C = {
  bg: "#0A1628",
  navy: "#0F1E35",
  card: "#132240",
  blue: "#1D6EFD",
  green: "#00C48C",
  amber: "#FFB020",
  red: "#FF4D4D",
  text: "#EDF2FF",
  muted: "#5C7A9E",
  border: "#1A3358",
  dim: "#8BA4C4",
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(fullName: string): string {
  const s = fullName.trim().split(/\s+/)[0] || "there";
  return s;
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

const DashboardScreen: React.FC<Props> = ({
  onOpenProjects,
  onOpenProject,
  onNewProject,
  onNewScan,
  onOpenRateLibrary,
  onOpenReports,
  onOpenEmail,
  onOpenSettings,
}) => {
  const { projects } = useProjects();
  const { tenant } = useTenant();

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
      .slice(0, 5);
  }, [projects]);

  const tenantName = tenant?.name || "Vesh Electrical";
  const userFirst = firstName(tenant?.name || "Vesh");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      {/* Header */}
      <div
        style={{
          background: C.navy,
          borderBottom: `1px solid ${C.border}`,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {greeting()}, {userFirst}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{tenantName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {onOpenRateLibrary && (
            <button onClick={onOpenRateLibrary} style={iconBtn} title="Rate Library">📚</button>
          )}
          {onOpenReports && (
            <button onClick={onOpenReports} style={iconBtn} title="Reports">📈</button>
          )}
          {onOpenEmail && (
            <button onClick={onOpenEmail} style={iconBtn} title="Email Inbox">📧</button>
          )}
          {onOpenSettings && (
            <button onClick={onOpenSettings} style={iconBtn} title="Settings">⚙️</button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          padding: "20px 24px 0",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <StatCard label="Total Projects" value={stats.total} color={C.blue} />
        <StatCard label="Active Projects" value={stats.active} color={C.green} />
        <StatCard label="Estimates This Month" value={stats.estimatesThisMonth} color={C.amber} />
        <StatCard label="Scans Used" value={stats.scansUsed} color={C.dim} />
      </div>

      {/* Recent projects */}
      <div style={{ padding: "24px 24px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 0.6 }}>
            RECENT PROJECTS
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
              borderRadius: 14,
              padding: "32px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              No projects yet
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
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
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              ＋ New Project
            </button>
          </div>
        ) : (
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto",
                padding: "10px 16px",
                fontSize: 11,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: 0.6,
                borderBottom: `1px solid ${C.border}`,
              }}
              className="dash-row"
            >
              <div>NAME</div>
              <div>CLIENT</div>
              <div>STATUS</div>
              <div>UPDATED</div>
              <div />
            </div>
            {recent.map((p, i) => {
              const palette = statusPalette(p.status);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto",
                    padding: "12px 16px",
                    borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : "none",
                    alignItems: "center",
                    fontSize: 13,
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: C.dim }}>{p.clientName || "—"}</div>
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: palette.bg,
                        color: palette.fg,
                      }}
                    >
                      {palette.label}
                    </span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{fmtDate(p.updatedAt)}</div>
                  <div>
                    <button
                      onClick={() => onOpenProject(p)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.blue}`,
                        color: C.blue,
                        padding: "5px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ padding: "28px 24px 40px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 12 }}>
          QUICK ACTIONS
        </div>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <ActionCard
            icon="＋"
            title="New Project"
            subtitle="Start a fresh estimate"
            onClick={onNewProject}
            color={C.blue}
          />
          <ActionCard
            icon="⚡"
            title="Upload Drawing"
            subtitle="Scan a PDF to auto-detect components"
            onClick={onNewScan}
            color={C.amber}
          />
          {onOpenRateLibrary && (
            <ActionCard
              icon="📚"
              title="Rate Library"
              subtitle="Wholesaler + custom rates"
              onClick={onOpenRateLibrary}
              color={C.green}
            />
          )}
          {onOpenReports && (
            <ActionCard
              icon="📈"
              title="Reports"
              subtitle="Budget, hours, milestones"
              onClick={onOpenReports}
              color={C.dim}
            />
          )}
          {onOpenEmail && (
            <ActionCard
              icon="📧"
              title="Email Inbox"
              subtitle="Forward drawings by email"
              onClick={onOpenEmail}
              color={C.red}
            />
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
      borderRadius: 14,
      padding: 16,
    }}
  >
    <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.6, marginBottom: 8 }}>
      {label.toUpperCase()}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
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
      borderRadius: 14,
      padding: 16,
      display: "flex",
      alignItems: "center",
      gap: 14,
      cursor: "pointer",
      textAlign: "left",
      color: C.text,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${color}22`,
        color,
        fontSize: 22,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{subtitle}</div>
    </div>
  </button>
);

const iconBtn: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  color: C.text,
  width: 40,
  height: 40,
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 16,
};

export default DashboardScreen;
