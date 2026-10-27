import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, Check } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates } from "../services/supabaseData";
import { estimateDisplayRef, formatQuotedValue } from "../lib/estimateMoney";
import { supabase } from "../services/supabaseClient";
import { useToast } from "../contexts/ToastContext";
import QueryBanner from "../components/QueryBanner";

const PLACEHOLDER_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggOTAKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoyMCA3NjAgVGQKKEVsZWN0cmFTY2FuIEVzdGltYXRlIC0gUGxhY2Vob2xkZXIgRG9jdW1lbnQpIFRqCi9zaWcxLyBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDIxNiAwMDAwMCBuIAowMDAwMDAwMjgwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDIxCiUlRU9G";

export default function ApprovalsScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("estimate");
  const { addToast } = useToast();
  const { data: estimates, loading, error } = useSupabaseQuery(fetchEstimates);
  const selected = useMemo(() => {
    if (requested) {
      const match = estimates.find((row: { reference?: string; ref?: string }) =>
        row.reference === requested || row.ref === requested);
      if (match) return match;
    }
    return estimates[0] ?? null;
  }, [estimates, requested]);

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);

  const reference = selected ? estimateDisplayRef(selected) : "";
  const projectName = selected?.project_name || selected?.client || "Electrical estimate";

  async function send() {
    if (!selected) return;
    if (!signerName.trim() || !signerEmail.trim()) {
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
          estimateRef: reference,
          projectName,
          estimateValue: selected.value ?? 0,
          documentBase64: PLACEHOLDER_PDF_BASE64,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const result = await res.json() as { envelopeId: string };
      setEnvelopeId(result.envelopeId);
      void supabase.from("approval_audit").insert({
        envelope_id: result.envelopeId,
        estimate_ref: reference,
        signer_email: signerEmail.trim(),
        action: "envelope_sent",
        actor: "system",
      });
      addToast(`Envelope sent. ID: ${result.envelopeId}`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addToast(`Could not send envelope: ${message}`, "error");
    } finally {
      setSending(false);
    }
  }

  if (!loading && estimates.length === 0) {
    return (
      <div className="anim-in">
        <PageHeader crumb="Workflow" title="Approvals" sub="Signing starts from a saved estimate." />
        <EmptyState
          title="No estimates to send"
          body="Save a quote from a scan first. Approvals lists that quote — there is no sample envelope."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
        <Footer />
      </div>
    );
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={loading} error={error} noun="approvals" />
      <PageHeader
        crumb={reference ? `Estimates / ${reference}` : "Workflow"}
        title="Send for approval"
        sub="One signer per envelope. DocuSign sends only after you confirm, and only for a quote that exists in your list."
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)", gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 14 }}>
            Estimate
            <select
              value={selected?.id || ""}
              onChange={event => {
                const next = estimates.find((row: { id: string }) => row.id === event.target.value);
                if (next) navigate(`/approvals?estimate=${encodeURIComponent(estimateDisplayRef(next))}`);
              }}
              style={{ display: "block", width: "100%", minHeight: 44, marginTop: 6, borderRadius: 12, border: `1px solid ${C.border}`, padding: "0 12px" }}
            >
              {estimates.map((row: { id: string; client?: string | null; value?: number | null; reference?: string | null; ref?: string | null }) => (
                <option key={row.id} value={row.id}>
                  {estimateDisplayRef(row)} · {row.client || "Client not set"} · {formatQuotedValue(Number(row.value) || 0)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "block", marginTop: 16, fontWeight: 600, fontSize: 14 }}>
            Signer name
            <input
              value={signerName}
              onChange={event => setSignerName(event.target.value)}
              placeholder="Name"
              style={{ display: "block", width: "100%", minHeight: 44, marginTop: 6, borderRadius: 12, border: `1px solid ${C.border}`, padding: "0 12px", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ display: "block", marginTop: 16, fontWeight: 600, fontSize: 14 }}>
            Signer email
            <input
              type="email"
              value={signerEmail}
              onChange={event => setSignerEmail(event.target.value)}
              placeholder="name@builder.com.au"
              style={{ display: "block", width: "100%", minHeight: 44, marginTop: 6, borderRadius: 12, border: `1px solid ${C.border}`, padding: "0 12px", boxSizing: "border-box" }}
            />
          </label>
          <p style={{ fontSize: 12, color: C.textMuted }}>
            The envelope uses a one-page placeholder PDF until quote PDF generation is attached to DocuSign. The estimate reference and value are the saved quote.
          </p>
        </Card>

        <Card style={{ padding: 22 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Signing order</h2>
          <p style={{ color: C.textMuted, fontSize: 14 }}>
            {signerName.trim() || "Signer"} · {envelopeId ? "envelope sent" : "not sent"}
          </p>
          {envelopeId && (
            <p style={{ fontFamily: FONT.mono, fontSize: 12 }}>{envelopeId}</p>
          )}
          <PrimaryButton onClick={send} disabled={sending || !selected || Boolean(envelopeId)} icon={envelopeId ? <Check size={16} /> : <Send size={16} />}>
            {envelopeId ? "Envelope sent" : sending ? "Sending…" : "Send envelope"}
          </PrimaryButton>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
