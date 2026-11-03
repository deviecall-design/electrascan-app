import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { parseSupplierCsv, type PricedRequestLine } from "../lib/supplierLink";

export default function SupplierPortal() {
  const { token = "" } = useParams();
  const [jobName, setJobName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [lines, setLines] = useState<PricedRequestLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/supplier/${token}`, { headers: { "x-supplier-token": token } })
      .then(res => res.json().then(body => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setError(body.error || "This link could not be opened.");
          return;
        }
        setJobName(body.data?.jobName || "Materials request");
        setSupplierName(body.data?.supplierName || "");
        setLines(body.data?.lines || []);
        setDone(body.data?.status === "priced");
      })
      .catch(() => { if (!cancelled) setError("This link could not be opened."); });
    return () => { cancelled = true; };
  }, [token]);

  function setLine(index: number, patch: Partial<PricedRequestLine>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/supplier/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-supplier-token": token },
      body: JSON.stringify({
        lines: lines.map(line => ({
          product: line.product,
          qty: line.qty,
          unitPrice: Number(line.supplierUnitPrice) || 0,
          availability: line.availability || "",
        })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Those prices could not be saved.");
      return;
    }
    setDone(true);
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px", fontFamily: FONT.body, color: C.text }}>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>ElectraScan supplier pricing</p>
      <h1 style={{ fontFamily: FONT.heading, fontSize: 28, margin: "8px 0" }}>{jobName || "Materials request"}</h1>
      <p style={{ color: C.textMuted }}>
        {supplierName ? `${supplierName} · ` : ""}Enter a price and availability for each line, or paste a CSV. Prices stay on this request only.
      </p>
      {error && <p style={{ color: C.red }}>{error}</p>}
      {done && <p style={{ color: C.green, fontWeight: 700 }}>Prices received. Vesh can see them on this job.</p>}
      <form onSubmit={event => void submit(event)}>
        {lines.map((line, index) => (
          <div key={`${line.product}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700 }}>{line.qty} {line.unit} · {line.product}</div>
            <label style={{ fontSize: 13, color: C.textMuted }}>
              Unit price ex GST
              <input aria-label={`Price for ${line.product}`} inputMode="decimal" value={line.supplierUnitPrice ?? ""} onChange={event => setLine(index, { supplierUnitPrice: Number(event.target.value) })} style={field} />
            </label>
            <label style={{ fontSize: 13, color: C.textMuted }}>
              Availability
              <input aria-label={`Availability for ${line.product}`} value={line.availability || ""} onChange={event => setLine(index, { availability: event.target.value })} style={field} />
            </label>
          </div>
        ))}
        <label style={{ display: "block", marginTop: 12, fontSize: 13, color: C.textMuted }}>
          Or paste a CSV with product, qty, unit price, availability
          <textarea
            aria-label="Supplier CSV"
            rows={4}
            onChange={event => {
              const parsed = parseSupplierCsv(event.target.value);
              if (parsed.length === 0) return;
              setLines(current => current.map(line => {
                const hit = parsed.find(row => row.product.toLowerCase() === line.product.toLowerCase());
                return hit ? { ...line, supplierUnitPrice: hit.unitPrice, availability: hit.availability } : line;
              }));
            }}
            style={{ ...field, minHeight: 96, padding: 10 }}
          />
        </label>
        <button type="submit" disabled={busy || lines.length === 0} style={{ minHeight: 44, marginTop: 16, padding: "0 16px", border: "none", borderRadius: 12, background: C.orange, color: "#fff", fontWeight: 700 }}>
          {busy ? "Sending…" : "Submit prices"}
        </button>
      </form>
    </main>
  );
}

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: 44,
  marginTop: 4,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 10px",
  fontSize: 16,
  boxSizing: "border-box",
};
