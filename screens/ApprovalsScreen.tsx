import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Send,
  Clock,
  FileDown,
  Save,
  AlertTriangle,
  ArrowLeft,
  User,
} from "lucide-react";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import {
  Card,
  Footer,
  B,
  MiniStat,
} from "../components/ui/anthropic";
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";

// ─── Mock signatories ───────────────────────────────────────────────────
interface Signatory {
  id: number;
  name: string;
  role: string;
  email: string;
  status: "signed" | "awaiting" | "pending";
  initials: string;
  color: string;
}

const SIGNATORIES: Signatory[] = [
  { id: 1, name: "James Caldwell",  role: "Builder",     email: "j.caldwell@caldwellbuilds.com.au",    status: "awaiting", initials: "JC", color: C.blue },
  { id: 2, name: "Sarah Brennan",   role: "Architect",   email: "s.brennan@brennanarchitects.com.au",  status: "pending",  initials: "SB", color: C.green },
  { id: 3, name: "Tom Nguyen",      role: "Vesh Electrical", email: "t.nguyen@veshelectrical.com.au",  status: "pending",  initials: "TN", color: C.amber },
];

const TIMELINE_STEPS = [
  { label: "Estimate Locked",       sub: "EST-26-001-v3 finalised, read-only",       ts: "31 Mar 2026 · 09:14 AEST",  done: true },
  { label: "Envelope Created & Sent", sub: "Envelope sent via DocuSign",              ts: "Just now",                   done: true },
  { label: "Builder Signs",          sub: "James Caldwell — awaiting",                ts: null,                         done: false },
  { label: "Architect Signs",        sub: "Sarah Brennan — awaiting",                 ts: null,                         done: false },
  { label: "Fully Executed",         sub: "All parties signed — archived",             ts: null,                         done: false },
];

const ENVELOPE_PAYLOAD = `// POST https://au.docusign.net/restapi/v2.1
// /accounts/e356b280-50f6-45cf-a9ee-
//   45e21cac0fe5/envelopes

{
  "emailSubject": "EST-26-001-v3 Approval",
  "status": "sent",
  "sender": "Damien Callaghan",
  "documents": [/* locked estimate PDF */],
  "recipients": {
    "signers": [
      { "routingOrder": 1, "role": "Builder" },
      { "routingOrder": 2, "role": "Architect" },
      { "routingOrder": 3, "role": "Vendor" }
    ]
  }
}`;

const MCP_CAPABILITIES = [
  { label: "getUserInfo",                  desc: "Damien Callaghan · damienc13@gmail.com · AU datacenter confirmed", live: true },
  { label: "getAccount",                   desc: "Account e356b280 · base_uri: au.docusign.net",                    live: true },
  { label: "createEnvelope",               desc: "Ready to create & send signed envelopes from ElectraScan",         live: true },
  { label: "getEnvelopes / listRecipients", desc: "Poll live signing status per signatory",                          live: true },
  { label: "getWorkflowsList / triggerWorkflow", desc: "Maestro workflows need beta access",                          live: false },
  { label: "getAllAgreements",              desc: "Agreement repository access pending beta approval",                 live: false },
];

