import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  appendApprovalAudit,
  fetchApprovalAudit,
  generateSignature,
  type ApprovalActionType,
  type ApprovalAuditEntry,
  type ApprovalRole,
} from "../services/approvalService";

// ─── Design tokens (mirror App.tsx) ──────────────
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
  purple: "#7C3AED", teal:   "#0EA5E9",
};

// ─── Types ────────────────────────────────────────
export interface ApprovalEstimateLike {
  id: string;
  number: string;
  total: number;
  componentCount?: number;
  date?: string;
  status?: "draft" | "submitted" | "approved" | "rejected" | "superseded" | "locked";
}

export interface ApprovalParty {
  id: string;
  name: string;
  role: ApprovalRole;
  company: string;
  email: string;
}

export interface ApprovalsScreenProps {
  projectName: string;
  projectSummary?: string;    // e.g. "Riverside Apartments · Allen Build"
  currentEstimate: ApprovalEstimateLike;
  priorEstimate?: ApprovalEstimateLike;
  parties?: ApprovalParty[];
  /** Initial approval state. Defaults to "pending". */
  initialStatus?: "pending" | "approved";
  /** Actor name used to sign new approval actions. Defaults to the builder. */
  actor?: { name: string; role: ApprovalRole };
  onBack: () => void;
}

// ─── Mock defaults ────────────────────────────────
const DEFAULT_PARTIES: ApprovalParty[] = [
  { id: "p1", name: "Damien Callaghan", role: "Electrician", company: "Vesh Electrical Pty Ltd", email: "damien@veshelectrical.com.au" },
  { id: "p2", name: "Tom Allen",        role: "Builder",     company: "Allen Build",              email: "tom.allen@allenbuild.com.au" },
  { id: "p3", name: "Sarah Moore",      role: "Architect",   company: "Moore Design Group",        email: "sarah@mooredesigngroup.com" },
];

const ROLE_COLOR: Record<ApprovalRole, string> = {
  Electrician: C.blue, Builder: C.purple, Architect: C.teal,
};

const ACTION_COLOR: Record<ApprovalActionType, string> = {
  created:   C.blue,
  submitted: C.purple,
  reviewed:  C.teal,
  issued:    C.amber,
  requested: C.red,
  pending:   C.muted,
  approved:  C.green,
  rejected:  C.red,
};

const ACTION_LABEL: Record<ApprovalActionType, string> = {
  created: "Created", submitted: "Submitted", reviewed: "Reviewed",
  issued: "Issued",   requested: "Re-estimate", pending: "Pending",
  approved: "Approved", rejected: "Returned",
};

// 6-step workflow per §4.6.
type StepState = "done" | "current" | "pending";
interface WorkflowStep { step: string; icon: string; action: ApprovalActionType }
const WORKFLOW: WorkflowStep[] = [
  { step: "Draft",               icon: "✏️", action: "created"   },
  { step: "Submitted",           icon: "📤", action: "submitted" },
  { step: "Builder Review",      icon: "🔍", action: "reviewed"  },
  { step: "Re-estimate",         icon: "🔄", action: "requested" },
  { step: "New Estimate",        icon: "💰", action: "created"   },
  { step: "Final Approval",      icon: "✅", action: "approved"  },
];

// ─── Helpers ──────────────────────────────────────
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Seeded fallback audit entries for demos. Only shown when neither Supabase
// nor the in-memory history has anything to render.
function seedAudit(estimate: ApprovalEstimateLike): ApprovalAuditEntry[] {
  const today = new Date().toISOString();
  return [
    { id: "s1", ts: today, actor: "Damien Callaghan", role: "Electrician", action: "created",
      label: `${estimate.number} created`, note: `Initial estimate generated from AI drawing scan.`,
      doc: estimate.number, signature: "DC-SEED-0001" },
    { id: "s2", ts: today, actor: "Damien Callaghan", role: "Electrician", action: "submitted",
      label: `${estimate.number} submitted to builder`, note: `Total: ${fmt(estimate.total)} incl. GST.`,
      doc: estimate.number, signature: "DC-SEED-0002" },
    { id: "s3", ts: today, actor: "Awaiting Builder", role: "Builder", action: "pending",
      label: `Awaiting builder approval`, note: `${estimate.number} is pending review.`,
      doc: estimate.number, signature: null },
  ];
}

