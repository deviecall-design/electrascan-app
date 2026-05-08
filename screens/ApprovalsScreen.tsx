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
  Loader2,
} from "lucide-react";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import {
  Card,
  Footer,
  B,
} from "../components/ui/anthropic";
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../contexts/ToastContext";

// ─── Constants ──────────────────────────────────────────────────────────
const ESTIMATE_REF = "EST-26-001-v3";
const PROJECT_NAME = "Toorak Residential Stage 2";
const ESTIMATE_VALUE = 187450;

// Minimal valid placeholder PDF in base64 (single-page text-only).
// DocuSign sandbox accepts any valid PDF — this avoids shipping a real estimate
// PDF in the beta phase.
const PLACEHOLDER_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggOTAKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoyMCA3NjAgVGQKKEVsZWN0cmFTY2FuIEVzdGltYXRlIC0gUGxhY2Vob2xkZXIgRG9jdW1lbnQpIFRqCi9zaWcxLyBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIxNiAwMDAwMCBuIAowMDAwMDAwMjgwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDIxCiUlRU9G";

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
  { id: 1, name: "James Caldwell",  role: "Builder",         email: "j.caldwell@caldwellbuilds.com.au",   status: "awaiting", initials: "JC", color: C.blue  },
  { id: 2, name: "Sarah Brennan",   role: "Architect",       email: "s.brennan@brennanarchitects.com.au", status: "pending",  initials: "SB", color: C.green },
  { id: 3, name: "Tom Nguyen",      role: "Vesh Electrical", email: "t.nguyen@veshelectrical.com.au",     status: "pending",  initials: "TN", color: C.amber },
];

