import React, { useMemo, useState } from "react";
import {
  useProjects,
  statusPalette,
  type Project,
  type ProjectStatus,
} from "../contexts/ProjectContext";

/**
 * ProjectsScreen (light theme — renders inside AppShell).
 * Content-only: the page title, subtitle, and "+ New Project" button
 * are delivered via AppShell's topbarActions slot from App.tsx.
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
};

type Filter = "all" | ProjectStatus;

interface Props {
  onBack?: () => void;
  onOpenProject: (project: Project) => void;
  /** External trigger for the "New Project" modal — so the topbar button in AppShell can open it. */
  openCreate?: boolean;
  onCloseCreate?: () => void;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

function statusAccent(status: string): string {
  switch (status) {
    case "Active":  return C.blue;
    case "Won":     return C.green;
    case "Lost":    return C.red;
    case "On Hold": return C.amber;
    default:        return C.purple;
  }
}

const ProjectsScreen: React.FC<Props> = ({
  onOpenProject,
  openCreate,
  onCloseCreate,
}) => {
  const { projects, createProject } = useProjects();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Allow parent (AppShell topbar) to open the create modal via a prop.
  const createOpen = openCreate || showCreate;
  const closeCreate = () => {
    setShowCreate(false);
    onCloseCreate?.();
  };

  const filters: Filter[] = ["all", "Active", "Won", "Lost", "On Hold"];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter(p => (filter === "all" ? true : p.status === filter))
      .filter(p => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [projects, filter, query]);

  const counts: Record<Filter, number> = {
    all: projects.length,
    Active: projects.filter(p => p.status === "Active").length,
    Won: projects.filter(p => p.status === "Won").length,
    Lost: projects.filter(p => p.status === "Lost").length,
    "On Hold": projects.filter(p => p.status === "On Hold").length,
  };

  return (
    <div>
      {/* Controls row: search + filter pills */}
      <div style={{ marginBottom: 18 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by project name, client or address"
          style={{
            width: "100%",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "9px 12px",
            color: C.dark,
            fontSize: 13,
            outline: "none",
            marginBottom: 12,
          }}
        />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map(f => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flexShrink: 0,
                  background: isActive ? C.blue : C.card,
                  border: `1.5px solid ${isActive ? C.blue : C.border}`,
                  color: isActive ? "#fff" : C.grayMd,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 20,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f === "all" ? `All (${counts.all})` : `${f} (${counts[f]})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            background: C.card,
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
            padding: "56px 20px",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: C.dark }}>
            {projects.length === 0
              ? "No projects yet — create your first one"
              : "No projects match your filter"}
          </div>
          {projects.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: 14,
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
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {visible.map(p => (
            <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p)} />
          ))}
        </div>
      )}

      {createOpen && (
        <CreateProjectModal
          onClose={closeCreate}
          onCreate={input => {
            const created = createProject(input);
            closeCreate();
            onOpenProject(created);
          }}
        />
      )}
    </div>
  );
};

const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
  const palette = statusPalette(project.status);
  const accent = statusAccent(project.status);
  const latestEstimate = project.estimates[project.estimates.length - 1];

  return (
    <button
      onClick={onClick}
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
              {project.clientName || "No client"}
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
        <div style={{ fontSize: 11, color: C.grayLt, minHeight: 14, marginBottom: 10 }}>
          {project.address || "No address"}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <Stat val={String(project.scans.length)} label="Versions" />
          <Stat
            val={latestEstimate ? String(latestEstimate.lineItems.length) : "—"}
            label="Last Estimate"
          />
          <Stat val={fmtDate(project.updatedAt)} label="Updated" />
        </div>
      </div>
    </button>
  );
};

const Stat: React.FC<{ val: string; label: string }> = ({ val, label }) => (
  <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: C.dark,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {val}
    </div>
    <div style={{ fontSize: 10, color: C.grayMd, marginTop: 2 }}>{label}</div>
  </div>
);

const CreateProjectModal: React.FC<{
  onClose: () => void;
  onCreate: (input: {
    name: string;
    clientName?: string;
    address?: string;
    status?: ProjectStatus;
  }) => void;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [clientName, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Active");

  const valid = name.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 500,
      }}
    >
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 440,
          color: C.dark,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>New Project</div>

        <Field label="Project name *">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Riverside Apartments"
            autoFocus
            style={inputStyle}
          />
        </Field>
        <Field label="Client name">
          <input
            value={clientName}
            onChange={e => setClient(e.target.value)}
            placeholder="Builder / Architect"
            style={inputStyle}
          />
        </Field>
        <Field label="Address">
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Site address"
            style={inputStyle}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ProjectStatus)}
            style={inputStyle}
          >
            <option value="Active">Active</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
            <option value="On Hold">On Hold</option>
          </select>
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: "transparent",
              color: C.grayMd,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => valid && onCreate({ name, clientName, address, status })}
            style={{
              flex: 1,
              background: valid ? C.blue : C.border,
              color: valid ? "#fff" : C.grayMd,
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#FFFFFF",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  color: C.dark,
  fontSize: 13,
  outline: "none",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div
      style={{
        fontSize: 11,
        color: C.grayMd,
        marginBottom: 6,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

export default ProjectsScreen;