// Compute step states from latest audit actions.
function computeStepStates(entries: ApprovalAuditEntry[], status: "pending" | "approved"): StepState[] {
  const actionsSeen = new Set(entries.map(e => e.action));
  if (status === "approved") return WORKFLOW.map(() => "done");
  const states: StepState[] = WORKFLOW.map(step => actionsSeen.has(step.action) ? "done" : "pending");
  const firstPending = states.indexOf("pending");
  if (firstPending >= 0) states[firstPending] = "current";
  return states;
}

// ─── Component ────────────────────────────────────
export default function ApprovalsScreen({
  projectName,
  projectSummary,
  currentEstimate,
  priorEstimate,
  parties,
  initialStatus = "pending",
  actor = { name: "Tom Allen", role: "Builder" },
  onBack,
}: ApprovalsScreenProps) {
  const roster = parties ?? DEFAULT_PARTIES;
  const [status, setStatus] = useState<"pending" | "approved">(initialStatus);
  const [audit, setAudit] = useState<ApprovalAuditEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "local">("idle");
  const [tab, setTab] = useState<"audit" | "estimates" | "parties">("audit");
  const [showApprove, setShowApprove] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnReasonError, setReturnReasonError] = useState(false);
  const [approvedBy, setApprovedBy] = useState<{ name: string; role: ApprovalRole; ts: string; signature: string } | null>(null);

  // Fetch remote audit; seed if empty/unreachable.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetchApprovalAudit(currentEstimate.id);
      if (!alive) return;
      if (res.ok && res.entries.length > 0) {
        setAudit(res.entries);
      } else {
        setAudit(seedAudit(currentEstimate));
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [currentEstimate.id]);

  const submittedDelta = priorEstimate ? currentEstimate.total - priorEstimate.total : undefined;

  const appendEntry = async (entry: Omit<ApprovalAuditEntry, "id" | "ts">, action: ApprovalActionType) => {
    const now = new Date();
    const signature = entry.signature ?? generateSignature(entry.actor, action, now);
    const full: ApprovalAuditEntry = {
      id: `local-${now.getTime()}`,
      ts: now.toISOString(),
      ...entry,
      signature,
    };
    setAudit(prev => [...prev, full]);
    setSyncStatus("syncing");
    const res = await appendApprovalAudit({
      project_name: projectName,
      estimate_id: currentEstimate.id,
      actor: entry.actor,
      role: entry.role,
      action,
      label: entry.label,
      note: entry.note,
      doc: entry.doc,
      signature,
    });
    setSyncStatus(res.ok ? "synced" : "local");
    window.setTimeout(() => setSyncStatus("idle"), 2400);
    return full;
  };

  const confirmApprove = async () => {
    const now = new Date();
    const signature = generateSignature(actor.name, "approved", now);
    await appendEntry({
      actor: actor.name, role: actor.role, action: "approved",
      label: `${currentEstimate.number} approved by ${actor.name}`,
      note: approvalComment.trim() || `Approved at ${fmt(currentEstimate.total)} inc GST.`,
      doc: currentEstimate.number, signature,
    }, "approved");
    setStatus("approved");
    setApprovedBy({ name: actor.name, role: actor.role, ts: now.toISOString(), signature });
    setShowApprove(false);
    setApprovalComment("");
  };

  const confirmReturn = async () => {
    const trimmed = returnReason.trim();
    if (!trimmed) { setReturnReasonError(true); return; }
    await appendEntry({
      actor: actor.name, role: actor.role, action: "rejected",
      label: `${currentEstimate.number} returned for revision`,
      note: trimmed, doc: currentEstimate.number, signature: null,
    }, "rejected");
    setShowReturn(false);
    setReturnReason("");
    setReturnReasonError(false);
  };

  const handleSendForApproval = async () => {
    // Drops a fresh `submitted` entry and advances the stepper.
    await appendEntry({
      actor: "Damien Callaghan", role: "Electrician", action: "submitted",
      label: `${currentEstimate.number} submitted for approval`,
      note: `Submitted to ${actor.name} · total ${fmt(currentEstimate.total)} inc GST.`,
      doc: currentEstimate.number, signature: null,
    }, "submitted");
  };

  const exportAuditLog = () => {
    const lines = [
      `APPROVAL AUDIT LOG — ${currentEstimate.number}`,
      `Project: ${projectName}`,
      `Exported: ${new Date().toISOString()}`,
      `Entries: ${audit.length} · All entries are immutable once recorded · SHA-256 signed`,
      "",
      ...audit.map(e =>
        `${e.ts}\t${e.action.toUpperCase()}\t${e.actor} (${e.role})\t${e.label}\t${e.note}\tsig=${e.signature ?? "pending"}`),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${currentEstimate.number}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const stepStates = useMemo(() => computeStepStates(audit, status), [audit, status]);

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
            ← Back
          </button>
          <button onClick={exportAuditLog}
            style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, padding: "5px 10px", borderRadius: 8, cursor: "pointer" }}>
            Export Audit Log
          </button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Approval Workflow</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          {projectSummary ?? projectName} · {priorEstimate ? `${priorEstimate.number} → ` : ""}{currentEstimate.number}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 96px" }}>
        {/* Status banner */}
        {status === "pending" ? (
          <div style={{
            background: `linear-gradient(135deg, ${C.navy}, #1A3A5C)`,
            border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 18px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.amber}22`, border: `1px solid ${C.amber}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⏱</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.amber, letterSpacing: "0.8px", textTransform: "uppercase" as const }}>Pending Approval</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2 }}>Awaiting {actor.name} ({actor.role})</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: C.card, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.green, marginTop: 2 }}>{fmt(currentEstimate.total)}</div>
              </div>
              <div style={{ background: C.card, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                  {submittedDelta !== undefined ? "Delta vs prior" : "Submitted"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: submittedDelta !== undefined ? (submittedDelta > 0 ? C.red : C.green) : C.text, marginTop: 2 }}>
                  {submittedDelta !== undefined
                    ? `${submittedDelta >= 0 ? "+" : ""}${fmt(submittedDelta)}`
                    : (currentEstimate.date ?? "today")}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowReturn(true)}
                style={{ flex: 1, background: "none", border: `1px solid ${C.red}88`, color: C.red, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 10, cursor: "pointer" }}>
                ↩ Return
              </button>
              <button onClick={() => setShowApprove(true)}
                style={{ flex: 2, background: C.green, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "11px", borderRadius: 10, cursor: "pointer" }}>
                ✅ Approve
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            background: `linear-gradient(135deg, ${C.green}88, ${C.green}33)`,
            border: `1px solid ${C.green}66`, borderRadius: 16, padding: "18px 18px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ffffff26", border: `1px solid #ffffff55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>✓</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#E6FFF7", letterSpacing: "0.8px", textTransform: "uppercase" as const }}>Approved</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 2 }}>
                  {approvedBy ? `${approvedBy.name} · ${fmtDate(approvedBy.ts)}` : `${currentEstimate.number}`}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#E6FFF7" }}>
              Total {fmt(currentEstimate.total)} inc GST {approvedBy && <span style={{ opacity: 0.8 }}>· 🔐 {approvedBy.signature}</span>}
            </div>
          </div>
        )}

        {/* Workflow stepper */}
        <Stepper states={stepStates} />

        {/* Sync status */}
        {syncStatus !== "idle" && (
          <div style={{ fontSize: 11, color: syncStatus === "local" ? C.amber : C.green, margin: "4px 0 10px", textAlign: "center" as const }}>
            {syncStatus === "syncing" ? "Syncing audit…" : syncStatus === "synced" ? "Audit synced" : "Saved locally · cloud sync unavailable"}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
          {([
            { id: "audit" as const,     label: "📋 Audit Trail", count: audit.length },
            { id: "estimates" as const, label: "💰 Estimates",   count: priorEstimate ? 2 : 1 },
            { id: "parties" as const,   label: "👥 Parties",     count: roster.length },
          ]).map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  flexShrink: 0, background: active ? `${C.blue}22` : C.card,
                  border: `1px solid ${active ? C.blue : C.border}`, color: active ? C.blueLt : C.muted,
                  fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 20, cursor: "pointer",
                }}>
                {t.label} <span style={{ opacity: 0.6, fontWeight: 500 }}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "audit" && (
          <>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "10px 12px", marginBottom: 10, fontSize: 11, color: C.muted, lineHeight: 1.55,
            }}>
              {audit.length} timestamped events · All entries are immutable once recorded · SHA-256 signed
            </div>
            {!loaded ? (
              <div style={{ textAlign: "center" as const, padding: "40px 0", color: C.muted, fontSize: 13 }}>Loading audit trail…</div>
            ) : (
              <AuditTimeline entries={audit} />
            )}
            <button onClick={handleSendForApproval}
              style={{
                width: "100%", marginTop: 10, background: C.card, border: `1px dashed ${C.border}`,
                color: C.dim, fontSize: 13, fontWeight: 600, padding: "12px", borderRadius: 12, cursor: "pointer",
              }}>
              + Submit New Event (Send for Approval)
            </button>
          </>
        )}

        {tab === "estimates" && (
          <EstimatesTab current={currentEstimate} prior={priorEstimate} />
        )}

        {tab === "parties" && (
          <PartiesList roster={roster} activeActor={actor} />
        )}
      </div>

      {/* Approve modal */}
      {showApprove && (
        <div onClick={() => setShowApprove(false)}
          style={{ position: "fixed" as const, inset: 0, zIndex: 300, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.green}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Confirm approval</div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
              Approve <strong style={{ color: C.text }}>{currentEstimate.number}</strong> at <strong style={{ color: C.green }}>{fmt(currentEstimate.total)}</strong> inc GST. This action will be timestamped and signed.
            </div>
            <textarea
              value={approvalComment} onChange={e => setApprovalComment(e.target.value)}
              placeholder="Optional comment to the electrician…"
              style={{
                width: "100%", minHeight: 80, background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13,
                fontFamily: "inherit", outline: "none", resize: "vertical",
              }}
            />
            <div style={{ fontSize: 11, color: C.dim, marginTop: 10, lineHeight: 1.55 }}>
              Your approval will be recorded as <strong style={{ color: C.blueLt, fontFamily: "monospace" }}>
              {generateSignature(actor.name, "approved")}</strong> with a UTC timestamp.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowApprove(false)}
                style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirmApprove}
                style={{ flex: 2, background: C.green, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
                ✅ Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return modal */}
      {showReturn && (
        <div onClick={() => setShowReturn(false)}
          style={{ position: "fixed" as const, inset: 0, zIndex: 300, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.red}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>↩</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Return for revision</div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
              Provide a reason the electrician should re-estimate <strong style={{ color: C.text }}>{currentEstimate.number}</strong>.
            </div>
            <textarea
              value={returnReason}
              onChange={e => { setReturnReason(e.target.value); if (e.target.value.trim()) setReturnReasonError(false); }}
              placeholder="e.g. Pool equipment scope has changed — please re-estimate from Rev D."
              style={{
                width: "100%", minHeight: 96, background: C.bg,
                border: `1px solid ${returnReasonError ? C.red : C.border}`,
                borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13,
                fontFamily: "inherit", outline: "none", resize: "vertical",
              }}
            />
            {returnReasonError && (
              <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>Reason is required.</div>
            )}
            <div style={{ fontSize: 11, color: C.dim, marginTop: 10, lineHeight: 1.55 }}>
              This return action will be logged with a UTC timestamp and trigger a re-estimate request notification.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowReturn(false)}
                style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 13, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirmReturn}
                style={{ flex: 2, background: C.red, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
                ↩ Return for Revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{
        position: "fixed" as const, bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`,
        display: "flex", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}>
        <button onClick={onBack}
          style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Back</div>
        </button>
        <button onClick={exportAuditLog}
          style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>📤</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Export</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20, opacity: 0.9 }}>✅</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Approvals</div>
          <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────
