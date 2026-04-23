import React, { useMemo, useState } from "react";
import {
  useProjects,
  statusPalette,
  type Project,
  type ProjectStatus,
} from "../contexts/ProjectContext";

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

type Filter = "all" | ProjectStatus;

interface Props {
  onBack: () => void;
  onOpenProject: (project: Project) => void;
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

const ProjectsScreen: React.FC<Props> = ({ onBack, onOpenProject }) => {
  const { projects, createProject } = useProjects();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

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
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        color: C.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: C.navy,
          borderBottom: `1px solid ${C.border}`,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Projects</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {projects.length} total · {counts.Active} active
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: C.blue,
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>＋</span> New Project
        </button>
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "16px 20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by project name, client or address"
          style={{
            width: "100%",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 14px",
            color: C.text,
            fontSize: 14,
            outline: "none",
          }}
        />
        <div
          className="filter-tabs"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: 4,
          }}
        >
          {filters.map(f => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flexShrink: 0,
                  background: isActive ? C.blue : C.card,
                  border: `1px solid ${isActive ? C.blue : C.border}`,
                  color: isActive ? "#fff" : C.muted,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 20,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {f === "all" ? `All (${counts.all})` : `${f} (${counts[f]})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: "18px 20px 40px", flex: 1 }}>
        {visible.length === 0 ? (
          <div
            style={{
              marginTop: 40,
              textAlign: "center",
              background: C.card,
              border: `1px dashed ${C.border}`,
              borderRadius: 16,
              padding: "48px 20px",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
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
                  borderRadius: 10,
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
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
            }}
          >
            {visible.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p)} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreate={input => {
            const created = createProject(input);
            setShowCreate(false);
            onOpenProject(created);
          }}
        />
      )}
    </div>
  );
};

const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => {
  const palette = statusPalette(project.status);
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
        color: C.text,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {project.clientName || "No client"}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 20,
            background: palette.bg,
            color: palette.fg,
            alignSelf: "flex-start",
            whiteSpace: "nowrap",
          }}
        >
          {palette.label}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.dim, minHeight: 16 }}>
        {project.address || "No address"}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 10,
          borderTop: `1px solid ${C.border}`,
          fontSize: 11,
          color: C.muted,
        }}
      >
        <div>{project.estimates.length} estimates</div>
        <div>Updated {fmtDate(project.updatedAt)}</div>
      </div>
    </button>
  );
};

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
        background: "rgba(4,8,20,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: C.navy,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 20,
          width: "100%",
          maxWidth: 420,
          color: C.text,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
          New Project
        </div>

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

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: "transparent",
              color: C.muted,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
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
              background: valid ? C.blue : C.card,
              color: valid ? "#fff" : C.muted,
              border: "none",
              borderRadius: 10,
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
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "10px 12px",
  color: C.text,
  fontSize: 14,
  outline: "none",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 700, letterSpacing: 0.4 }}>
      {label.toUpperCase()}
    </div>
    {children}
  </div>
);

export default ProjectsScreen;
