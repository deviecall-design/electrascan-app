import React, { useMemo, useState } from "react";
import type {
  Project,
  ProjectEstimate,
} from "../contexts/ProjectContext";
import { useProjects } from "../contexts/ProjectContext";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import { sendWholesalerQuoteRequest } from "../services/estimateService";

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

// Indicative per-metre rates kept in sync with ProjectEstimateEditor.
const CABLE_UNIT_RATES: Record<string, number> = {
  "2.5mm² TPS": 4.8,
  "4mm² TPS": 7.2,
  "6mm² TPS": 11.5,
  "10mm² TPS": 18.0,
  "Cat6 Data": 2.4,
  "20mm Conduit": 3.6,
  "25mm Conduit": 4.8,
};

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-AU", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

interface Props {
  estimate: ProjectEstimate;
  project: Project;
  onClose: () => void;
}

const WholesalerQuoteModal: React.FC<Props> = ({ estimate, project, onClose }) => {
  const { tenant } = useTenant();
  const { addToast } = useToast();
  const { saveEstimate } = useProjects();

  const estimateId = estimate.id;
  const estimateRef = estimate.reference || estimate.number || estimate.id;
  const projectName = project.name;
  const cableRuns = estimate.cableRuns;
  const lineItems = estimate.lineItems;

  const defaultWholesaler =
    tenant.wholesalers.find(w => w.isDefault) ?? tenant.wholesalers[0];
  const [wholesalerId, setWholesalerId] = useState<string>(defaultWholesaler?.id ?? "");
  const [recipientEmail, setRecipientEmail] = useState<string>(defaultWholesaler?.email ?? "");
  const [notes, setNotes] = useState<string>("");
  const [sending, setSending] = useState(false);

  const wholesaler = useMemo(
    () => tenant.wholesalers.find(w => w.id === wholesalerId) ?? defaultWholesaler,
    [tenant.wholesalers, wholesalerId, defaultWholesaler],
  );

  const onWholesalerChange = (id: string) => {
    setWholesalerId(id);
    const next = tenant.wholesalers.find(w => w.id === id);
    setRecipientEmail(next?.email ?? "");
  };

  const cableRunsWithPrice = useMemo(
    () =>
      cableRuns.map(r => {
        const unit = CABLE_UNIT_RATES[r.cableType] ?? 0;
        return {
          ...r,
          unit_price: unit,
          line_total: +(unit * r.totalLength).toFixed(2),
        };
      }),
    [cableRuns],
  );

  const cableRunsTotal = cableRunsWithPrice.reduce((s, r) => s + r.line_total, 0);

  const lineItemsWithTotal = useMemo(
    () =>
      lineItems.map(li => ({
        ...li,
        line_total: +(li.qty * li.unitPrice).toFixed(2),
      })),
    [lineItems],
  );

  const lineItemsTotal = lineItemsWithTotal.reduce((s, li) => s + li.line_total, 0);
  const grandTotal = cableRunsTotal + lineItemsTotal;

  const subject = `Quote Request — ${estimateRef || estimateId} — ${projectName} — ${tenant.name}`;

  const emailMissing = !recipientEmail.trim();
  const noBomItems = cableRuns.length === 0;

  const onSend = async () => {
    if (!wholesaler) {
      addToast("No wholesaler selected.", "error");
      return;
    }
    if (emailMissing) {
      addToast("Add a wholesaler email in Settings before sending.", "error");
      return;
    }
    setSending(true);
    const res = await sendWholesalerQuoteRequest({
      estimate_id: estimateId,
      estimate_ref: estimateRef || estimateId,
      project_name: projectName,
      wholesaler: wholesaler.name,
      wholesaler_email: recipientEmail.trim(),
      cable_runs: cableRunsWithPrice.map(r => ({
        cableType: r.cableType,
        lengthMeters: r.lengthMeters,
        wasteFactorPct: r.wasteFactorPct,
        totalLength: r.totalLength,
        unit_price: r.unit_price,
        line_total: r.line_total,
      })),
      line_items: lineItemsWithTotal.map(li => ({
        description: li.description,
        category: li.category,
        qty: li.qty,
        unit: li.unit,
        unit_price: li.unitPrice,
        line_total: li.line_total,
      })),
      notes: notes.trim(),
      tenant: tenant.name,
      sent_at: new Date().toISOString(),
    });
    setSending(false);
    if (res.ok) {
      saveEstimate(project.id, {
        ...estimate,
        wholesaleQuoteSentAt: new Date().toISOString(),
        wholesaleQuoteSentTo: wholesaler.name,
        wholesaleQuoteStatus: "sent",
        wholesaleQuoteReceivedAt: undefined,
        wholesaleQuoteOrderedAt: undefined,
        updatedAt: new Date().toISOString(),
      });
      addToast(`Quote request sent to ${wholesaler.name}`, "success");
      onClose();
    } else {
      addToast(`Send failed: ${res.error}`, "error");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4,8,20,0.7)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        zIndex: 80,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          background: C.navy,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 20,
          color: C.text,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Send BOM to Wholesaler</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Request a materials quote for {projectName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: C.muted,
              fontSize: 24,
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {tenant.wholesalers.length === 0 && (
          <Banner color={C.amber}>
            No wholesalers configured. Add one in Settings → Wholesalers.
          </Banner>
        )}

        {tenant.wholesalers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <Field label="WHOLESALER">
              <select
                value={wholesalerId}
                onChange={e => onWholesalerChange(e.target.value)}
                style={input}
              >
                {tenant.wholesalers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.address ? ` — ${w.address}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="TO">
              <input
                type="email"
                value={recipientEmail}
                placeholder="orders@wholesaler.com.au"
                onChange={e => setRecipientEmail(e.target.value)}
                style={input}
              />
              {emailMissing && (
                <div style={{ fontSize: 11, color: C.amber, marginTop: 6 }}>
                  No email saved for this wholesaler. Enter one here or add it in
                  Settings → Wholesalers.
                </div>
              )}
            </Field>
            <Field label="SUBJECT">
              <input value={subject} readOnly style={{ ...input, color: C.dim }} />
            </Field>
            <Field label="NOTES (optional)">
              <textarea
                rows={3}
                value={notes}
                placeholder="Any extras, lead time, delivery notes…"
                onChange={e => setNotes(e.target.value)}
                style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
              />
            </Field>
          </div>
        )}

        <SectionHeader>
          CABLE RUNS ({cableRunsWithPrice.length})
        </SectionHeader>
        {cableRunsWithPrice.length === 0 ? (
          <EmptyRow>No cable runs added.</EmptyRow>
        ) : (
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <HeaderRow
              cols="2fr 1fr 1fr 1fr"
              labels={["TYPE", "ORDER QTY", "UNIT $", "LINE TOTAL"]}
            />
            {cableRunsWithPrice.map((r, i) => (
              <DataRow
                key={r.id}
                cols="2fr 1fr 1fr 1fr"
                last={i === cableRunsWithPrice.length - 1}
                values={[
                  r.cableType,
                  `${r.totalLength.toFixed(1)}m`,
                  fmtMoney(r.unit_price),
                  fmtMoney(r.line_total),
                ]}
              />
            ))}
            <div
              style={{
                padding: "8px 12px",
                background: `${C.green}15`,
                borderTop: `1px solid ${C.border}`,
                fontSize: 12,
                fontWeight: 700,
                color: C.green,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Subtotal (cables)</span>
              <span>{fmtMoney(cableRunsTotal)}</span>
            </div>
          </div>
        )}

        {noBomItems && (
          <Banner color={C.amber}>
            No cable runs added yet. Use the Cable / Conduit calculator to add BOM items.
          </Banner>
        )}

        {lineItemsWithTotal.length > 0 && (
          <>
            <SectionHeader>
              LINE ITEMS ({lineItemsWithTotal.length})
            </SectionHeader>
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <HeaderRow
                cols="3fr 1.5fr 0.8fr 1fr 1fr"
                labels={["DESCRIPTION", "CATEGORY", "QTY", "UNIT $", "LINE TOTAL"]}
              />
              {lineItemsWithTotal.map((li, i) => (
                <DataRow
                  key={li.id}
                  cols="3fr 1.5fr 0.8fr 1fr 1fr"
                  last={i === lineItemsWithTotal.length - 1}
                  values={[
                    li.description,
                    li.category,
                    `${li.qty}${li.unit ? ` ${li.unit}` : " EA"}`,
                    fmtMoney(li.unitPrice),
                    fmtMoney(li.line_total),
                  ]}
                />
              ))}
              <div
                style={{
                  padding: "8px 12px",
                  background: `${C.green}15`,
                  borderTop: `1px solid ${C.border}`,
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.green,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Subtotal (materials)</span>
                <span>{fmtMoney(lineItemsTotal)}</span>
              </div>
            </div>
          </>
        )}

        {(cableRunsWithPrice.length > 0 || lineItemsWithTotal.length > 0) && (
          <div
            style={{
              padding: "10px 14px",
              background: `${C.blue}20`,
              border: `1px solid ${C.blue}55`,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              color: C.text,
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <span>Total to order</span>
            <span style={{ color: C.green }}>{fmtMoney(grandTotal)}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.muted,
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={sending || emailMissing || noBomItems}
            style={{
              background: sending || emailMissing || noBomItems ? C.card : C.blue,
              color: sending || emailMissing || noBomItems ? C.muted : "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: sending || emailMissing || noBomItems ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending…" : "Send Quote Request"}
          </button>
        </div>
      </div>
    </div>
  );
};

const input: React.CSSProperties = {
  width: "100%",
  background: C.bg,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.muted,
        letterSpacing: 0.6,
      }}
    >
      {label}
    </span>
    {children}
  </label>
);

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: C.muted,
      letterSpacing: 0.6,
      margin: "8px 0",
    }}
  >
    {children}
  </div>
);

const EmptyRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: 12,
      fontSize: 12,
      color: C.muted,
      marginBottom: 14,
    }}
  >
    {children}
  </div>
);

const HeaderRow: React.FC<{ cols: string; labels: string[] }> = ({ cols, labels }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: cols,
      padding: "8px 12px",
      borderBottom: `1px solid ${C.border}`,
      fontSize: 10,
      fontWeight: 700,
      color: C.muted,
      letterSpacing: 0.6,
    }}
  >
    {labels.map((l, i) => (
      <div key={i} style={{ textAlign: i === labels.length - 1 ? "right" : "left" }}>
        {l}
      </div>
    ))}
  </div>
);

const DataRow: React.FC<{ cols: string; values: React.ReactNode[]; last: boolean }> = ({
  cols,
  values,
  last,
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: cols,
      padding: "8px 12px",
      borderBottom: last ? "none" : `1px solid ${C.border}`,
      fontSize: 13,
      alignItems: "center",
    }}
  >
    {values.map((v, i) => (
      <div
        key={i}
        style={{
          textAlign: i === values.length - 1 ? "right" : "left",
          color: i === values.length - 1 ? C.text : C.text,
          fontWeight: i === values.length - 1 ? 700 : 400,
        }}
      >
        {v}
      </div>
    ))}
  </div>
);

const Banner: React.FC<{ color: string; children: React.ReactNode }> = ({
  color,
  children,
}) => (
  <div
    style={{
      background: `${color}15`,
      border: `1px solid ${color}55`,
      color,
      padding: "10px 14px",
      borderRadius: 10,
      fontSize: 12,
      marginBottom: 14,
    }}
  >
    {children}
  </div>
);

export default WholesalerQuoteModal;
