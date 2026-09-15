import React, { useMemo } from "react";
import { useProjects, estimateTotals, type Project, type ProjectEstimate } from "../contexts/ProjectContext";
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

interface EstimateRow {
  project: Project;
  estimate: ProjectEstimate;
  total: number;
}

interface Props {
  onOpenEstimate: (projectId: string, estimateId: string) => void;
  onNewScan: () => void;
  onNewProject: () => void;
}

const fmtMoney = (n: number) =>
  `$${Math.round(n).toLocaleString("en-AU")}`;
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

const EstimatesIndexScreen: React.FC<Props> = ({ onOpenEstimate, onNewScan, onNewProject }) => {
  const { projects } = useProjects();

  const rows = useMemo<EstimateRow[]>(() => {
    const list: EstimateRow[] = [];
    for (const project of projects) {
      for (const estimate of project.estimates) {
        list.push({ project, estimate, total: estimateTotals(estimate).total });
      }
    }
    return list.sort((a, b) => (a.estimate.updatedAt < b.estimate.updatedAt ? 1 : -1));
  }, [projects]);

  const drafted = rows.filter(r => !r.estimate.locked).length;
  const locked = rows.filter(r => r.estimate.locked).length;
  const winValue = rows.filter(r => r.estimate.locked).reduce((s, r) => s + r.total, 0);

  return (
    <div>
      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
          <MiniStat label="Drafted" value={String(drafted)} />
          <MiniStat label="Finalised" value={String(locked)} tint={C.green} />
          <MiniStat label="Pipeline" value={fmtMoney(rows.reduce((s, r) => s + r.total, 0))} tint={C.blue} />
          <MiniStat label="Finalised value" value={winValue > 0 ? fmtMoney(winValue) : "—"} tint={C.green} />
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          }
          title="No estimates yet"
          description="Create a project and run a scan, or start a blank estimate from a project. Quotes stay here so you can reopen the editor any time."
          actions={[
            { label: "Start a scan", onClick: onNewScan, primary: true },
            { label: "New project", onClick: onNewProject, primary: false },
          ]}
        />
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Reference", "Project", "Client", "Status", "Updated", "Total"].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Total" ? "right" : "left",
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
              {rows.map(({ project, estimate, total }) => (
                <tr
                  key={estimate.id}
                  onClick={() => onOpenEstimate(project.id, estimate.id)}
                  style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#253347"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 14px", fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, color: C.blue }}>
                    {estimate.reference || estimate.number}
                  </td>
                  <td style={{ padding: "12px 14px", color: C.text, fontWeight: 600 }}>{project.name}</td>
                  <td style={{ padding: "12px 14px", color: C.muted }}>{project.clientName || "—"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        background: estimate.locked ? `${C.green}18` : `${C.amber}18`,
                        color: estimate.locked ? C.green : C.amber,
                      }}
                    >
                      {estimate.locked ? "Locked" : "Draft"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", color: C.muted }}>{fmtDate(estimate.updatedAt)}</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, color: C.text }}>
                    {fmtMoney(total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: string; tint?: string }> = ({ label, value, tint }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" }}>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.7, color: C.dim, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: tint || C.text }}>{value}</div>
  </div>
);

export default EstimatesIndexScreen;
