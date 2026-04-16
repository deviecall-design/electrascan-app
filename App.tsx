import { useState, useCallback } from "react";
import {
  detectElectricalComponents,
  DetectionResult,
  DetectedComponent,
  groupByRoom,
  getReviewItems,
} from "./analyze_pdf";
import VariationReport, { VariationEstimateLike } from "./components/VariationReport";
import type { RiskFlag as DetectionRiskFlag } from "./analyze_pdf";

// ─── Design tokens ─────────────────────────────
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
  purple: "#7C3AED",
};

type Screen = "dashboard" | "upload" | "scanning" | "results" | "estimate" | "project" | "variation";
type ResultTab = "schedule" | "risks";
type ProjectStatus = "estimating" | "submitted" | "approved" | "active" | "completed";

interface LineItem {
  id: string;
  description: string;
  room: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  locked: boolean;
  fromDetection: boolean;
  catalogueName?: string;
}

interface Estimate {
  id: string;
  number: string;
  date: string;
  subtotal: number;
  margin: number;
  total: number;
  status: "draft" | "locked" | "submitted" | "approved";
  drawingFile: string;
  lineItems: LineItem[];
}

interface Project {
  id: string;
  name: string;
  address: string;
  client: string;
  status: ProjectStatus;
  contractValue: number;
  createdAt: string;
  updatedAt: string;
  estimates: Estimate[];
  drawingVersion: string;
  daysActive: number;
}

const LABELS: Record<string, string> = {
  GPO_STANDARD:"Power Point",GPO_DOUBLE:"Double Power Point",GPO_WEATHERPROOF:"Weatherproof GPO",
  GPO_USB:"USB Power Point",DOWNLIGHT_RECESSED:"Downlight",PENDANT_FEATURE:"Pendant Light",
  EXHAUST_FAN:"Exhaust Fan",SWITCHING_STANDARD:"Light Switch",SWITCHING_DIMMER:"Dimmer Switch",
  SWITCHING_2WAY:"2-Way Switch",SWITCHBOARD_MAIN:"Main Switchboard",SWITCHBOARD_SUB:"Sub Board",
  AC_SPLIT:"Split System AC",AC_DUCTED:"Ducted AC",DATA_CAT6:"Data Point",DATA_TV:"TV/Data Point",
  SECURITY_CCTV:"CCTV Camera",SECURITY_INTERCOM:"Intercom",SECURITY_ALARM:"Alarm Sensor",
  EV_CHARGER:"EV Charger",POOL_OUTDOOR:"Pool Equipment",GATE_ACCESS:"Gate/Access",
  AUTOMATION_HUB:"Home Automation",
};

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  estimating: { label: "Estimating",  color: C.amber,  bg: `${C.amber}18`  },
  submitted:  { label: "Submitted",   color: C.blue,   bg: `${C.blue}18`   },
  approved:   { label: "Approved",    color: C.purple, bg: `${C.purple}18` },
  active:     { label: "Active",      color: C.green,  bg: `${C.green}18`  },
  completed:  { label: "Completed",   color: C.muted,  bg: `${C.muted}18`  },
};

// ─── Mock projects ──────────────────────────────
const MOCK_PROJECTS: Project[] = [
  {
    id: "p-001", name: "Mark Arnesen", address: "8/110 North Steyne, Manly",
    client: "Linda Habak Design", status: "estimating",
    contractValue: 56463, createdAt: "02/04/2026", updatedAt: "02/04/2026",
    drawingVersion: "Rev FG 6/03/2026", daysActive: 0,
    estimates: [{
      id: "e-001", number: "EST-2026-497-001", date: "02/04/2026",
      subtotal: 44635, margin: 15, total: 56463,
      status: "draft", drawingFile: "Mark Arnesen Quoted Plans 6.03.2026.pdf",
      lineItems: [],
    }],
  },
  {
    id: "p-002", name: "Brighton Residence", address: "42 Marine Parade, Brighton",
    client: "Walsh Drafting", status: "active",
    contractValue: 94200, createdAt: "15/03/2026", updatedAt: "01/04/2026",
    drawingVersion: "Rev C", daysActive: 18,
    estimates: [{
      id: "e-002", number: "EST-2026-312-002", date: "20/03/2026",
      subtotal: 78500, margin: 20, total: 94200,
      status: "approved", drawingFile: "Brighton-Rev3-Elec.pdf",
      lineItems: [],
    }],
  },
  {
    id: "p-003", name: "Riverside Apartments", address: "12 River St, Parramatta",
    client: "Allen Build", status: "submitted",
    contractValue: 187500, createdAt: "01/03/2026", updatedAt: "28/03/2026",
    drawingVersion: "Rev B", daysActive: 32,
    estimates: [{
      id: "e-003", number: "EST-2026-289-003", date: "10/03/2026",
      subtotal: 156250, margin: 20, total: 187500,
      status: "submitted", drawingFile: "Riverside-E01-E04.pdf",
      lineItems: [],
    }],
  },
  {
    id: "p-004", name: "Southbank Office", address: "200 George St, Sydney",
    client: "ConstructCo", status: "completed",
    contractValue: 312000, createdAt: "10/01/2026", updatedAt: "15/03/2026",
    drawingVersion: "Rev D", daysActive: 64,
    estimates: [],
  },
];

