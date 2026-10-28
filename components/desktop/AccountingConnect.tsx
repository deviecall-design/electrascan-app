import React, { useEffect, useState } from "react";
import { C, FONT } from "./tokens";
import { Card } from "../ui/anthropic";
import { VESH_TENANT_ID } from "../../lib/tenants";

interface ProviderStatus {
  configured: boolean;
  missing: string[];
}

interface IntegrationStatus {
  xero: ProviderStatus;
  myob: ProviderStatus;
}

const EMPTY: IntegrationStatus = {
  xero: { configured: false, missing: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "XERO_REDIRECT_URI"] },
  myob: { configured: false, missing: ["MYOB_CLIENT_ID", "MYOB_CLIENT_SECRET", "MYOB_REDIRECT_URI"] },
};

/**
 * Connect stays on screen until the provider credentials exist.
 * Xero continues into the existing OAuth route. MYOB has no OAuth handler yet.
 */
export default function AccountingConnect() {
  const [status, setStatus] = useState<IntegrationStatus>(EMPTY);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/status")
      .then(res => res.json())
      .then(json => {
        if (!cancelled && json?.xero && json?.myob) setStatus(json);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function connectXero() {
    if (!status.xero.configured) {
      setNote(`Xero needs ${status.xero.missing.join(", ")} on Vercel, then redeploy.`);
      return;
    }
    window.location.assign(`/api/xero/auth?org_id=${encodeURIComponent(VESH_TENANT_ID)}`);
  }

  function connectMyob() {
    setNote(`MYOB needs ${status.myob.missing.join(", ")} on Vercel. There is no MYOB OAuth handler yet, so Connect does not send anything.`);
  }

  return (
    <Card style={{ padding: 22 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Accounting</h2>
      <p style={{ margin: "0 0 16px", color: C.textMuted, fontSize: 14 }}>
        Connect Xero or MYOB when you are ready. Nothing is pushed until a connection exists.
      </p>
      <div className="es-pair">
        <Provider name="Xero" detail="Quotes, invoices, and contacts" configured={status.xero.configured} missing={status.xero.missing} onConnect={connectXero} />
        <Provider name="MYOB" detail="Invoices, timesheets, and job costing" configured={status.myob.configured} missing={status.myob.missing} onConnect={connectMyob} />
      </div>
      {note && <p style={{ color: C.amber, fontSize: 14 }}>{note}</p>}
    </Card>
  );
}

function Provider({
  name,
  detail,
  configured,
  missing,
  onConnect,
}: {
  name: string;
  detail: string;
  configured: boolean;
  missing: string[];
  onConnect: () => void;
}) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontFamily: FONT.heading, fontWeight: 700 }}>{name}</div>
      <div style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 12px" }}>{detail}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: configured ? C.green : C.textMuted, marginBottom: 10 }}>
        {configured ? "Ready to connect" : "Not connected"}
      </div>
      <button type="button" onClick={onConnect} style={{ minHeight: 44, borderRadius: 12, padding: "0 16px", background: C.orange, color: "#fff", fontWeight: 600 }}>
        Connect
      </button>
      {!configured && (
        <p style={{ fontSize: 12, color: C.textSubtle, margin: "10px 0 0" }}>
          Needs {missing.join(", ")}.
        </p>
      )}
    </div>
  );
}
