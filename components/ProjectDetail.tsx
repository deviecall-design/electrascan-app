import React, { useMemo, useState } from "react";
import {
  useProjects,
  statusPalette,
  estimateTotals,
  makeId,
  type Project,
  type ProjectStatus,
  type ProjectScan,
  type ProjectEstimate,
  type EstimateLineItem,
  type ApprovalStatus,
} from "../contexts/ProjectContext";
import ProjectEstimateEditor from "./ProjectEstimateEditor";
import ApprovalsScreen, { type ApprovalEstimateLike } from "./ApprovalsScreen";
import VariationReport, {
  type VariationEstimateLike,
  type VariationLineItem,
} from "./VariationReport";
import {
  detectElectricalComponents,
  type DetectionResult,
  type DetectedComponent,
} from "../analyze_pdf";
import { peekNextReference } from "../services/estimateReferenceService";

// Light-theme palette (renders inside AppShell's light content area).
const C = {
  bg: "#F0F4F8",
  navy: "#0D1B2A",
  card: "#FFFFFF",
  blue: "#1D6EFD",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  dim: "#94A3B8",
};

type Tab = "overview" | "upload" | "estimate" | "schedule" | "approvals" | "variations";

interface Props {
  projectId: string;
  onBack: () => void;
}

const fmtMoney = (n: number) =>
  `$${Math.round(n).toLocaleString("en-AU")}`;
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

const LABELS: Record<string, string> = {
  GPO_STANDARD: "Power Point",
  GPO_DOUBLE: "Double Power Point",
  DOWNLIGHT_RECESSED: "Downlight",
  SWITCHING_STANDARD: "Light Switch",
  SWITCHBOARD_MAIN: "Main Switchboard",
  DATA_CAT6: "Data Point",
  SECURITY_CCTV: "CCTV Camera",
  EV_CHARGER: "EV Charger",
};