const CSS = `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{margin:0;padding:0;background:#0A1628;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
  .proj-card:active{transform:scale(0.98);}
`;

const fmt = (n: number) => `$${n.toLocaleString("en-AU")}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : fmt(n);
const toLineItems = (components: DetectedComponent[]): LineItem[] =>
  components.map((c, i) => ({
    id: `li-${i}`, description: c.catalogue_item_name ?? LABELS[c.type] ?? c.type,
    room: c.room, qty: c.quantity, unitPrice: c.unit_price,
    lineTotal: c.line_total, locked: false, fromDetection: true,
  }));

// ─── Dashboard Screen ───────────────────────────
function DashboardScreen({ projects, onNewScan, onOpenProject }: {
  projects: Project[]; onNewScan: () => void; onOpenProject: (p: Project) => void;
}) {
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const totalValue = projects.reduce((s, p) => s + p.contractValue, 0);
  const activeCount = projects.filter(p => p.status === "active").length;
  const estimatingCount = projects.filter(p => p.status === "estimating").length;
  const filtered = filter === "all" ? projects : projects.filter(p => p.status === filter);

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blue, letterSpacing: "-0.03em" }}>
              Electra<span style={{ color: C.text }}>Scan</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Vesh Electrical Services</div>
          </div>
          <button onClick={onNewScan} style={{
            background: C.blue, border: "none", color: "#fff",
            fontSize: 13, fontWeight: 700, padding: "10px 16px",
            borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>⚡</span> New Scan
          </button>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
          <div style={{ background: C.card, borderRadius: 14, padding: "14px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Pipeline</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{fmtK(totalValue)}</div>
            <div style={{ fontSize: 10, color: C.muted }}>{projects.length} projects</div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, padding: "14px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Active</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{activeCount}</div>
            <div style={{ fontSize: 10, color: C.muted }}>on site</div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, padding: "14px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Quoting</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>{estimatingCount}</div>
            <div style={{ fontSize: 10, color: C.muted }}>estimates</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12 }}>
          {(["all", "estimating", "submitted", "approved", "active", "completed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flexShrink: 0, background: filter === f ? C.blue : C.card,
              border: `1px solid ${filter === f ? C.blue : C.border}`,
              color: filter === f ? "#fff" : C.muted,
              fontSize: 12, fontWeight: 600, padding: "6px 14px",
              borderRadius: 20, cursor: "pointer", textTransform: "capitalize" as const,
            }}>
              {f === "all" ? `All (${projects.length})` : `${STATUS_CONFIG[f]?.label} (${projects.filter(p => p.status === f).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 80px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ color: C.muted, fontSize: 14 }}>No projects yet</div>
            <button onClick={onNewScan} style={{ marginTop: 16, background: C.blue, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 12, cursor: "pointer" }}>
              Scan your first drawing
            </button>
          </div>
        ) : filtered.map((project, i) => {
          const status = STATUS_CONFIG[project.status];
          const latestEst = project.estimates[project.estimates.length - 1];
          return (
            <div key={project.id} className="proj-card" onClick={() => onOpenProject(project)}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 10, cursor: "pointer", transition: "all .15s", animation: `fadeUp .3s ease ${i * 0.05}s both` }}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 2 }}>{project.name}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{project.address}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{project.client}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: status.bg, color: status.color }}>
                    {status.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmtK(project.contractValue)}</div>
                </div>
              </div>
              {/* Bottom row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Drawing</div>
                    <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{project.drawingVersion}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Estimates</div>
                    <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{project.estimates.length}</div>
                  </div>
                  {project.daysActive > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: C.muted }}>Days active</div>
                      <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{project.daysActive}</div>
                    </div>
                  )}
                </div>
                {latestEst && (
                  <div style={{ fontSize: 11, color: C.muted }}>{latestEst.number}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Projects</div>
          <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />
        </button>
        <button onClick={onNewScan} style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>⚡</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Scan</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>⚙️</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Settings</div>
        </button>
      </div>
    </div>
  );
}

// ─── Project Detail Screen ──────────────────────
function ProjectScreen({ project, onBack, onNewScan, onOpenVariation }: {
  project: Project; onBack: () => void; onNewScan: () => void; onOpenVariation: (p: Project) => void;
}) {
  const status = STATUS_CONFIG[project.status];
  const latestEst = project.estimates[project.estimates.length - 1];

  const TIMELINE: { label: string; status: "done" | "active" | "pending"; date?: string }[] = [
    { label: "Project created", status: "done", date: project.createdAt },
    { label: "Drawing received", status: "done", date: project.createdAt },
    { label: "Estimate drafted", status: project.estimates.length > 0 ? "done" : "pending", date: latestEst?.date },
    { label: "Submitted to builder", status: project.status === "submitted" || project.status === "approved" || project.status === "active" || project.status === "completed" ? "done" : "pending" },
    { label: "Estimate approved", status: project.status === "approved" || project.status === "active" || project.status === "completed" ? "done" : project.status === "submitted" ? "active" : "pending" },
    { label: "Works commenced", status: project.status === "active" || project.status === "completed" ? "done" : "pending" },
    { label: "Practical completion", status: project.status === "completed" ? "done" : "pending" },
  ];

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>← Projects</button>
          <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: status.bg, color: status.color }}>{status.label}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 2 }}>{project.name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{project.address} · {project.client}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmtK(project.contractValue)}</div>
            <div style={{ fontSize: 10, color: C.muted }}>Contract value</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{project.estimates.length}</div>
            <div style={{ fontSize: 10, color: C.muted }}>Estimates</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: project.daysActive > 0 ? C.green : C.muted }}>
              {project.daysActive > 0 ? project.daysActive : "—"}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>Days active</div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 80px" }}>

        {/* Project timeline */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>Timeline</div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 16, position: "relative" as const }}>
          {TIMELINE.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: i < TIMELINE.length - 1 ? 16 : 0, position: "relative" as const }}>
              {/* Line */}
              {i < TIMELINE.length - 1 && (
                <div style={{ position: "absolute" as const, left: 11, top: 22, width: 2, height: 16, background: step.status === "done" ? C.green : C.border }} />
              )}
              {/* Dot */}
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: step.status === "done" ? C.green : step.status === "active" ? C.blue : C.border,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#fff", fontWeight: 700,
              }}>
                {step.status === "done" ? "✓" : step.status === "active" ? "●" : ""}
              </div>
              <div style={{ flex: 1, paddingTop: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: step.status === "pending" ? C.muted : C.text }}>{step.label}</div>
                {step.date && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{step.date}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Estimates */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>Estimates</div>
        {project.estimates.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>No estimates yet</div>
            <button onClick={onNewScan} style={{ background: C.blue, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 20px", borderRadius: 10, cursor: "pointer" }}>
              ⚡ Scan Drawing
            </button>
          </div>
        ) : project.estimates.map((est, i) => {
          const estStatus: Record<string, { label: string; color: string }> = {
            draft:     { label: "Draft",     color: C.muted  },
            locked:    { label: "Locked",    color: C.amber  },
            submitted: { label: "Submitted", color: C.blue   },
            approved:  { label: "Approved",  color: C.green  },
          };
          const es = estStatus[est.status];
          return (
            <div key={est.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{est.number}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: es.color }}>{es.label}</div>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{est.drawingFile}</div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted }}>Subtotal ex GST</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(est.subtotal)}</div>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontSize: 10, color: C.muted }}>Total inc GST ({est.margin}% margin)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtK(est.total)}</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>Actions</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          <button onClick={onNewScan} style={{ background: C.card, border: `1px solid ${C.blue}`, color: C.blue, fontSize: 14, fontWeight: 700, padding: "14px", borderRadius: 14, cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <div>
              <div>Scan new drawing revision</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>Upload Rev {String.fromCharCode(65 + project.estimates.length)} → auto-generate variation report</div>
            </div>
          </button>
          <button onClick={() => onOpenVariation(project)} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontWeight: 600, padding: "14px", borderRadius: 14, cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div>
              <div>Variation report</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>
                {project.estimates.length >= 2
                  ? `Compare ${project.estimates[project.estimates.length - 2].number} → ${project.estimates[project.estimates.length - 1].number}`
                  : project.estimates.length === 1
                    ? `Preview change deltas vs baseline`
                    : `Scan a drawing first to generate a baseline`}
              </div>
            </div>
          </button>
          <button style={{ background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontWeight: 600, padding: "14px", borderRadius: 14, cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📁</span>
            <div>
              <div>Full project report</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>All versions, variations & audit trail — coming soon</div>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}>
        <button onClick={onBack} style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Projects</div>
        </button>
        <button onClick={onNewScan} style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>⚡</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Scan</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>⚙️</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Settings</div>
        </button>
      </div>
    </div>
  );
}

// ─── Upload Screen ──────────────────────────────
function UploadScreen({ onFile, onBack, error }: { onFile: (f: File) => void; onBack: () => void; error: string | null }) {
  const [drag, setDrag] = useState(false);
  const drop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onFile(f);
  }, [onFile]);

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>← Projects</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>Electra<span style={{ color: C.text }}>Scan</span></div>
        <div style={{ width: 60 }} />
      </div>
      {error && <div style={{ margin: "12px 20px 0", background: `${C.red}22`, border: `1px solid ${C.red}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: C.red, flexShrink: 0 }}><strong>Error:</strong> {error}</div>}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 20px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: 10 }}>Scan a<br />drawing</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>Upload the electrical PDF. ElectraScan reads the legend, identifies every symbol, and builds your estimate.</div>
        <label style={{ display: "block", cursor: "pointer" }}>
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
            style={{ background: drag ? "#0D2347" : C.card, border: `2px dashed ${drag ? C.blue : C.border}`, borderRadius: 20, padding: "36px 20px", textAlign: "center", transition: "all .2s" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Drop PDF here</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>or tap to choose from files or email</div>
            <div style={{ display: "inline-block", background: C.blue, color: "#fff", fontSize: 15, fontWeight: 700, padding: "12px 28px", borderRadius: 12 }}>Choose PDF</div>
          </div>
          <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
        <div style={{ marginTop: 18, background: C.card, borderRadius: 14, padding: "16px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 12 }}>Detects</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 12px" }}>
            {[["⚡","Power points"],["💡","Downlights & strips"],["🔆","Switches"],["🔌","Switchboards"],["🪟","Motorised blinds"],["📡","Data & TV"],["📹","Security"],["🚗","EV chargers"],["🏊","Pool"],["🏠","Automation"]].map(([icon, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.dim }}><span>{icon}</span>{label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scanning Screen ────────────────────────────
function ScanningScreen({ fileName }: { fileName: string }) {
  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div style={{ width: 88, height: 88, borderRadius: "50%", background: `${C.blue}18`, border: `2.5px solid ${C.blue}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 28, animation: "pulse 1.8s ease-in-out infinite" }}>⚡</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 10 }}>Scanning drawing...</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 280 }}>Reading legend symbols then scanning every room in <strong style={{ color: C.dim }}>{fileName}</strong></div>
    </div>
  );
}