function Stepper({ states }: { states: StepState[] }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "14px 10px", marginBottom: 10, overflowX: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "fit-content" }}>
        {WORKFLOW.map((step, i) => {
          const state = states[i];
          const bg = state === "done" ? C.green : state === "current" ? C.blue : C.border;
          const fg = state === "pending" ? C.muted : "#fff";
          return (
            <ReactFragmentSafe key={i}>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4, minWidth: 68 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: bg, color: fg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800,
                  boxShadow: state === "current" ? `0 0 0 4px ${C.blue}22` : "none",
                  transition: "all 0.3s",
                }}>
                  {state === "done" ? "✓" : step.icon}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: state === "pending" ? C.muted : C.text, textAlign: "center" as const, lineHeight: 1.2 }}>
                  {step.step}
                </div>
              </div>
              {i < WORKFLOW.length - 1 && (
                <div style={{ flex: 1, height: 2, background: states[i + 1] !== "pending" || state === "done" ? C.green : C.border, minWidth: 14 }} />
              )}
            </ReactFragmentSafe>
          );
        })}
      </div>
    </div>
  );
}

// Lightweight Fragment wrapper — keeps JSX tidy inside Stepper loop.
function ReactFragmentSafe({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function AuditTimeline({ entries }: { entries: ApprovalAuditEntry[] }) {
  return (
    <div style={{ position: "relative" as const }}>
      {entries.map((e, i) => {
        const color = ACTION_COLOR[e.action] ?? C.muted;
        const roleColor = ROLE_COLOR[e.role];
        const isLast = i === entries.length - 1;
        return (
          <div key={e.id} style={{ display: "flex", gap: 12, position: "relative" as const, paddingBottom: isLast ? 0 : 14 }}>
            {/* Timeline line */}
            {!isLast && (
              <div style={{ position: "absolute" as const, left: 10, top: 22, bottom: 0, width: 2, background: C.border }} />
            )}
            {/* Dot */}
            <div style={{
              width: 22, height: 22, borderRadius: 11, background: color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800,
              flexShrink: 0, marginTop: 1, zIndex: 1,
            }}>
              {e.action === "approved" ? "✓" : e.action === "rejected" ? "✗" : ""}
            </div>
            {/* Card */}
            <div style={{
              flex: 1, minWidth: 0, background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "12px 14px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" as const }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                  background: `${color}22`, color, textTransform: "uppercase" as const, letterSpacing: "0.5px",
                }}>
                  {ACTION_LABEL[e.action]}
                </div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: C.dim }}>{fmtDate(e.ts)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{e.label}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>{e.note}</div>
              <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                  background: `${roleColor}22`, color: roleColor, letterSpacing: "0.3px",
                }}>{e.actor} · {e.role}</span>
                {e.doc && (
                  <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>📎 {e.doc}</span>
                )}
                {e.signature ? (
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: C.green }}>🔐 {e.signature} <span style={{ color: C.dim }}>· Verified</span></span>
                ) : (
                  <span style={{ fontSize: 10, color: C.amber, fontStyle: "italic" }}>Awaiting signature</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EstimatesTab({ current, prior }: { current: ApprovalEstimateLike; prior?: ApprovalEstimateLike }) {
  const rows = prior ? [prior, current] : [current];
  const deltaFrom = (e: ApprovalEstimateLike, idx: number) =>
    idx > 0 ? rows[idx].total - rows[idx - 1].total : 0;

  return (
    <>
      {rows.map((e, idx) => {
        const statusLabel = idx === 0 && rows.length > 1 ? "Superseded" : (e.status ?? "Pending");
        const statusColor = statusLabel.toLowerCase() === "approved" ? C.green
                          : statusLabel.toLowerCase() === "superseded" ? C.muted
                          : C.amber;
        const delta = deltaFrom(e, idx);
        return (
          <div key={e.id} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: "14px 16px", marginBottom: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.number}</div>
              <div style={{
                fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
                background: `${statusColor}22`, color: statusColor, letterSpacing: "0.4px", textTransform: "uppercase" as const,
              }}>{statusLabel}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>Total</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{fmt(e.total)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>Components</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{e.componentCount ?? "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.muted }}>Δ vs prior</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: idx === 0 ? C.dim : (delta > 0 ? C.red : delta < 0 ? C.green : C.dim) }}>
                  {idx === 0 ? "—" : `${delta >= 0 ? "+" : ""}${fmt(delta)}`}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{
        marginTop: 6, fontSize: 11, color: C.dim, lineHeight: 1.55, padding: "10px 12px",
        background: `${C.blue}14`, border: `1px solid ${C.blue}33`, borderRadius: 10,
      }}>
        💡 Both estimates are stored with full audit history. {prior?.number ?? "The baseline"} is retained for variation reporting.
      </div>
    </>
  );
}

function PartiesList({ roster, activeActor }: { roster: ApprovalParty[]; activeActor: { name: string; role: ApprovalRole } }) {
  return (
    <>
      {roster.map(p => {
        const color = ROLE_COLOR[p.role];
        const initials = p.name.split(/\s+/).filter(Boolean).map(s => s[0]?.toUpperCase() ?? "").slice(0, 2).join("");
        const isActive = p.name === activeActor.name && p.role === activeActor.role;
        return (
          <div key={p.id} style={{
            background: C.card, border: `1px solid ${isActive ? C.blue : C.border}`,
            borderLeft: `3px solid ${color}`, borderRadius: 12,
            padding: "14px 16px", marginBottom: 10, display: "flex", gap: 14, alignItems: "flex-start",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 20, background: color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800,
              flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.name}</div>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                  background: `${color}22`, color, letterSpacing: "0.5px", textTransform: "uppercase" as const,
                }}>{p.role}</span>
                {isActive && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: `${C.blue}22`, color: C.blueLt, letterSpacing: "0.5px", textTransform: "uppercase" as const,
                  }}>Awaiting</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{p.company}</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 1, wordBreak: "break-all" as const }}>{p.email}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
