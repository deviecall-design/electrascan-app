import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIncomingEmails, updateIncomingEmailStatus,
  fetchAutoScanPref, upsertAutoScanPref,
  type IncomingEmail, type EmailScanStatus,
} from "../services/emailUploadService";

// ─── Design tokens (mirror App.tsx) ──────────────
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
  purple: "#7C3AED", teal:   "#0EA5E9",
};

export interface EmailUploadProps {
  /** Tenant's display name / user prefix (e.g. "damien.callaghan"). */
  userHandle?: string;
  /** User's primary email address — used to key per-user prefs in Supabase. */
  userEmail?: string;
  /** Tenant slug used to build the inbox address: drawings@{slug}.electrascan.app. */
  tenantSlug?: string;
  /** Called when the user opts to scan manually (kicks off the existing Upload flow). */
  onUploadManual?: () => void;
  onBack: () => void;
}

// ─── Mock fallback inbox ──────────────────────────
// Seed data shown when Supabase has no rows yet or is unreachable. Mirrors the
// prototype's MOCK_EMAILS so the screen demos cleanly.
const SEED_INBOX: IncomingEmail[] = [
  {
    id: "seed-1",
    from: "sarah.moore@mooredesign.com.au",
    subject: "Riverside Apts — Arch Rev C E-Drawings",
    file: "Arch-RevC-Electrical.pdf", fileKind: "pdf", pages: 8,
    received: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "scanned", project: "Riverside Apartments",
    estimateId: "EST-2026-001-001",
  },
  {
    id: "seed-2",
    from: "tim.walsh@walshdrafting.com.au",
    subject: "Brighton Residence — Revised Plans v3",
    file: "Brighton-Rev3-Elec.pdf", fileKind: "pdf", pages: 5,
    received: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    status: "scanned", project: "Brighton Residence",
    estimateId: "EST-2026-312-002",
  },
  {
    id: "seed-3",
    from: "drafting@constructco.com.au",
    subject: "Southbank Office — Electrical Layouts",
    file: "Southbank-E01-E04.pdf", fileKind: "pdf", pages: 12,
    received: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: "queued", project: "Unassigned",
  },
  {
    id: "seed-4",
    from: "damien@veshelectrical.com.au",
    subject: "Site photo — pool area conduit run",
    file: "IMG_4823.jpg", fileKind: "image", pages: 1,
    received: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    status: "scanned", project: "Brighton Residence",
  },
];

// ─── Helpers ──────────────────────────────────────
const fmtRel = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
};

const fileIcon = (kind: "pdf" | "image") => kind === "pdf" ? "📄" : "🖼️";