// ─── Screen ─────────────────────────────────────────────────────────────
export default function ApprovalsScreen() {
  const navigate = useNavigate();
  const [signatories, setSignatories] = useState<Signatory[]>(SIGNATORIES);
  const [sent, setSent] = useState(false);

  const simulateSign = (id: number) => {
    setSignatories(prev =>
      prev.map(s => {
        if (s.id === id) return { ...s, status: "signed" as const };
        if (s.id === id + 1 && s.status === "pending") return { ...s, status: "awaiting" as const };
        return s;
      }),
    );
  };

  const allSigned = signatories.every(s => s.status === "signed");

  return (
    <div className="anim-in">
      <button
        className="es-link"
        onClick={() => navigate("/estimate")}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted, fontFamily: FONT.heading, marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to estimates
      </button>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          Approvals
        </h1>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textSubtle }}>EST-26-001-v3</span>
      </div>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: "0 0 28px 0" }}>
        Toorak Residential Stage 2 · DocuSign multi-party signing workflow
      </p>

      {/* Main content — 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr", gap: 20, marginBottom: 28 }}>

        {/* Column 1 — Envelope message + signatories */}
        <div>
          {/* Envelope message */}
          <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 10 }}>
            Step 2 — Envelope Message
          </div>
          <Card style={{ padding: "20px 22px", marginBottom: 20 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 6 }}>Subject Line</div>
            <div style={{ padding: "10px 14px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.bg, fontSize: 14, marginBottom: 16 }}>
              Approval Required: Electrical Estimate EST-26-001-v3 — Toorak Residential Stage 2
            </div>

            <div style={{ fontFamily: FONT.heading, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 6 }}>Message to Signatories</div>
            <div style={{ padding: "12px 14px", borderRadius: RADIUS.md, border: `1px solid ${C.border}`, backgroundColor: C.bg, fontSize: 14, lineHeight: 1.65, minHeight: 100 }}>
              <p style={{ margin: "0 0 10px 0" }}>
                Please review and sign the attached electrical estimate for Toorak Residential Stage 2. This estimate has been locked and verified by Vesh Electrical Services Pty Ltd. Pricing is effective 31 March 2026.
              </p>
              <p style={{ margin: 0, color: C.textMuted }}>
                Total: <B>$187,450 excl. GST</B> ($206,195 incl. GST) | 342 detection points | 3 risk flags attached for review.
              </p>
            </div>
          </Card>

          {/* Signatories */}
          <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 10 }}>
            Step 3 — Signature Tracking
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signatories.map(sig => {
              const statusColor = sig.status === "signed" ? C.green : sig.status === "awaiting" ? C.amber : C.textSubtle;
              const statusLabel = sig.status === "signed" ? "Signed" : sig.status === "awaiting" ? "Sent · Awaiting action" : "Pending — awaiting signatory " + (sig.id - 1);
              return (
                <Card key={sig.id} style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: sig.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.heading, fontWeight: 500, fontSize: 13, flexShrink: 0 }}>
                      {sig.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 500 }}>{sig.name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {sig.role} · {sig.email}
                      </div>
                      <div style={{ fontSize: 12, color: statusColor, fontFamily: FONT.heading, fontWeight: 500, marginTop: 2 }}>
                        {statusLabel}
                      </div>
                    </div>
                    {sig.status === "signed" && (
                      <CheckCircle2 size={20} color={C.green} />
                    )}
                    {sig.status === "awaiting" && (
                      <GhostButton onClick={() => simulateSign(sig.id)}>Simulate: Sign</GhostButton>
                    )}
                    {sig.status === "pending" && (
                      <Clock size={18} color={C.textSubtle} />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Column 2 — DocuSign API workflow + envelope payload */}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 10 }}>
            DocuSign API Workflow — How It Connects
          </div>

          {/* MCP Capabilities */}
          <Card style={{ padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 12 }}>
              MCP Capabilities — Live Status
            </div>
            {MCP_CAPABILITIES.map((cap, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontFamily: FONT.heading, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, backgroundColor: cap.live ? C.greenSoft : C.amberSoft, color: cap.live ? C.green : C.amber, flexShrink: 0, marginTop: 2 }}>
                  {cap.live ? "✓ LIVE" : "BETA"}
                </span>
                <div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500 }}>{cap.label}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{cap.desc}</div>
                </div>
              </div>
            ))}
          </Card>

          {/* Envelope Payload */}
          <Card style={{ padding: "18px 20px" }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 10 }}>
              Envelope Payload
            </div>
            <pre style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 1.6, color: C.textMuted, backgroundColor: C.bg, padding: 14, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>
              {ENVELOPE_PAYLOAD}
            </pre>
          </Card>
        </div>

        {/* Column 3 — Signing workflow timeline */}
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textSubtle, marginBottom: 10 }}>
            Signing Workflow
          </div>
          <Card style={{ padding: "20px 22px" }}>
            {TIMELINE_STEPS.map((step, i) => {
              const isDone = step.done || (i <= 1 && sent);
              return (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: i < TIMELINE_STEPS.length - 1 ? 20 : 0, position: "relative" }}>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div style={{ position: "absolute", left: 13, top: 28, width: 2, height: 20, backgroundColor: isDone ? C.green : C.border }} />
                  )}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: isDone ? C.green : C.border,
                    color: isDone ? "#fff" : C.textSubtle,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: FONT.heading, fontWeight: 600, fontSize: 12,
                  }}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, color: isDone ? C.text : C.textMuted }}>{step.label}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{step.sub}</div>
                    {step.ts && <div style={{ fontSize: 11, color: C.textSubtle, fontFamily: FONT.mono, marginTop: 2 }}>{step.ts}</div>}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ padding: "16px 20px", backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600 }}>Ready to send for approval?</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Estimate EST-26-001-v3 is locked · <span style={{ color: C.green, fontWeight: 500 }}>$187,450</span> excl. GST · 3 signatories configured
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <GhostButton icon={<FileDown size={14} />}>Preview PDF</GhostButton>
          <GhostButton icon={<Save size={14} />}>Save Draft</GhostButton>
          <PrimaryButton
            icon={sent || allSigned ? <CheckCircle2 size={15} /> : <Send size={15} />}
            onClick={() => setSent(true)}
            disabled={allSigned}
          >
            {allSigned ? "Fully Executed" : sent ? "✓ Envelope Sent" : "Send for Approval"}
          </PrimaryButton>
        </div>
      </div>

      <Footer />
    </div>
  );
}