// ─── Results Screen ─────────────────────────────
function ResultsScreen({ result, fileName, onBack, onBuildEstimate }: {
  result: DetectionResult; fileName: string; onBack: () => void; onBuildEstimate: () => void;
}) {
  const [tab, setTab] = useState<ResultTab>("schedule");
  const byRoom = groupByRoom(result.components);
  const rooms = Object.keys(byRoom);
  const reviewCount = getReviewItems(result.components).length;
  const gst = result.estimate_subtotal * 0.1;
  const total = result.estimate_subtotal + gst;
  const [openRooms, setOpenRooms] = useState<Set<string>>(new Set([rooms[0]]));
  const toggleRoom = (r: string) => setOpenRooms(prev => { const s = new Set(prev); s.has(r) ? s.delete(r) : s.add(r); return s; });

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ position: "sticky" as const, top: 0, zIndex: 100, background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>← Projects</button>
          <button onClick={onBack} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>New scan</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmtK(total)}</div>
            <div style={{ fontSize: 10, color: C.muted }}>inc GST</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: reviewCount > 0 ? C.amber : C.green }}>{reviewCount}</div>
            <div style={{ fontSize: 10, color: C.muted }}>to review</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{result.components.length}</div>
            <div style={{ fontSize: 10, color: C.muted }}>items</div>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>{fileName} · Scale {result.scale_detected}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
        {tab === "schedule" && (
          <>
            {rooms.map(room => {
              const comps = byRoom[room];
              const roomTotal = comps.reduce((s, c) => s + c.line_total, 0);
              const open = openRooms.has(room);
              return (
                <div key={room} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 8, overflow: "hidden" }}>
                  <button onClick={() => toggleRoom(room)} style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{room}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.blue }}>{fmtK(roomTotal)}</div>
                      <div style={{ fontSize: 18, color: C.muted, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</div>
                    </div>
                  </button>
                  {open && <div style={{ padding: "0 16px 14px" }}>
                    <div style={{ height: 1, background: C.border, marginBottom: 12 }} />
                    {comps.map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < comps.length - 1 ? `1px solid ${C.border}` : "none", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.catalogue_item_name ?? LABELS[c.type] ?? c.type}</div>
                          {c.symbol_visual && <div style={{ fontSize: 10, color: C.muted }}>Symbol: {c.symbol_visual}</div>}
                        </div>
                        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.quantity} EA</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>{fmt(c.line_total)}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
                </div>
              );
            })}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Subtotal ex GST</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(result.estimate_subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.muted }}>GST (10%)</span>
                <span style={{ fontSize: 13, color: C.muted }}>{fmt(gst)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Total inc GST</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{fmt(total)}</span>
              </div>
              <button onClick={onBuildEstimate} style={{ width: "100%", marginTop: 14, background: C.blue, border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                Build Estimate →
              </button>
            </div>
          </>
        )}
        {tab === "risks" && (
          result.risk_flags.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 20px" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✓</div><div style={{ color: C.green, fontWeight: 700 }}>No risk flags</div></div>
            : result.risk_flags.map((flag, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${flag.level === "high" ? `${C.red}55` : flag.level === "medium" ? `${C.amber}55` : C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: flag.level === "high" ? `${C.red}22` : flag.level === "medium" ? `${C.amber}22` : `${C.blue}22`, color: flag.level === "high" ? C.red : flag.level === "medium" ? C.amber : C.blueLt }}>{flag.level.toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{LABELS[flag.component_type] ?? flag.component_type}</div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{flag.description}</div>
              </div>
            ))
        )}
      </div>
      <div style={{ position: "fixed" as const, bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 12px" }}>
        <button onClick={() => setTab("schedule")} style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ fontSize: 18 }}>📋</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: tab === "schedule" ? C.blue : C.muted }}>Schedule</div>
          {tab === "schedule" && <div style={{ width: 18, height: 2, background: C.blue, borderRadius: 1 }} />}
        </button>
        <button onClick={onBuildEstimate} style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginTop: -8, boxShadow: `0 4px 16px ${C.blue}66` }}>📝</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Estimate</div>
        </button>
        <button onClick={() => setTab("risks")} style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ fontSize: 18, position: "relative" as const }}>⚠️{result.risk_flags.length > 0 && <span style={{ position: "absolute" as const, top: -4, right: -8, fontSize: 9, fontWeight: 700, background: C.red, color: "#fff", width: 14, height: 14, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{result.risk_flags.length}</span>}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: tab === "risks" ? C.blue : C.muted }}>Risks</div>
          {tab === "risks" && <div style={{ width: 18, height: 2, background: C.blue, borderRadius: 1 }} />}
        </button>
      </div>
    </div>
  );
}