// ─── Component ────────────────────────────────────
export default function EmailUpload({
  userHandle = "damien.callaghan",
  userEmail = "damien@veshelectrical.com.au",
  tenantSlug = "vesh",
  onUploadManual,
  onBack,
}: EmailUploadProps) {
  const inboxAddress = `drawings@${tenantSlug}.electrascan.app`;
  const devMode =
    typeof window !== "undefined" &&
    window.localStorage.getItem("electrascan_dev_mode") === "true";

  const [inbox, setInbox] = useState<IncomingEmail[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "ok" | "local">("idle");
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Record<string, number>>({});

  // Hydrate inbox + prefs on mount. In dev mode the seed inbox provides demo
  // data; production shows an empty state until emails actually arrive.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [emailsRes, prefRes] = await Promise.all([
        fetchIncomingEmails(inboxAddress),
        fetchAutoScanPref(userEmail),
      ]);
      if (!alive) return;
      if (emailsRes.ok && emailsRes.emails.length > 0) {
        setInbox(emailsRes.emails);
      } else if (devMode) {
        setInbox(SEED_INBOX);
      } else {
        setInbox([]);
      }
      if (prefRes.ok) setAutoScan(prefRes.autoScan);
      setLoaded(true);
    })();
    return () => {
      alive = false;
      // Clear any running scan timers when unmounting.
      Object.values(timersRef.current).forEach(id => window.clearTimeout(id));
      timersRef.current = {};
    };
  }, [inboxAddress, userEmail, devMode]);

  const simulateReceive = () => {
    const now = new Date();
    const mock: IncomingEmail = {
      id: `mock-${now.getTime()}`,
      from: "builder@allenbuild.com.au",
      subject: `Simulated drawing — ${now.toLocaleTimeString("en-AU")}`,
      file: `Simulated-${now.getTime()}.pdf`,
      fileKind: "pdf",
      pages: 4,
      received: now.toISOString(),
      status: "queued",
      project: "Unassigned",
    };
    setInbox(prev => [mock, ...prev]);
  };

  // Auto-scan toggle side-effect: when turning ON, kick any queued emails
  // through the simulated scan so the badge state stays consistent.
  useEffect(() => {
    if (!autoScan || !loaded) return;
    inbox.filter(e => e.status === "queued" && !scanningIds.has(e.id)).forEach(e => {
      triggerScan(e.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan, loaded]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(inboxAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select a hidden input. For mobile browsers without clipboard API.
      const ta = document.createElement("textarea");
      ta.value = inboxAddress;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
      finally { document.body.removeChild(ta); }
    }
  };

  const shareAddress = () => {
    const subject = encodeURIComponent("My drawings inbox");
    const body = encodeURIComponent(
      `Hi,\n\nYou can forward electrical drawings directly to my drawings inbox:\n\n${inboxAddress}\n\n` +
      `Any PDF or DWG attachment will be auto-detected and queued.\n\nThanks,\n${userHandle.replace(/[._]/g, " ")}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const toggleAutoScan = async () => {
    const next = !autoScan;
    setAutoScan(next);
    const res = await upsertAutoScanPref(userEmail, next);
    setSyncStatus(res.ok ? "ok" : "local");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  const setStatusLocal = (id: string, status: EmailScanStatus, estimateId?: string) => {
    setInbox(prev => prev.map(e => e.id === id
      ? { ...e, status, estimateId: estimateId ?? e.estimateId }
      : e));
  };

  const triggerScan = (id: string) => {
    const target = inbox.find(e => e.id === id);
    if (!target || target.status === "scanning" || target.status === "scanned") return;

    setScanningIds(prev => { const s = new Set(prev); s.add(id); return s; });
    setStatusLocal(id, "scanning");
    void updateIncomingEmailStatus(id, "scanning");

    const timeout = window.setTimeout(async () => {
      const newEstId = `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}-001`;
      setStatusLocal(id, "scanned", newEstId);
      setScanningIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      const res = await updateIncomingEmailStatus(id, "scanned", newEstId);
      setSyncStatus(res.ok ? "ok" : "local");
      window.setTimeout(() => setSyncStatus("idle"), 1600);
      delete timersRef.current[id];
    }, 2200);
    timersRef.current[id] = timeout as unknown as number;
  };

  const counts = useMemo(() => ({
    total: inbox.length,
    queued: inbox.filter(e => e.status === "queued").length,
    scanning: inbox.filter(e => e.status === "scanning").length,
    scanned: inbox.filter(e => e.status === "scanned").length,
  }), [inbox]);

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
            ← Back
          </button>
          {onUploadManual && (
            <button onClick={onUploadManual}
              style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, padding: "5px 10px", borderRadius: 8, cursor: "pointer" }}>
              📤 Upload Manually
            </button>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Email Upload</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Forward drawings to your ElectraScan inbox</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 96px" }}>
        {/* Inbox address card */}
        <div style={{
          background: `linear-gradient(135deg, ${C.navy}, #1A3A5C)`,
          border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 18px", marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${C.blue}22`,
              border: `1px solid ${C.blue}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
            }}>📧</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.blueLt, letterSpacing: "0.8px", textTransform: "uppercase" as const }}>
              Your ElectraScan Inbox
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", marginBottom: 6, wordBreak: "break-all" as const }}>
            drawings<span style={{ color: C.blueLt }}>@{tenantSlug}.electrascan.app</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 12 }}>
            Forward or CC this address on any email with drawing attachments. Plans are automatically detected, queued and scanned.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyAddress}
              style={{
                flex: 2, background: copied ? C.green : C.blue, border: "none",
                color: "#fff", fontSize: 12, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer",
                transition: "background 0.2s",
              }}>
              {copied ? "✓ Copied" : "📋 Copy Address"}
            </button>
            <button onClick={shareAddress}
              style={{
                flex: 1, background: "transparent", border: `1px solid ${C.border}`,
                color: C.muted, fontSize: 12, fontWeight: 600, padding: "10px", borderRadius: 10, cursor: "pointer",
              }}>
              📤 Share
            </button>
          </div>
        </div>

        {/* How it works */}
        <div style={{
          background: `${C.blue}10`, border: `1px solid ${C.blue}33`, borderRadius: 14,
          padding: "14px 16px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.blueLt, letterSpacing: "0.8px", textTransform: "uppercase" as const, marginBottom: 10 }}>
            ⚡ How it works
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {([
              ["1", "📧", "Forward drawings email",  "CC or forward any email with PDF/DWG attachments to your inbox address"],
              ["2", "🔍", "Auto-detection",           "ElectraScan detects drawings in attachments and adds them to your scan queue"],
              ["3", "⚡", "AI Scan",                  "Drawings are scanned automatically — components detected, quantities counted"],
              ["4", "💰", "Estimate ready",           "A draft estimate is generated and linked to the matching project"],
            ] as const).map(([n, ic, title, desc]) => (
              <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11, background: C.teal, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
                }}>{n}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{ic} {title}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-scan toggle */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "12px 14px", marginBottom: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>⚡ Auto-scan incoming drawings</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>
              Queued drawings are scanned automatically without manual approval.
            </div>
          </div>
          <Toggle value={autoScan} onToggle={toggleAutoScan} />
        </div>

        {syncStatus !== "idle" && (
          <div style={{
            fontSize: 11, textAlign: "center" as const, marginBottom: 10,
            color: syncStatus === "ok" ? C.green : C.amber,
          }}>
            {syncStatus === "ok" ? "Saved" : "Saved locally · cloud sync unavailable"}
          </div>
        )}

        {/* Inbox */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "0.8px", textTransform: "uppercase" as const }}>
            Inbox · {counts.total}
          </div>
          <div style={{ fontSize: 10, color: C.dim }}>
            {counts.scanned} scanned · {counts.queued} queued {counts.scanning > 0 ? `· ${counts.scanning} scanning` : ""}
          </div>
        </div>

        {!loaded ? (
          <div style={{ textAlign: "center" as const, padding: "40px 0", color: C.muted, fontSize: 13 }}>Loading inbox…</div>
        ) : inbox.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "48px 20px", color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No drawings received yet</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
              Forward a drawing email to <strong style={{ color: C.blueLt }}>{inboxAddress}</strong> to see it here.
            </div>
          </div>
        ) : (
          inbox.map(e => (
            <InboxRow key={e.id} email={e} onScan={() => triggerScan(e.id)} />
          ))
        )}

        {devMode && (
          <button
            onClick={simulateReceive}
            style={{
              width: "100%", marginTop: 12,
              background: C.card, border: `1px dashed ${C.border}`,
              color: C.dim, fontSize: 12, fontWeight: 700, padding: "12px", borderRadius: 12, cursor: "pointer",
            }}>
            🧪 Simulate Receive (dev only)
          </button>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: "fixed" as const, bottom: 0, left: 0, right: 0, background: C.navy, borderTop: `1px solid ${C.border}`,
        display: "flex", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}>
        <button onClick={onBack}
          style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Projects</div>
        </button>
        <button onClick={copyAddress}
          style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>📧</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Inbox</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20, opacity: 0.9 }}>📨</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Email</div>
          <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────
function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={value}
      role="switch"
      style={{
        width: 48, height: 26, borderRadius: 13,
        background: value ? C.blue : C.border,
        border: "none", cursor: "pointer",
        position: "relative" as const, padding: 0, flexShrink: 0,
        transition: "background 0.2s",
      }}>
      <span style={{
        position: "absolute" as const, top: 3, left: value ? 25 : 3,
        width: 20, height: 20, borderRadius: 10, background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)", transition: "left 0.2s",
      }} />
    </button>
  );
}

function InboxRow({ email, onScan }: { email: IncomingEmail; onScan: () => void }) {
  const isScanning = email.status === "scanning";
  const isScanned  = email.status === "scanned";
  const isError    = email.status === "error";
  const isUnassigned = email.project === "Unassigned";

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "12px 14px", marginBottom: 8, position: "relative" as const, overflow: "hidden",
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* File icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: email.fileKind === "pdf" ? `${C.red}22` : `${C.amber}22`,
          border: `1px solid ${email.fileKind === "pdf" ? C.red : C.amber}44`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
        }}>
          {fileIcon(email.fileKind)}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{email.subject}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2, wordBreak: "break-all" as const }}>
            From: {email.from}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.blueLt, background: `${C.blue}22`, padding: "2px 7px", borderRadius: 4, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
              {email.file}
            </span>
            <span style={{ fontSize: 10, color: C.muted }}>{email.pages}p</span>
            <span style={{
              fontSize: 10, color: isUnassigned ? C.amber : C.dim,
              fontWeight: isUnassigned ? 700 : 500,
            }}>📁 {email.project}</span>
          </div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 6, fontFamily: "monospace" }}>{fmtRel(email.received)}</div>
        </div>

        {/* Status / action */}
        <div style={{ flexShrink: 0, alignSelf: "center" as const }}>
          {isScanning ? (
            <Badge text="⚡ Scanning…" color={C.blueLt} bg={`${C.blue}22`} />
          ) : isScanned ? (
            <Badge text="✓ Scanned" color={C.green} bg={`${C.green}22`} />
          ) : isError ? (
            <Badge text="⚠ Error" color={C.red} bg={`${C.red}22`} />
          ) : (
            <button onClick={onScan}
              style={{
                background: C.blue, color: "#fff", border: "none", borderRadius: 8,
                padding: "6px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer",
              }}>
              Scan Now
            </button>
          )}
        </div>
      </div>

      {/* Scan progress bar */}
      {isScanning && (
        <div style={{ marginTop: 10, height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", background: `linear-gradient(90deg, transparent, ${C.blue}, transparent)`,
            backgroundSize: "40% 100%", backgroundRepeat: "no-repeat",
            animation: "eu-scan 2s ease-in-out infinite",
            width: "100%",
          }} />
        </div>
      )}

      {/* Inline keyframes — inlined so the component is self-contained. */}
      <style>{`
        @keyframes eu-scan {
          0%   { background-position: -40% 0; }
          100% { background-position: 140% 0; }
        }
      `}</style>
    </div>
  );
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color, background: bg,
      padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" as const,
      letterSpacing: "0.3px",
    }}>{text}</span>
  );
}
