import React from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  MiniStat,
  Footer,
  StatusPill,
  Th,
  Td,
  B,
} from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, type EstimateRow } from "../services/supabaseData";

// ─── Mock data ──────────────────────────────────────────────────────────
// Same shape as the Dashboard's ESTIMATES but expanded for the full-list
// view. TODO: replace with Supabase query on `estimates` table.
const ESTIMATES = [
  { r: "EST-2026-0142", client: "Bondi Tower Residences",   value: 28450, status: "sent",     days: 2  },
  { r: "EST-2026-0141", client: "Martin Place Partners",    value: 14900, status: "approved", days: 5  },
  { r: "EST-2026-0140", client: "Northern Beaches Council", value: 62300, status: "viewed",   days: 6  },
  { r: "EST-2026-0139", client: "Chatswood Dental Group",   value: 8120,  status: "draft",    days: 8  },
  { r: "EST-2026-0138", client: "Parramatta Logistics Hub", value: 41780, status: "approved", days: 11 },
  { r: "EST-2026-0137", client: "Surry Hills Hospitality",  value: 19640, status: "sent",     days: 13 },
  { r: "EST-2026-0136", client: "Mosman Heritage Build",    value: 33200, status: "approved", days: 16 },
  { r: "EST-2026-0135", client: "Manly Beach Apartments",   value: 47100, status: "sent",     days: 18 },
  { r: "EST-2026-0134", client: "Crows Nest Medical",       value: 12850, status: "viewed",   days: 20 },
  { r: "EST-2026-0133", client: "Neutral Bay Studio",       value: 6900,  status: "draft",    days: 22 },
  { r: "EST-2026-0132", client: "Lane Cove Grammar School", value: 58400, status: "approved", days: 25 },
  { r: "EST-2026-0131", client: "Willoughby Council Depot", value: 22350, status: "approved", days: 27 },
];

const drafted  = ESTIMATES.length;
const sent     = ESTIMATES.filter(e => e.status === "sent").length;
const approved = ESTIMATES.filter(e => e.status === "approved").length;
const winValue = ESTIMATES.filter(e => e.status === "approved").reduce((s, e) => s + e.value, 0);

export default function EstimateScreen() {
  const navigate = useNavigate();

  const { data: liveEstimates, isLive } = useSupabaseQuery(
    fetchEstimates,
    ESTIMATES.map(e => ({
      id: e.r, ref: e.r, reference: e.r, client: e.client, value: e.value,
      status: e.status as EstimateRow["status"],
      days_since_sent: e.days, project_name: null,
      drawing_file: null, margin_pct: 15, subtotal: e.value,
      line_items: [], created_at: new Date().toISOString(),
    })),
  );

  const drafted  = liveEstimates.length;
  const sentCount     = liveEstimates.filter((e: any) => e.status === "sent").length;
  const approvedCount = liveEstimates.filter((e: any) => e.status === "approved").length;
  const winVal = liveEstimates.filter((e: any) => e.status === "approved").reduce((s: number, e: any) => s + (e.value ?? 0), 0);

  return (
    <div className="anim-in">
      <PageHeader
        title="Estimates"
        sub="Every quote ElectraScan has drafted for Vesh Electrical this quarter."
      />

      {/* Quick stats */}
      {!isLive && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, backgroundColor: C.amberSoft, color: C.amber, fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, marginBottom: 12 }}>
          Demo data — Supabase tables not yet created
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Drafted"   v={String(drafted)} />
        <MiniStat label="Sent"      v={String(sentCount)}     tint={C.blue} />
        <MiniStat label="Approved"  v={String(approvedCount)} tint={C.green} />
        <MiniStat label="Win value" v={`$${Math.round(winVal / 1000)}k`} tint={C.green} />
      </div>

      {/* Estimates table */}
      <Card>
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>Reference</Th>
              <Th>Client</Th>
              <Th align="right">Value</Th>
              <Th>Status</Th>
              <Th align="right">Sent</Th>
              <Th width={32} />
            </tr>
          </thead>
          <tbody>
            {liveEstimates.map((e: any) => (
              <tr
                key={e.id ?? e.reference ?? e.ref ?? e.r}
                className="es-row"
                style={{
                  borderTop: `1px solid ${C.border}`,
                  transition: "background-color 120ms",
                  cursor: "pointer",
                }}
              >
                <Td mono>
                  <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: "-0.01em" }}>{e.reference ?? e.ref ?? e.r}</span>
                </Td>
                <Td>{e.client}</Td>
                <Td align="right" mono>
                  <span style={{ fontWeight: 500 }}>${(e.value ?? 0).toLocaleString()}</span>
                </Td>
                <Td><StatusPill status={e.status} /></Td>
                <Td align="right" muted>
                  <span style={{ fontStyle: "italic", fontSize: 13 }}>{e.days_since_sent ?? e.days}d ago</span>
                </Td>
                <Td align="right">
                  <MoreHorizontal size={15} color={C.textSubtle} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Footer />
    </div>
  );
}