// ─── Estimate Editor ────────────────────────────
function EstimateEditor({ result, fileName, onBack }: {
  result: DetectionResult; fileName: string; onBack: () => void;
}) {
  const [items, setItems] = useState<LineItem[]>(() => toLineItems(result.components));
  const [margin, setMargin] = useState(15);
  const [locked, setLocked] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [estNumber] = useState(() => `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}-001`);

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const marginAmt = subtotal * (margin / 100);
  const subtotalM = subtotal + marginAmt;
  const gst = subtotalM * 0.1;
  const total = subtotalM + gst;

  const updateQty = (id: string, qty: number) => !locked && setItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, qty) } : i));
  const updatePrice = (id: string, price: number) => !locked && setItems(prev => prev.map(i => i.id === id ? { ...i, unitPrice: price } : i));
  const deleteItem = (id: string) => !locked && setItems(prev => prev.filter(i => i.id !== id));
  const addItem = () => { if (locked) return; const n: LineItem = { id: `m-${Date.now()}`, description: "New item", room: "General", qty: 1, unitPrice: 0, lineTotal: 0, locked: false, fromDetection: false }; setItems(prev => [...prev, n]); };

  const exportEst = () => {
    const lines = [`ELECTRICAL ESTIMATE\n${estNumber}\n\nVesh Electrical Services Pty Ltd\n7/108 Old Pittwater Road, Brookvale NSW 2100\n\nDate: ${new Date().toLocaleDateString("en-AU")}\nDrawing: ${fileName}\n\n${"─".repeat(60)}\nITEM                                    QTY    RATE      TOTAL\n${"─".repeat(60)}`, ...items.map(i => `${i.description.padEnd(40)} ${String(i.qty).padStart(3)}  $${String(i.unitPrice).padStart(7)}  $${String(i.qty * i.unitPrice).padStart(8)}`), `${"─".repeat(60)}\n\nSubtotal ex GST:      ${fmt(subtotal).padStart(12)}\nMargin (${margin}%):          ${fmt(marginAmt).padStart(12)}\nSubtotal with margin: ${fmt(subtotalM).padStart(12)}\nGST (10%):            ${fmt(gst).padStart(12)}\nTOTAL INC GST:        ${fmt(total).padStart(12)}\n\nValid for 30 days.`].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines], { type: "text/plain" })); a.download = `${estNumber}.txt`; a.click();
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {showLock && (
        <div style={{ position: "fixed" as const, inset: 0, zIndex: 200, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Lock estimate?</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 6 }}>This will lock <strong style={{ color: C.text }}>{estNumber}</strong> at <strong style={{ color: C.green }}>{fmt(total)}</strong> inc GST.</div>
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 20 }}>Once locked, line items cannot be edited.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLock(false)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, padding: "12px", borderRadius: 10, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => { setLocked(true); setShowLock(false); }} style={{ flex: 1, background: C.green, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px", borderRadius: 10, cursor: "pointer" }}>Lock & Finalise</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>← Back</button>
          {locked ? <div style={{ fontSize: 11, fontWeight: 700, background: `${C.green}22`, color: C.green, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.green}` }}>🔒 LOCKED</div> : <div style={{ fontSize: 11, color: C.muted }}>Draft</div>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{estNumber}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>{fileName} · {new Date().toLocaleDateString("en-AU")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}><div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmtK(total)}</div><div style={{ fontSize: 10, color: C.muted }}>inc GST</div></div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}><div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{items.length}</div><div style={{ fontSize: 10, color: C.muted }}>items</div></div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}><div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{margin}%</div><div style={{ fontSize: 10, color: C.muted }}>margin</div></div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 80px" }}>
        {/* Margin selector */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 }}>Margin / Markup</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[10, 15, 20, 25].map(m => (
              <button key={m} onClick={() => !locked && setMargin(m)} style={{ flex: 1, padding: "9px 0", border: `1.5px solid ${margin === m ? C.blue : C.border}`, background: margin === m ? `${C.blue}22` : "transparent", color: margin === m ? C.blue : C.muted, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: locked ? "default" : "pointer" }}>{m}%</button>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Line Items</div>
            {!locked && <button onClick={addItem} style={{ background: `${C.blue}22`, border: `1px solid ${C.blue}`, color: C.blue, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 7, cursor: "pointer" }}>+ Add</button>}
          </div>
          {items.map((item, i) => (
            <div key={item.id} style={{ padding: "10px 14px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.description}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{item.room}</div>
                </div>
                {!locked && <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 16, cursor: "pointer", padding: 2, lineHeight: 1, flexShrink: 0 }}>×</button>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {!locked && <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, padding: "5px 9px", cursor: "pointer" }}>−</button>}
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text, padding: "5px 8px", minWidth: 28, textAlign: "center" as const }}>{item.qty}</span>
                  {!locked && <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, padding: "5px 9px", cursor: "pointer" }}>+</button>}
                </div>
                <span style={{ color: C.muted, fontSize: 12 }}>×</span>
                <div style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", flex: 1 }}>
                  <span style={{ color: C.muted, fontSize: 12, marginRight: 2 }}>$</span>
                  <input type="number" value={item.unitPrice} disabled={locked} onChange={e => updatePrice(item.id, Number(e.target.value))} style={{ background: "none", border: "none", color: C.text, fontSize: 13, fontWeight: 600, width: "100%", outline: "none" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 64, textAlign: "right" as const }}>{fmt(item.qty * item.unitPrice)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
          {[[`Subtotal ex GST`, fmt(subtotal), C.text], [`Margin (${margin}%)`, `+ ${fmt(marginAmt)}`, C.amber], [`Subtotal with margin`, fmt(subtotalM), C.text], [`GST (10%)`, fmt(gst), C.muted]].map(([label, value, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Total inc GST</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      {/* Export Quote is the primary action and is available as soon as the
          estimate has line items — it's no longer gated on the submission /
          lock status. Lock & Finalise remains a separate secondary action
          shown only while the estimate is still a draft. */}
      <div style={{ position: "fixed" as const, bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", gap: 10 }}>
        <button
          onClick={exportEst}
          disabled={items.length === 0}
          style={{
            flex: locked ? 1 : 2,
            background: items.length === 0 ? C.card : C.blue,
            border: items.length === 0 ? `1px solid ${C.border}` : "none",
            color: items.length === 0 ? C.muted : "#fff",
            fontSize: 14, fontWeight: 700, padding: "12px", borderRadius: 12,
            cursor: items.length === 0 ? "not-allowed" : "pointer",
            opacity: items.length === 0 ? 0.6 : 1,
          }}
        >📤 Export Quote</button>
        {!locked && (
          <button
            onClick={() => setShowLock(true)}
            disabled={items.length === 0}
            style={{
              flex: 2,
              background: items.length === 0 ? C.card : C.green,
              border: items.length === 0 ? `1px solid ${C.border}` : "none",
              color: items.length === 0 ? C.muted : "#fff",
              fontSize: 14, fontWeight: 700, padding: "12px", borderRadius: 12,
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              opacity: items.length === 0 ? 0.6 : 1,
            }}
          >🔒 Lock & Finalise</button>
        )}
      </div>
    </div>
  );
}

// ─── Root App ───────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [variationPair, setVariationPair] = useState<{
    projectName: string;
    previous: VariationEstimateLike;
    current: VariationEstimateLike;
    detectedRiskFlags?: DetectionRiskFlag[];
  } | null>(null);

  const handleFile = async (f: File) => {
    setFile(f); setError(null); setScreen("scanning");
    try {
      const d = await detectElectricalComponents(f, "001");
      setResult(d); setScreen("results");
    } catch (err: any) {
      setError(err?.message ?? "Detection failed."); setScreen("upload");
    }
  };

  const goToScan = () => { setScreen("upload"); setFile(null); setResult(null); setError(null); };

  const openVariation = (project: Project) => {
    // Pick the two most-recent estimates. Synthesise a baseline if the project
    // only has one estimate so the report still renders a meaningful delta —
    // this mirrors the prototype's V001 → V002 comparison UX.
    const ests = project.estimates;
    let previous: VariationEstimateLike;
    let current: VariationEstimateLike;
    if (ests.length >= 2) {
      const p = ests[ests.length - 2];
      const c = ests[ests.length - 1];
      previous = { id: p.id, number: p.number, total: p.total, subtotal: p.subtotal, date: p.date, lineItems: p.lineItems };
      current  = { id: c.id, number: c.number, total: c.total, subtotal: c.subtotal, date: c.date, lineItems: c.lineItems };
    } else if (ests.length === 1) {
      const c = ests[0];
      const baselineTotal = Math.round(c.total / 1.09);
      previous = {
        id: `${c.id}-baseline`,
        number: c.number.replace(/-(\d+)$/, (_, n) => `-${String(Math.max(Number(n) - 1, 1)).padStart(3, "0")}`),
        total: baselineTotal,
        subtotal: Math.round(baselineTotal / 1.1),
        date: c.date,
        lineItems: [],
      };
      current = { id: c.id, number: c.number, total: c.total, subtotal: c.subtotal, date: c.date, lineItems: c.lineItems };
    } else {
      // No estimates yet — fall back to demo numbers.
      previous = { id: "v001", number: `EST-${new Date().getFullYear()}-001-001`, total: 136200, lineItems: [] };
      current  = { id: "v002", number: `EST-${new Date().getFullYear()}-001-002`, total: 148500, lineItems: [] };
    }
    // If the current in-memory scan result belongs to the project being
    // opened, pass its risk flags through. The detection pipeline populates
    // `result.risk_flags` via generateRiskFlags() in analyze_pdf.ts.
    const scanFlags = result?.risk_flags;
    setVariationPair({
      projectName: project.name,
      previous,
      current,
      detectedRiskFlags: scanFlags && scanFlags.length > 0 ? scanFlags : undefined,
    });
    setSelectedProject(project);
    setScreen("variation");
  };

  const handleNewEstimate = () => {
    if (!result || !file) return;
    const gst = result.estimate_subtotal * 0.1;
    const total = result.estimate_subtotal + gst;
    const newProject: Project = {
      id: `p-${Date.now()}`,
      name: file.name.replace(".pdf", "").replace(/[_-]/g, " "),
      address: "Address TBC",
      client: "Client TBC",
      status: "estimating",
      contractValue: Math.round(total),
      createdAt: new Date().toLocaleDateString("en-AU"),
      updatedAt: new Date().toLocaleDateString("en-AU"),
      drawingVersion: result.scale_detected,
      daysActive: 0,
      estimates: [{
        id: `e-${Date.now()}`,
        number: `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}-001`,
        date: new Date().toLocaleDateString("en-AU"),
        subtotal: result.estimate_subtotal,
        margin: 15,
        total: Math.round(total),
        status: "draft",
        drawingFile: file.name,
        lineItems: [],
      }],
    };
    setProjects(prev => [newProject, ...prev]);
    setScreen("estimate");
  };

  return (
    <>
      <style>{CSS}</style>
      {screen === "dashboard" && <DashboardScreen projects={projects} onNewScan={goToScan} onOpenProject={p => { setSelectedProject(p); setScreen("project"); }} />}
      {screen === "project" && selectedProject && <ProjectScreen project={selectedProject} onBack={() => setScreen("dashboard")} onNewScan={goToScan} onOpenVariation={openVariation} />}
      {screen === "upload" && <UploadScreen onFile={handleFile} onBack={() => setScreen("dashboard")} error={error} />}
      {screen === "scanning" && file && <ScanningScreen fileName={file.name} />}
      {screen === "results" && result && file && <ResultsScreen result={result} fileName={file.name} onBack={goToScan} onBuildEstimate={handleNewEstimate} />}
      {screen === "estimate" && result && file && <EstimateEditor result={result} fileName={file.name} onBack={() => setScreen("dashboard")} />}
      {screen === "variation" && variationPair && (
        <VariationReport
          projectName={variationPair.projectName}
          previous={variationPair.previous}
          current={variationPair.current}
          detectedRiskFlags={variationPair.detectedRiskFlags}
          onBack={() => setScreen(selectedProject ? "project" : "dashboard")}
          onOpenScan={goToScan}
        />
      )}
    </>
  );
}