const ProjectDetail: React.FC<Props> = ({ projectId, onBack }) => {
  const { projects, updateProject, addScanToProject, saveEstimate, newEstimateId } = useProjects();
  const project = projects.find(p => p.id === projectId);
  const [tab, setTab] = useState<Tab>("overview");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project?.name ?? "");

  if (!project) {
    return (
      <div style={{ padding: 40, color: C.muted }}>
        Project not found.
        <button
          onClick={onBack}
          style={{
            marginLeft: 10,
            background: "transparent",
            color: C.blue,
            border: "none",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const saveName = () => {
    const n = nameDraft.trim();
    if (n && n !== project.name) updateProject(project.id, { name: n });
    setEditingName(false);
  };

  const setStatus = (s: ProjectStatus) => updateProject(project.id, { status: s });

  const palette = statusPalette(project.status);
  const latestEstimate = project.estimates[project.estimates.length - 1];
  const latestScan = project.scans[project.scans.length - 1];

  return (
    <div>
      {/* Project name + status header (sits inside AppShell's light content) */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setNameDraft(project.name);
                  setEditingName(false);
                }
              }}
              style={{
                flex: 1,
                background: "#fff",
                color: C.text,
                border: `1px solid ${C.border}`,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 700,
              }}
            />
          ) : (
            <div
              onClick={() => {
                setNameDraft(project.name);
                setEditingName(true);
              }}
              title="Click to rename"
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                color: C.text,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {project.name}
              <span style={{ fontSize: 12, color: C.dim, fontWeight: 400 }}>✎</span>
            </div>
          )}
        </div>
        <select
          value={project.status}
          onChange={e => setStatus(e.target.value as ProjectStatus)}
          style={{
            background: palette.bg,
            color: palette.fg,
            border: "none",
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {["Active", "Won", "Lost", "On Hold"].map(s => (
            <option key={s} value={s} style={{ color: "#000" }}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "0 8px",
          marginBottom: 16,
          display: "flex",
          gap: 0,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {(
          [
            ["overview", "Overview"],
            ["upload", "Upload"],
            ["estimate", "Estimate"],
            ["schedule", "Schedule"],
            ["approvals", "Approvals"],
            ["variations", "Variations"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              background: "transparent",
              border: "none",
              color: tab === id ? C.blue : C.muted,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              borderBottom: `2px solid ${tab === id ? C.blue : "transparent"}`,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "overview" && (
          <OverviewTab project={project} latestEstimate={latestEstimate} latestScan={latestScan} />
        )}
        {tab === "upload" && (
          <UploadTab
            project={project}
            onScanSaved={() => setTab("estimate")}
            addScan={(scan, detection) => {
              const saved = addScanToProject(project.id, scan);
              // Auto-create/update estimate from detected components.
              if (detection) {
                const lineItems = detection.components.map(c => ({
                  id: makeId(),
                  description:
                    c.catalogue_item_name ?? LABELS[c.type] ?? c.type,
                  category: categorise(c.type),
                  qty: c.quantity,
                  unitPrice: c.unit_price,
                  unit: "EA",
                  room: c.room,
                }));
                // Add to existing draft estimate if one exists, else create
                const existing = project.estimates.find(e => !e.locked);
                if (existing) {
                  saveEstimate(project.id, {
                    ...existing,
                    lineItems: [...existing.lineItems, ...lineItems],
                    updatedAt: new Date().toISOString(),
                  });
                } else {
                  // Reference is allocated server-side via /api/estimates/create
                  // when the row is persisted; for the local draft we ask
                  // Supabase for the next sequence so the user sees the
                  // expected reference immediately. peekNextReference
                  // resolves to EST-YYMM-0001 on any error path.
                  const id = newEstimateId();
                  const baseEst: ProjectEstimate = {
                    id,
                    number: `EST-${new Date().getFullYear()}-${String(
                      Math.floor(Math.random() * 900) + 100,
                    )}-001`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    margin: 15,
                    categoryMargins: {},
                    gstRate: 10,
                    locked: false,
                    lineItems,
                    cableRuns: [],
                    versions: [],
                  };
                  saveEstimate(project.id, baseEst);
                  void peekNextReference().then(reference => {
                    saveEstimate(project.id, { ...baseEst, reference });
                  });
                }
              }
              return saved;
            }}
          />
        )}
        {tab === "estimate" && (
          <EstimateTab
            project={project}
            onCreateEstimate={() => {
              const id = newEstimateId();
              const est: ProjectEstimate = {
                id,
                number: `EST-${new Date().getFullYear()}-${String(
                  Math.floor(Math.random() * 900) + 100,
                )}-001`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                margin: 15,
                categoryMargins: {},
                gstRate: 10,
                locked: false,
                lineItems: [],
                cableRuns: [],
                versions: [],
              };
              saveEstimate(project.id, est);
              void peekNextReference().then(reference => {
                saveEstimate(project.id, { ...est, reference });
              });
            }}
          />
        )}
        {tab === "schedule" && <ScheduleTab project={project} onUpload={() => setTab("upload")} />}
        {tab === "approvals" && (
          <ApprovalsTab
            project={project}
            onBackToOverview={() => setTab("overview")}
            onStatusChange={(s) =>
              updateProject(project.id, {
                approvalStatus: s,
                approvalUpdatedAt: new Date().toISOString(),
              })
            }
          />
        )}
        {tab === "variations" && (
          <VariationsTab
            project={project}
            onBackToOverview={() => setTab("overview")}
            onOpenUpload={() => setTab("upload")}
          />
        )}
      </div>
    </div>
  );
};

// ─── Approvals Tab ─────────────────────────────────────────
function toApprovalEstimate(e: ProjectEstimate): ApprovalEstimateLike {
  const t = estimateTotals(e);
  return {
    id: e.id,
    number: e.number,
    total: Math.round(t.total),
    componentCount: e.lineItems.length,
    date: e.createdAt,
    status: e.locked ? "locked" : "draft",
  };
}

const ApprovalsTab: React.FC<{
  project: Project;
  onBackToOverview: () => void;
  onStatusChange: (status: ApprovalStatus) => void;
}> = ({ project, onBackToOverview, onStatusChange }) => {
  const ests = project.estimates;
  if (ests.length === 0) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 14,
          padding: "36px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          No estimate to approve yet
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Create or upload an estimate to start the approval workflow.
        </div>
      </div>
    );
  }
  const current = toApprovalEstimate(ests[ests.length - 1]);
  const prior = ests.length >= 2 ? toApprovalEstimate(ests[ests.length - 2]) : undefined;
  const initialStatus: "pending" | "approved" =
    project.approvalStatus === "approved" ? "approved" : "pending";

  return (
    <ApprovalsScreen
      embedded
      projectName={project.name}
      projectSummary={`${project.name}${project.clientName ? ` · ${project.clientName}` : ""}`}
      currentEstimate={current}
      priorEstimate={prior}
      initialStatus={initialStatus}
      localStorageKey={`electrascan_approvals_${project.id}`}
      onStatusChange={onStatusChange}
      onBack={onBackToOverview}
    />
  );
};

// ─── Variations Tab ────────────────────────────────────────
function toVariationLineItems(items: EstimateLineItem[]): VariationLineItem[] {
  return items.map(li => ({
    description: li.description,
    room: li.room ?? "General",
    qty: li.qty,
    unitPrice: li.unitPrice,
  }));
}

function toVariationEstimate(e: ProjectEstimate): VariationEstimateLike {
  const t = estimateTotals(e);
  return {
    id: e.id,
    number: e.number,
    total: Math.round(t.total),
    subtotal: Math.round(t.subtotal),
    date: e.createdAt,
    lineItems: toVariationLineItems(e.lineItems),
  };
}

const VariationsTab: React.FC<{
  project: Project;
  onBackToOverview: () => void;
  onOpenUpload: () => void;
}> = ({ project, onBackToOverview, onOpenUpload }) => {
  // Prefer two distinct estimate records. Fall back to version snapshots on
  // the latest estimate when only one estimate has been created.
  const ests = project.estimates;
  let previous: VariationEstimateLike | undefined;
  let current: VariationEstimateLike | undefined;

  if (ests.length >= 2) {
    previous = toVariationEstimate(ests[ests.length - 2]);
    current = toVariationEstimate(ests[ests.length - 1]);
  } else if (ests.length === 1 && ests[0].versions.length >= 1) {
    const latest = ests[0];
    const snap = latest.versions[latest.versions.length - 1];
    // Recompute totals from the version snapshot using the parent estimate's GST rate.
    const snapTotals = estimateTotals({
      ...latest,
      lineItems: snap.snapshot.lineItems,
      margin: snap.snapshot.margin,
      categoryMargins: snap.snapshot.categoryMargins,
      cableRuns: snap.snapshot.cableRuns,
    });
    previous = {
      id: snap.id,
      number: `${latest.number} · ${snap.label}`,
      total: Math.round(snapTotals.total),
      subtotal: Math.round(snapTotals.subtotal),
      date: snap.savedAt,
      lineItems: toVariationLineItems(snap.snapshot.lineItems),
    };
    current = toVariationEstimate(latest);
  }

  if (!previous || !current) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 14,
          padding: "36px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Variations locked
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.muted,
            maxWidth: 420,
            margin: "0 auto 14px",
            lineHeight: 1.55,
          }}
        >
          Variations require at least 2 estimate versions. Save a revised
          estimate to unlock.
        </div>
        <button
          onClick={onOpenUpload}
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
          Upload a new drawing
        </button>
      </div>
    );
  }

  return (
    <VariationReport
      embedded
      projectName={project.name}
      previous={previous}
      current={current}
      onBack={onBackToOverview}
      onOpenScan={onOpenUpload}
    />
  );
};

// ─── Overview Tab ──────────────────────────────────────────
const OverviewTab: React.FC<{
  project: Project;
  latestEstimate?: ProjectEstimate;
  latestScan?: ProjectScan;
}> = ({ project, latestEstimate, latestScan }) => {
  const totals = latestEstimate
    ? estimateTotals(latestEstimate)
    : null;

  // Build a flat version history from scans + estimates (+ versions), newest first.
  const history = useMemo(() => {
    type HistoryItem = {
      type: "scan" | "estimate" | "version";
      id: string;
      at: string;
      label: string;
      detail: string;
    };
    const items: HistoryItem[] = [];
    project.scans.forEach(s =>
      items.push({
        type: "scan",
        id: s.id,
        at: s.scannedAt,
        label: `Scan v${s.versionNumber} — ${s.fileName}`,
        detail: `${s.componentCount} components · ${fmtMoney(s.subtotal)} detected`,
      }),
    );
    project.estimates.forEach(e => {
      items.push({
        type: "estimate",
        id: e.id,
        at: e.createdAt,
        label: `Estimate ${e.number}`,
        detail: `${e.lineItems.length} line items${e.locked ? " · 🔒 locked" : ""}`,
      });
      e.versions.forEach(v =>
        items.push({
          type: "version",
          id: v.id,
          at: v.savedAt,
          label: `Version snapshot (${e.number})`,
          detail: v.label,
        }),
      );
    });
    return items.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [project]);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: 18,
        }}
      >
        <MetaCard label="Client" value={project.clientName || "—"} />
        <MetaCard label="Address" value={project.address || "—"} />
        <MetaCard label="Created" value={fmtDate(project.createdAt)} />
        <MetaCard label="Scans" value={String(project.scans.length)} />
        <MetaCard
          label="Latest Estimate"
          value={latestEstimate ? fmtMoney(totals?.total ?? 0) : "—"}
        />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.6, marginBottom: 10 }}>
        VERSION HISTORY
      </div>
      {history.length === 0 ? (
        <div
          style={{
            background: C.card,
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
            padding: "24px 20px",
            color: C.muted,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          No activity yet. Upload a drawing or start an estimate to build history.
        </div>
      ) : (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {history.map((h, i) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 16px",
                borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background:
                    h.type === "scan"
                      ? `${C.blue}22`
                      : h.type === "version"
                      ? `${C.amber}22`
                      : `${C.green}22`,
                  color:
                    h.type === "scan"
                      ? C.blue
                      : h.type === "version"
                      ? C.amber
                      : C.green,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {h.type === "scan" ? "📄" : h.type === "version" ? "🕒" : "📝"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.label}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{h.detail}</div>
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>{fmtDateTime(h.at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MetaCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 14,
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        letterSpacing: 0.6,
        marginBottom: 6,
      }}
    >
      {label.toUpperCase()}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
  </div>
);

// ─── Upload Tab ────────────────────────────────────────────
const UploadTab: React.FC<{
  project: Project;
  onScanSaved: () => void;
  addScan: (
    scan: Omit<ProjectScan, "id" | "scannedAt" | "versionNumber">,
    detection?: DetectionResult,
  ) => ProjectScan | undefined;
}> = ({ project, onScanSaved, addScan }) => {
  const [status, setStatus] = useState<"idle" | "scanning" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.type.includes("pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    setStatus("scanning");
    setError(null);
    try {
      const detection = await detectElectricalComponents(
        file,
        `${project.scans.length + 1}`.padStart(3, "0"),
      );
      const subtotal = detection.components.reduce(
        (s: number, c: DetectedComponent) => s + c.line_total,
        0,
      );
      addScan(
        {
          fileName: file.name,
          componentCount: detection.components.length,
          subtotal,
          detectionResult: detection,
        },
        detection,
      );
      setStatus("idle");
      onScanSaved();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Detection failed.");
    }
  };

  return (
    <div>
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          Upload a drawing for {project.name}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>
          ElectraScan reads the legend, detects every component, and appends
          results to this project. Each scan is versioned — current version will
          be v{project.scans.length + 1}.
        </div>
      </div>

      {status === "scanning" ? (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Scanning drawing…</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Reading legend symbols then scanning every room.
          </div>
        </div>
      ) : (
        <label style={{ display: "block", cursor: "pointer" }}>
          <div
            onDragOver={e => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            style={{
              background: drag ? "rgba(29,110,253,0.04)" : C.card,
              border: `2px dashed ${drag ? C.blue : C.border}`,
              borderRadius: 18,
              padding: "40px 20px",
              textAlign: "center",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Drop PDF here</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
              or click to choose
            </div>
            <span
              style={{
                display: "inline-block",
                background: C.blue,
                color: "#fff",
                padding: "10px 22px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
              }}
            >
              Choose PDF
            </span>
          </div>
          <input
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
      )}

      {error && (
        <div
          style={{
            marginTop: 14,
            background: `${C.red}22`,
            border: `1px solid ${C.red}`,
            color: C.red,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 280,
            overflowY: "auto",
            fontFamily: error.includes("Pass 1 response") ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Detection error</div>
          {error}
        </div>
      )}

      {project.scans.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            SCAN HISTORY
          </div>
          {project.scans
            .slice()
            .reverse()
            .map(s => (
              <div
                key={s.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    v{s.versionNumber} · {s.fileName}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {fmtDateTime(s.scannedAt)} · {s.componentCount} components ·{" "}
                    {fmtMoney(s.subtotal)}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

// ─── Estimate Tab ──────────────────────────────────────────
const EstimateTab: React.FC<{
  project: Project;
  onCreateEstimate: () => void;
}> = ({ project, onCreateEstimate }) => {
  const latest = project.estimates[project.estimates.length - 1];
  if (!latest) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 14,
          padding: "36px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          No estimates yet
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Create a blank estimate or upload a drawing to auto-populate one.
        </div>
        <button
          onClick={onCreateEstimate}
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
          ＋ New Estimate
        </button>
      </div>
    );
  }
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {latest.reference && (
              <span
                title="Tenant reference (EST-YYMM-XXXX)"
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  background: C.blue,
                  padding: "3px 9px",
                  borderRadius: 6,
                  letterSpacing: 0.5,
                }}
              >
                {latest.reference}
              </span>
            )}
            <div style={{ fontSize: 15, fontWeight: 700 }}>{latest.number}</div>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Updated {fmtDateTime(latest.updatedAt)}
          </div>
        </div>
      </div>

      {project.estimates.length > 1 && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            All estimates ({project.estimates.length})
          </div>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, color: C.muted }}>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Reference</th>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Number</th>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Created</th>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Status</th>
                <th style={{ textAlign: "right", padding: "8px 14px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {project.estimates.map(e => {
                const t = estimateTotals(e);
                return (
                  <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: e.reference ? C.text : C.muted }}>
                      {e.reference ?? "—"}
                    </td>
                    <td style={{ padding: "8px 14px", color: C.muted }}>{e.number}</td>
                    <td style={{ padding: "8px 14px", color: C.muted }}>{fmtDate(e.createdAt)}</td>
                    <td style={{ padding: "8px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: e.locked ? `${C.green}18` : `${C.amber}18`,
                          color: e.locked ? C.green : C.amber,
                        }}
                      >
                        {e.locked ? "Locked" : "Draft"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700 }}>
                      {fmtMoney(t.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProjectEstimateEditor projectId={project.id} estimateId={latest.id} />
    </div>
  );
};

// ─── Schedule Tab ──────────────────────────────────────────
const ScheduleTab: React.FC<{ project: Project; onUpload: () => void }> = ({
  project,
  onUpload,
}) => {
  const latestScan = project.scans[project.scans.length - 1];
  if (!latestScan || !latestScan.detectionResult) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 14,
          padding: "36px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Upload a drawing to generate a schedule
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Component schedules are generated from your latest PDF scan.
        </div>
        <button
          onClick={onUpload}
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
          Go to Upload
        </button>
      </div>
    );
  }
  const result = latestScan.detectionResult as DetectionResult;
  const byRoom: Record<string, DetectedComponent[]> = {};
  result.components.forEach(c => {
    byRoom[c.room] = byRoom[c.room] || [];
    byRoom[c.room].push(c);
  });
  const rooms = Object.keys(byRoom).sort();

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            Schedule from v{latestScan.versionNumber}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {latestScan.fileName} · {fmtDateTime(latestScan.scannedAt)}
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.muted,
          }}
        >
          {result.components.length} components
        </div>
      </div>

      {rooms.map(room => {
        const comps = byRoom[room];
        const total = comps.reduce((s, c) => s + c.line_total, 0);
        return (
          <div
            key={room}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{room}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>
                {fmtMoney(total)}
              </div>
            </div>
            {comps.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderTop: i === 0 ? `1px solid ${C.border}` : "none",
                  fontSize: 13,
                }}
              >
                <div style={{ color: C.dim }}>
                  {c.catalogue_item_name ?? LABELS[c.type] ?? c.type}
                </div>
                <div style={{ color: C.muted }}>
                  {c.quantity} × {fmtMoney(c.unit_price)} ={" "}
                  <strong style={{ color: C.text }}>{fmtMoney(c.line_total)}</strong>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// Map detection component type → default estimate category.
function categorise(compType: string): string {
  const t = compType.toUpperCase();
  if (t.startsWith("GPO")) return "Power";
  if (t.startsWith("DOWNLIGHT") || t.startsWith("PENDANT") || t.startsWith("LED") || t.startsWith("LIGHT"))
    return "Lighting";
  if (t.startsWith("SWITCHING") || t.startsWith("DIMMER")) return "Lighting";
  if (t.startsWith("SWITCHBOARD")) return "Switchboard";
  if (t.startsWith("DATA") || t.startsWith("AV") || t.startsWith("TV")) return "AV / Data";
  if (t.startsWith("SECURITY") || t.startsWith("CCTV") || t.startsWith("ALARM")) return "Security";
  if (t.startsWith("EV")) return "EV Charging";
  if (t.startsWith("AUTOMATION") || t.includes("BLIND")) return "Automation";
  if (t.startsWith("SOLAR") || t.startsWith("BATTERY")) return "Solar / Battery";
  return "General";
}

export default ProjectDetail;
