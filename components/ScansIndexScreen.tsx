import React, { useMemo } from "react";
import { useProjects, type Project, type ProjectScan } from "../contexts/ProjectContext";
import EmptyState from "./shared/EmptyState";

const C = {
  card: "#1e293b",
  border: "#334155",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  text: "#f1f5f9",
  muted: "#94a3b8",
  dim: "#64748b",
  bg: "#0f172a",
};

interface ScanRow {
  project: Project;
  scan: ProjectScan;
}

interface Props {
  onOpenProject: (projectId: string) => void;
  onNewScan: () => void;
}

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const ScansIndexScreen: React.FC<Props> = ({ onOpenProject, onNewScan }) => {
  const { projects } = useProjects();

  const rows = useMemo<ScanRow[]>(() => {
    const list: ScanRow[] = [];
    for (const project of projects) {
      for (const scan of project.scans) {
        list.push({ project, scan });
      }
    }
    return list.sort((a, b) => (a.scan.scannedAt < b.scan.scannedAt ? 1 : -1));
  }, [projects]);

  return (
    <div>
      {rows.length === 0 ? (
        <EmptyState
          icon={
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          }
          title="No scans yet"
          description="Upload a floor-plan PDF and ElectraScan will detect electrical symbols, then draft a costed estimate."
          actions={[{ label: "Start a scan", onClick: onNewScan }]}
        />
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["File", "Project", "Client", "Items", "Version", "Scanned"].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Items" || h === "Version" ? "right" : "left",
                      padding: "10px 14px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      color: C.dim,
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, scan }) => (
                <tr
                  key={scan.id}
                  onClick={() => onOpenProject(project.id)}
                  style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#253347"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 14px", color: C.text, fontWeight: 600 }}>
                    {scan.fileName}
                  </td>
                  <td style={{ padding: "12px 14px", color: C.text }}>{project.name}</td>
                  <td style={{ padding: "12px 14px", color: C.muted }}>{project.clientName || "—"}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: C.text }}>
                    {scan.componentCount}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: C.muted }}>
                    v{scan.versionNumber}
                  </td>
                  <td style={{ padding: "12px 14px", color: C.muted }}>{fmtDateTime(scan.scannedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScansIndexScreen;
