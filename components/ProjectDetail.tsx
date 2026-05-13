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
import {
  type VariationEstimateLike,
  type VariationLineItem,
} from "./VariationReport";
import {
  detectElectricalComponents,
  type DetectionResult,
  type DetectedComponent,
} from "../analyze_pdf";
import { peekNextReference } from "../services/estimateReferenceService";

// Dark-theme palette — matches DashboardScreen / AppShell.
const C = {
  bg:      "#0f172a",  // slate-900 page background
  navy:    "#0f172a",  // alias
  card:    "#1e293b",  // slate-800 primary surface
  card2:   "#162032",  // slightly deeper card variant
  cardHov: "#253347",  // card hover state
  blue:    "#3b82f6",  // primary blue
  blueDk:  "#1d4ed8",
  green:   "#10b981",
  amber:   "#f59e0b",
  red:     "#ef4444",
  purple:  "#8b5cf6",
  text:    "#f1f5f9",  // slate-100
  muted:   "#94a3b8",  // slate-400
  border:  "#334155",  // slate-700
  dim:     "#64748b",  // slate-500
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
      {/* Project name + status header */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
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
                background: C.bg,
                color: C.text,
                border: `1px solid ${C.blue}`,
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 700,
                outline: "none",
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.dim, flexShrink: 0 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          )}
        </div>
        <select
          value={project.status}
          onChange={e => setStatus(e.target.value as ProjectStatus)}
          style={{
            background: `${palette.bg}25`,
            color: palette.bg,
            border: `1px solid ${palette.bg}55`,
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {["Active", "Won", "Lost", "On Hold"].map(s => (
            <option key={s} value={s} style={{ background: C.card, color: C.text }}>
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
              transition: "color 0.15s",
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
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${C.green}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: C.text }}>
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

// ─── Variation diff helpers ────────────────────────────────
type VarChangeType = "added" | "removed" | "changed";
interface VarChange {
  type: VarChangeType;
  description: string;
  room: string;
  qtyPrev: number;
  qtyCurr: number;
  delta: number;
}

function diffVariationItems(prev: VariationLineItem[], curr: VariationLineItem[]): VarChange[] {
  const key = (li: VariationLineItem) =>
    `${li.room.trim().toLowerCase()}|${li.description.trim().toLowerCase()}`;
  const map = new Map<string, { p?: VariationLineItem; c?: VariationLineItem }>();
  for (const li of prev) map.set(key(li), { ...map.get(key(li)), p: li });
  for (const li of curr) map.set(key(li), { ...map.get(key(li)), c: li });
  const changes: VarChange[] = [];
  for (const { p, c } of map.values()) {
    if (p && !c) {
      changes.push({ type: "removed", description: p.description, room: p.room, qtyPrev: p.qty, qtyCurr: 0, delta: -(p.qty * p.unitPrice) });
    } else if (!p && c) {
      changes.push({ type: "added", description: c.description, room: c.room, qtyPrev: 0, qtyCurr: c.qty, delta: c.qty * c.unitPrice });
    } else if (p && c) {
      const totalA = p.qty * p.unitPrice;
      const totalB = c.qty * c.unitPrice;
      if (totalA !== totalB) {
        changes.push({ type: "changed", description: c.description, room: c.room, qtyPrev: p.qty, qtyCurr: c.qty, delta: totalB - totalA });
      }
    }
  }
  const order: Record<VarChangeType, number> = { added: 0, changed: 1, removed: 2 };
  return changes.sort((a, b) => order[a.type] - order[b.type]);
}

// ─── Single variation card ──────────────────────────────────
const VariationCard: React.FC<{
  label: string;
  date: string;
  total: number;
  delta: number | null;
  changes: VarChange[];
  isLatest: boolean;
}> = ({ label, date, total, delta, changes, isLatest }) => {
  const [open, setOpen] = useState(isLatest && delta !== null);

  const deltaColor = delta === null ? C.muted : delta >= 0 ? "#10B981" : C.red;
  const changeTypeColor: Record<VarChangeType, string> = {
    added: "#10B981",
    removed: C.red,
    changed: C.amber,
  };
  const changeTypeLabel: Record<VarChangeType, string> = {
    added: "Added",
    removed: "Removed",
    changed: "Changed",
  };

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${isLatest ? C.blue : C.border}`,
      borderLeft: isLatest ? `3px solid ${C.blue}` : `1px solid ${C.border}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 10,
      boxShadow: isLatest ? `0 4px 20px ${C.blue}15` : "none",
      transition: "box-shadow 0.2s",
    }}>
      {/* Card header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          cursor: changes.length > 0 ? "pointer" : "default",
        }}
        onClick={() => changes.length > 0 && setOpen(o => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            background: isLatest ? `${C.blue}25` : `${C.border}55`,
            color: isLatest ? C.blue : C.muted,
            border: `1px solid ${isLatest ? C.blue : C.border}`,
            borderRadius: 8, padding: "3px 9px",
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>{date}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{fmtMoney(total)}</div>
          {delta !== null && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: deltaColor,
              background: `${deltaColor}18`, border: `1px solid ${deltaColor}33`,
              borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap",
            }}>
              {delta >= 0 ? "+" : ""}{fmtMoney(delta)}
            </div>
          )}
          {changes.length > 0 && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
      </div>

      {/* Expandable diff rows */}
      {open && changes.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 16px 12px" }}>
          {changes.map((ch, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: i < changes.length - 1 ? `1px solid ${C.border}` : "none",
              gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: changeTypeColor[ch.type],
                  textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
                }}>
                  {changeTypeLabel[ch.type]}
                </span>
                <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{ch.room}</span>
                <span style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ch.description}
                </span>
                {ch.type === "changed" && (
                  <span style={{ fontSize: 11, color: C.dim, flexShrink: 0 }}>
                    ×{ch.qtyPrev} → ×{ch.qtyCurr}
                  </span>
                )}
                {ch.type !== "changed" && (
                  <span style={{ fontSize: 11, color: C.dim, flexShrink: 0 }}>×{ch.qtyCurr || ch.qtyPrev}</span>
                )}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                color: ch.delta >= 0 ? "#10B981" : C.red,
              }}>
                {ch.delta >= 0 ? "+" : ""}{fmtMoney(ch.delta)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Baseline label */}
      {delta === null && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 16px", fontSize: 11, color: C.muted }}>
          Baseline estimate — no prior version to compare
        </div>
      )}
    </div>
  );
};