const TIMELINE_STEPS = [
  { label: "Estimate Locked",         sub: "EST-26-001-v3 finalised, read-only",  ts: "31 Mar 2026 · 09:14 AEST", done: true  },
  { label: "Envelope Created & Sent", sub: "Envelope sent via DocuSign",           ts: "Just now",                  done: true  },
  { label: "Builder Signs",           sub: "James Caldwell — awaiting",            ts: null,                        done: false },
  { label: "Architect Signs",         sub: "Sarah Brennan — awaiting",             ts: null,                        done: false },
  { label: "Fully Executed",          sub: "All parties signed — archived",        ts: null,                        done: false },
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
  const { addToast } = useToast();

  const [signatories, setSignatories] = useState<Signatory[]>(SIGNATORIES);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);

  // Signer form — pre-filled from first signatory, editable
  const [signerEmail, setSignerEmail] = useState(SIGNATORIES[0].email);
  const [signerName, setSignerName] = useState(SIGNATORIES[0].name);

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

  const handleSendEnvelope = async () => {
    if (sent || allSigned || sending) return;

    if (!signerEmail.trim() || !signerName.trim()) {
      addToast("Signer name and email are required.", "error");
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/docusign/envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerEmail: signerEmail.trim(),
          signerName: signerName.trim(),
          estimateRef: ESTIMATE_REF,
          projectName: PROJECT_NAME,
          estimateValue: ESTIMATE_VALUE,
          documentBase64: PLACEHOLDER_PDF_BASE64,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }

      const result = await res.json() as { envelopeId: string; status: string };

      // Log to approval_audit (best-effort — don't block the UI on failure)
      supabase
        .from("approval_audit")
        .insert({
          envelope_id: result.envelopeId,
          estimate_ref: ESTIMATE_REF,
          signer_email: signerEmail.trim(),
          action: "envelope_sent",
          actor: "system",
        })
        .then(({ error }) => {
          if (error) {
            console.warn("[ElectraScan] approval_audit insert failed:", error.message);
          }
        });

      setEnvelopeId(result.envelopeId);
      setSent(true);
      addToast(`Envelope sent. ID: ${result.envelopeId}`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addToast(`Could not send envelope: ${message}`, "error");
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    border: `1px solid ${C.border}`,
    borderRadius: RADIUS.md,
    backgroundColor: C.bgCard,
    fontFamily: FONT.body,
    fontSize: 13,
    color: C.text,
    boxSizing: "border-box",
  };

  return (
    <div className="anim-in">
      <button
        className="es-link"
        onClick={() => navigate("/estimate")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: C.textMuted,
          fontFamily: FONT.heading,
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Back to estimates
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <h1
          style={{
            fontFamily: FONT.heading,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Approvals
        </h1>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textSubtle }}>
          {ESTIMATE_REF}
        </span>
      </div>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: "0 0 28px 0" }}>
        {PROJECT_NAME} · DocuSign multi-party signing workflow
      </p>

      {/* Envelope ID success banner */}
      {envelopeId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            backgroundColor: C.greenSoft,
            border: `1px solid ${C.green}`,
            borderRadius: RADIUS.lg,
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={18} color={C.green} style={{ flexShrink: 0 }} />
          <div>
            <span
              style={{
                fontFamily: FONT.heading,
                fontSize: 13,
                fontWeight: 600,
                color: C.green,
              }}
            >
              Envelope sent successfully
            </span>
            <span
              style={{
                fontSize: 12,
                color: C.textMuted,
                fontFamily: FONT.mono,
                marginLeft: 10,
              }}
            >
              {envelopeId}
            </span>
          </div>
        </div>
      )}

      {/* Main content — 3 columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1.5fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* Column 1 — Envelope message + signatories */}
        <div>
          {/* Envelope message */}
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.textSubtle,
              marginBottom: 10,
            }}
          >
            Step 2 — Envelope Message
          </div>
          <Card style={{ padding: "20px 22px", marginBottom: 20 }}>
            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: C.textSubtle,
                marginBottom: 6,
              }}
            >
              Subject Line
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: RADIUS.md,
                border: `1px solid ${C.border}`,
                backgroundColor: C.bg,
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Approval Required: Electrical Estimate {ESTIMATE_REF} — {PROJECT_NAME}
            </div>

            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: C.textSubtle,
                marginBottom: 6,
              }}
            >
              Message to Signatories
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: RADIUS.md,
                border: `1px solid ${C.border}`,
                backgroundColor: C.bg,
                fontSize: 14,
                lineHeight: 1.65,
                minHeight: 100,
              }}
            >
              <p style={{ margin: "0 0 10px 0" }}>
                Please review and sign the attached electrical estimate for {PROJECT_NAME}. This
                estimate has been locked and verified by Vesh Electrical Services Pty Ltd. Pricing
                is effective 31 March 2026.
              </p>
              <p style={{ margin: 0, color: C.textMuted }}>
                Total: <B>${ESTIMATE_VALUE.toLocaleString()} excl. GST</B> ($
                {Math.round(ESTIMATE_VALUE * 1.1).toLocaleString()} incl. GST) | 342 detection
                points | 3 risk flags attached for review.
              </p>
            </div>
          </Card>

          {/* Signer form */}
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.textSubtle,
              marginBottom: 10,
            }}
          >
            Step 2b — Primary Signer
          </div>
          <Card style={{ padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Name
                </label>
                <input
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="James Caldwell"
                  style={inputStyle}
                  disabled={sent}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={e => setSignerEmail(e.target.value)}
                  placeholder="builder@example.com.au"
                  style={inputStyle}
                  disabled={sent}
                />
              </div>
            </div>
          </Card>

          {/* Signatories */}
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.textSubtle,
              marginBottom: 10,
            }}
          >
            Step 3 — Signature Tracking
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signatories.map(sig => {
              const statusColor =
                sig.status === "signed"
                  ? C.green
                  : sig.status === "awaiting"
                  ? C.amber
                  : C.textSubtle;
              const statusLabel =
                sig.status === "signed"
                  ? "Signed"
                  : sig.status === "awaiting"
                  ? "Sent · Awaiting action"
                  : "Pending — awaiting signatory " + (sig.id - 1);
              return (
                <Card key={sig.id} style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: sig.color,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: FONT.heading,
                        fontWeight: 500,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {sig.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 500 }}>
                        {sig.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {sig.role} · {sig.email}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: statusColor,
                          fontFamily: FONT.heading,
                          fontWeight: 500,
                          marginTop: 2,
                        }}
                      >
                        {statusLabel}
                      </div>
                    </div>
                    {sig.status === "signed" && <CheckCircle2 size={20} color={C.green} />}
                    {sig.status === "awaiting" && (
                      <GhostButton onClick={() => simulateSign(sig.id)}>
                        Simulate: Sign
                      </GhostButton>
                    )}
                    {sig.status === "pending" && <Clock size={18} color={C.textSubtle} />}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Column 2 — DocuSign API workflow + envelope payload */}
        <div>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.textSubtle,
              marginBottom: 10,
            }}
          >
            DocuSign API Workflow — How It Connects
          </div>

          {/* MCP Capabilities */}
          <Card style={{ padding: "18px 20px", marginBottom: 16 }}>
            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: C.textSubtle,
                marginBottom: 12,
              }}
            >
              MCP Capabilities — Live Status
            </div>
            {MCP_CAPABILITIES.map((cap, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 0",
                  borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.heading,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    backgroundColor: cap.live ? C.greenSoft : C.amberSoft,
                    color: cap.live ? C.green : C.amber,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {cap.live ? "✓ LIVE" : "BETA"}
                </span>
                <div>
                  <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500 }}>
                    {cap.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{cap.desc}</div>
                </div>
              </div>
            ))}
          </Card>

          {/* Envelope Payload */}
          <Card style={{ padding: "18px 20px" }}>
            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: C.textSubtle,
                marginBottom: 10,
              }}
            >
              Envelope Payload
            </div>
            <pre
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                lineHeight: 1.6,
                color: C.textMuted,
                backgroundColor: C.bg,
                padding: 14,
                borderRadius: RADIUS.md,
                border: `1px solid ${C.border}`,
                overflow: "auto",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {ENVELOPE_PAYLOAD}
            </pre>
          </Card>
        </div>

        {/* Column 3 — Signing workflow timeline */}
        <div>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: C.textSubtle,
              marginBottom: 10,
            }}
          >
            Signing Workflow
          </div>
          <Card style={{ padding: "20px 22px" }}>
            {TIMELINE_STEPS.map((step, i) => {
              const isDone = step.done || (i <= 1 && sent);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    marginBottom: i < TIMELINE_STEPS.length - 1 ? 20 : 0,
                    position: "relative",
                  }}
                >
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div
                      style={{
                        position: "absolute",
                        left: 13,
                        top: 28,
                        width: 2,
                        height: 20,
                        backgroundColor: isDone ? C.green : C.border,
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor: isDone ? C.green : C.border,
                      color: isDone ? "#fff" : C.textSubtle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: FONT.heading,
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div
                      style={{
                        fontFamily: FONT.heading,
                        fontSize: 13,
                        fontWeight: 600,
                        color: isDone ? C.text : C.textMuted,
                      }}
                    >
                      {step.label}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                      {step.sub}
                    </div>
                    {step.ts && (
                      <div
                        style={{
                          fontSize: 11,
                          color: C.textSubtle,
                          fontFamily: FONT.mono,
                          marginTop: 2,
                        }}
                      >
                        {step.ts}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          padding: "16px 20px",
          backgroundColor: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.lg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600 }}>
            Ready to send for approval?
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Estimate {ESTIMATE_REF} is locked ·{" "}
            <span style={{ color: C.green, fontWeight: 500 }}>
              ${ESTIMATE_VALUE.toLocaleString()}
            </span>{" "}
            excl. GST · 3 signatories configured
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <GhostButton icon={<FileDown size={14} />}>Preview PDF</GhostButton>
          <GhostButton icon={<Save size={14} />}>Save Draft</GhostButton>
          <PrimaryButton
            icon={
              sending ? (
                <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              ) : allSigned || sent ? (
                <CheckCircle2 size={15} />
              ) : (
                <Send size={15} />
              )
            }
            onClick={handleSendEnvelope}
            disabled={allSigned || sending}
          >
            {allSigned
              ? "Fully Executed"
              : sending
              ? "Sending…"
              : sent
              ? "✓ Envelope Sent"
              : "Send for Approval"}
          </PrimaryButton>
        </div>
      </div>

      <Footer />
    </div>
  );
}