// ─── Variations Tab ────────────────────────────────────────
const VariationsTab: React.FC<{
  project: Project;
  onBackToOverview: () => void;
  onOpenUpload: () => void;
}> = ({ project, onOpenUpload }) => {
  const ests = project.estimates;

  if (ests.length === 0) {
    return (
      <div style={{
        background: C.card, border: `1px dashed ${C.border}`,
        borderRadius: 14, padding: "48px 20px", textAlign: "center",
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${C.blue}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: C.text }}>No estimates yet</div>
        <div style={{ fontSize: 12, color: C.muted, maxWidth: 380, margin: "0 auto 14px", lineHeight: 1.55 }}>
          Upload a drawing to generate your first estimate. Variations will appear here each time you upload a revised plan.
        </div>
        <button onClick={onOpenUpload} style={{
          background: C.blue, color: "#fff", border: "none",
          padding: "10px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer",
          boxShadow: `0 4px 16px ${C.blue}40`,
        }}>
          Upload a drawing
        </button>
      </div>
    );
  }

  // Build ordered list of variation estimates from oldest → newest
  const variations = ests.map(toVariationEstimate);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {variations.map((v, i) => {
          const prev = i > 0 ? variations[i - 1] : null;
          const delta = prev !== null ? v.total - prev.total : null;
          const changes = prev
            ? diffVariationItems(prev.lineItems ?? [], v.lineItems ?? [])
            : [];
          return (
            <VariationCard
              key={v.id}
              label={`Variation ${i + 1}`}
              date={v.date ? fmtDate(v.date) : "—"}
              total={v.total}
              delta={delta}
              changes={changes}
              isLatest={i === variations.length - 1}
            />
          );
        })}
      </div>

      <button
        onClick={onOpenUpload}
        style={{
          width: "100%", background: "none",
          border: `2px dashed ${C.border}`, borderRadius: 12,
          padding: "14px", fontSize: 13, fontWeight: 600,
          color: C.muted, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "border-color 0.2s, color 0.2s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = C.blue;
          e.currentTarget.style.color = C.blue;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.color = C.muted;
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Upload revised drawing to add Variation {variations.length + 1}
      </button>
    </div>
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
            padding: "32px 20px",
            color: C.muted,
            fontSize: 13,
            textAlign: "center",
            lineHeight: 1.55,
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
          {history.map((h, i) => {
            const iconColor = h.type === "scan" ? C.blue : h.type === "version" ? C.amber : C.green;
            const historyIcon =
              h.type === "scan" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              ) : h.type === "version" ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              );
            return (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.cardHov; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: `${iconColor}22`,
                    color: iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: `1px solid ${iconColor}33`,
                  }}
                >
                  {historyIcon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{h.label}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{h.detail}</div>
                </div>
                <div style={{ fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>{fmtDateTime(h.at)}</div>
              </div>
            );
          })}
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
      padding: "14px 16px",
      borderTop: `2px solid ${C.border}`,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.dim,
        letterSpacing: 0.8,
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
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
      {/* Info banner */}
      <div
        style={{
          background: `${C.blue}14`,
          border: `1px solid ${C.blue}33`,
          borderLeft: `3px solid ${C.blue}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            Upload a drawing for {project.name}
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            ElectraScan reads the legend, detects every component, and appends
            results to this project. Each scan is versioned — current version will
            be v{project.scans.length + 1}.
          </div>
        </div>
      </div>

      {status === "scanning" ? (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: "48px 20px",
            textAlign: "center",
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: `${C.blue}22`, border: `1px solid ${C.blue}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>Scanning drawing…</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            Reading legend symbols then scanning every room.
          </div>
          <div style={{
            marginTop: 20, height: 4, borderRadius: 2,
            background: C.border, overflow: "hidden", maxWidth: 240, margin: "20px auto 0",
          }}>
            <div style={{
              height: "100%", background: C.blue, width: "60%",
              borderRadius: 2, animation: "pulse 1.5s ease-in-out infinite",
            }} />
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
              background: drag ? `${C.blue}0e` : C.card,
              border: `2px dashed ${drag ? C.blue : C.border}`,
              borderRadius: 18,
              padding: "48px 20px",
              textAlign: "center",
              transition: "all 0.2s",
              boxShadow: drag ? `0 0 0 4px ${C.blue}18` : "none",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: drag ? `${C.blue}22` : `${C.border}55`,
              border: `1px solid ${drag ? C.blue : C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", transition: "all 0.2s",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={drag ? C.blue : C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="12" y2="12"/>
                <line x1="15" y1="15" x2="12" y2="12"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>Drop PDF here</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 18 }}>
              or click to choose a file
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: C.blue,
                color: "#fff",
                padding: "10px 22px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                boxShadow: `0 4px 16px ${C.blue}40`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
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
            background: `${C.red}15`,
            border: `1px solid ${C.red}55`,
            borderLeft: `3px solid ${C.red}`,
            color: C.red,
            padding: "12px 14px",
            borderRadius: 10,
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 280,
            overflowY: "auto",
            fontFamily: error.includes("Pass 1 response") ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Couldn't read this drawing
          </div>
          {error}
        </div>
      )}

      {project.scans.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.dim,
              letterSpacing: 0.8,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            Scan History
          </div>
          {project.scans
            .slice()
            .reverse()
            .map((s, idx) => (
              <div
                key={s.id}
                style={{
                  background: idx === 0 ? C.card2 : C.card,
                  border: `1px solid ${idx === 0 ? C.blue + "55" : C.border}`,
                  borderLeft: idx === 0 ? `3px solid ${C.blue}` : `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: idx === 0 ? `${C.blue}22` : `${C.border}55`,
                    color: idx === 0 ? C.blue : C.muted,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      v{s.versionNumber} · {s.fileName}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {fmtDateTime(s.scannedAt)} · {s.componentCount} components · {fmtMoney(s.subtotal)}
                    </div>
                  </div>
                </div>
                {idx === 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: C.blue,
                    background: `${C.blue}18`, border: `1px solid ${C.blue}33`,
                    padding: "2px 7px", borderRadius: 6, flexShrink: 0,
                  }}>
                    Latest
                  </span>
                )}
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
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: 18, background: `${C.amber}18`, border: `1px solid ${C.amber}33`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: C.text }}>
          No estimates yet
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
          Create a blank estimate or upload a drawing to auto-populate one.
        </div>
        <button
          onClick={onCreateEstimate}
          style={{
            background: C.blue,
            color: "#fff",
            border: "none",
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: `0 4px 16px ${C.blue}40`,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Estimate
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <div style={{ fontSize: 12, color: C.muted }}>
              Updated {fmtDateTime(latest.updatedAt)}
            </div>
            {latest.wholesaleQuoteSentAt && (() => {
              const status = latest.wholesaleQuoteStatus ?? "sent";
              const supplier = latest.wholesaleQuoteSentTo ?? "Wholesaler";
              const STATES: Array<{
                key: "sent" | "received" | "ordered";
                icon: string;
                label: string;
                bg: string;
                fg: string;
                nextLabel?: string;
              }> = [
                { key: "sent",     icon: "📧", label: "BOM Sent",       bg: "#FFB020", fg: "#0A1628", nextLabel: "Mark Quote Received" },
                { key: "received", icon: "📨", label: "Quote Received",  bg: "#1D6EFD", fg: "#fff",   nextLabel: "Mark as Ordered" },
                { key: "ordered",  icon: "📦", label: "Ordered",         bg: "#00C48C", fg: "#0A1628" },
              ];
              const idx = STATES.findIndex(s => s.key === status);
              const current = STATES[idx] ?? STATES[0];
              const next = STATES[idx + 1];
              const timestamp =
                status === "ordered"
                  ? latest.wholesaleQuoteOrderedAt
                  : status === "received"
                  ? latest.wholesaleQuoteReceivedAt
                  : latest.wholesaleQuoteSentAt;
              const advanceStatus = () => {
                if (!next) return;
                const now = new Date().toISOString();
                saveEstimate(project.id, {
                  ...latest,
                  wholesaleQuoteStatus: next.key,
                  wholesaleQuoteReceivedAt: next.key === "received" ? now : latest.wholesaleQuoteReceivedAt,
                  wholesaleQuoteOrderedAt: next.key === "ordered" ? now : latest.wholesaleQuoteOrderedAt,
                  updatedAt: now,
                });
              };
              return (
                <span
                  onClick={next ? advanceStatus : undefined}
                  title={next ? `${next.nextLabel} — click to advance` : `Ordered from ${supplier} on ${fmtDateTime(timestamp ?? "")}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: current.fg,
                    background: current.bg,
                    padding: "2px 8px",
                    borderRadius: 20,
                    letterSpacing: 0.3,
                    whiteSpace: "nowrap",
                    cursor: next ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {current.icon} {current.label} · {supplier} · {fmtDateTime(timestamp ?? latest.wholesaleQuoteSentAt ?? "")}
                  {next && <span style={{ opacity: 0.65, marginLeft: 4 }}>›</span>}
                </span>
              );
            })()}
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
              fontSize: 10,
              fontWeight: 700,
              color: C.dim,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            All estimates ({project.estimates.length})
          </div>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: C.dim, textTransform: "uppercase" }}>Reference</th>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: C.dim, textTransform: "uppercase" }}>Number</th>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: C.dim, textTransform: "uppercase" }}>Created</th>
                <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: C.dim, textTransform: "uppercase" }}>Status</th>
                <th style={{ textAlign: "right", padding: "8px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: C.dim, textTransform: "uppercase" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {project.estimates.map(e => {
                const t = estimateTotals(e);
                return (
                  <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "9px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: e.reference ? C.blue : C.muted }}>
                      {e.reference ?? "—"}
                    </td>
                    <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12 }}>{e.number}</td>
                    <td style={{ padding: "9px 14px", color: C.muted, fontSize: 12 }}>{fmtDate(e.createdAt)}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: e.locked ? `${C.green}18` : `${C.amber}18`,
                          color: e.locked ? C.green : C.amber,
                          border: `1px solid ${e.locked ? C.green + "33" : C.amber + "33"}`,
                        }}
                      >
                        {e.locked ? "Locked" : "Draft"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: C.text }}>
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
          padding: "48px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: 18, background: `${C.purple}18`, border: `1px solid ${C.purple}33`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: C.text }}>
          Upload a drawing to generate a schedule
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
          Component schedules are generated from your latest PDF scan.
        </div>
        <button
          onClick={onUpload}
          style={{
            background: C.blue,
            color: "#fff",
            border: "none",
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: `0 4px 16px ${C.blue}40`,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
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
      {/* Schedule meta bar */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderLeft: `3px solid ${C.purple}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            Schedule from v{latestScan.versionNumber}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {latestScan.fileName} · {fmtDateTime(latestScan.scannedAt)}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.purple,
          background: `${C.purple}18`, border: `1px solid ${C.purple}33`,
          padding: "4px 10px", borderRadius: 8,
        }}>
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
              overflow: "hidden",
              marginBottom: 10,
            }}
          >
            {/* Room header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: `1px solid ${C.border}`,
                background: C.bg,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                {room}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>
                {fmtMoney(total)}
              </div>
            </div>
            {/* Component rows */}
            {comps.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                  fontSize: 13,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.cardHov; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ color: C.text, fontWeight: 500 }}>
                  {c.catalogue_item_name ?? LABELS[c.type] ?? c.type}
                </div>
                <div style={{ color: C.muted, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{c.quantity}</span>
                  <span style={{ color: C.dim }}>×</span>
                  <span>{fmtMoney(c.unit_price)}</span>
                  <span style={{ color: C.dim }}>=</span>
                  <strong style={{ color: C.text, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtMoney(c.line_total)}</strong>
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
  // AUTOMATION_HUB covers motorised blinds, home automation hubs, and
  // Dynalite/DALI systems — all belong in Automation, not General.
  if (t.startsWith("AUTOMATION") || t.includes("BLIND") || t === "AUTOMATION_HUB") return "Automation";
  if (t.startsWith("GATE") || t.startsWith("POOL")) return "Automation";
  if (t.startsWith("SOLAR") || t.startsWith("BATTERY")) return "Solar / Battery";
  return "General";
}

export default ProjectDetail;
