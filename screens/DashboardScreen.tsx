import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  MoreHorizontal,
  Sparkles,
  FileCheck2,
} from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  Kpi,
  SectionHead,
  ScanRow,
  Footer,
  B,
  Th,
  Td,
  StatusPill,
} from "../components/ui/anthropic";
import { useEffect, useState } from "react";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import {
  fetchEstimates,
  fetchScans,
  fetchEstimatesThisMonth,
  fetchPendingValue,
  fetchWinRate,
  fetchAvgScanToQuote,
  formatScanToQuote,
  type EstimateRow,
  type ScanRow as ScanRowType,
} from "../services/supabaseData";

// ─── Mock data ──────────────────────────────────────────────────────────
// TODO: Replace with Supabase queries once the `estimates` and `scans`
// tables exist. The shapes below match the planned schema exactly so the
// swap is a single fetch() call per section.
//
// Supabase schema — estimates table:
//   id: uuid (PK)
//   ref: text UNIQUE (e.g. "EST-2026-0142")
//   client: text
//   value: numeric
//   status: text CHECK (status IN ('draft','sent','viewed','approved'))
//   days_since_sent: integer
//   project_name: text
//   created_at: timestamptz
//   owner_id: uuid (FK to auth.users)
// RLS: users read/write only their own rows.
//
// Supabase schema — scans table:
//   id: uuid (PK)
//   file_name: text
//   client: text
//   stage: text (e.g. 'Detecting symbols', 'Enriching rates', 'Complete')
//   items_detected: integer
//   progress: integer (0-100)
//   started_at: timestamptz
//   estimate_ref: text (FK to estimates.ref, nullable)
//   owner_id: uuid (FK to auth.users)
// RLS: users read/write only their own rows.

const ESTIMATES = [
  { r: "EST-2026-0142", client: "Bondi Tower Residences",   value: 28450, status: "sent",     days: 2  },
  { r: "EST-2026-0141", client: "Martin Place Partners",    value: 14900, status: "approved", days: 5  },
  { r: "EST-2026-0140", client: "Northern Beaches Council", value: 62300, status: "viewed",   days: 6  },
  { r: "EST-2026-0139", client: "Chatswood Dental Group",   value: 8120,  status: "draft",    days: 8  },
  { r: "EST-2026-0138", client: "Parramatta Logistics Hub", value: 41780, status: "approved", days: 11 },
  { r: "EST-2026-0137", client: "Surry Hills Hospitality",  value: 19640, status: "sent",     days: 13 },
];

const ACTIVE_SCANS = [
  { file: "Switchboard_LV2_rev3.pdf",  client: "Bondi Tower Residences",   progress: 72, stage: "Enriching rates" },
  { file: "Warehouse_ground_floor.pdf", client: "Parramatta Logistics Hub", progress: 34, stage: "Detecting symbols" },
  { file: "Office_fitout_L8.pdf",       client: "Martin Place Partners",    progress: 96, stage: "Finalising" },
];

const pendingValue = ESTIMATES
  .filter(e => e.status === "sent" || e.status === "viewed")
  .reduce((s, e) => s + e.value, 0);

// ─── Screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigate = useNavigate();

  // Try Supabase first; fall back to mock arrays above if tables don't exist.
  const { data: liveEstimates, isLive: estimatesLive } = useSupabaseQuery(
    fetchEstimates,
    ESTIMATES.map(e => ({
      id: e.r, ref: e.r, reference: e.r, client: e.client, value: e.value,
      status: e.status as EstimateRow["status"],
      days_since_sent: e.days, project_name: null,
      drawing_file: null, margin_pct: 15, subtotal: e.value,
      line_items: [], created_at: new Date().toISOString(),
    })),
  );
  const { data: liveScans, isLive: scansLive } = useSupabaseQuery(
    fetchScans,
    ACTIVE_SCANS.map((s, i) => ({
      id: `scan-${i + 1}`, file_name: s.file, client: s.client,
      stage: s.stage, items_detected: 0, progress: s.progress,
      estimate_ref: null, detected_items: [], risk_flags: [],
      started_at: new Date().toISOString(), completed_at: null,
    })),
  );

  const isLive = estimatesLive || scansLive;
  const displayEstimates = liveEstimates.slice(0, 6);
  const displayScans = liveScans.filter((s: any) => (s.progress ?? 0) < 100).slice(0, 3);
  const allPendingValue = liveEstimates
    .filter((e: any) => e.status === "sent" || e.status === "viewed")
    .reduce((s: number, e: any) => s + (e.value ?? 0), 0);

  // Live KPIs — each is null until its query resolves; null renders "—".
  const [kpiEstimatesMonth, setKpiEstimatesMonth] = useState<number | null>(null);
  const [kpiPendingValue, setKpiPendingValue] = useState<number | null>(null);
  const [kpiWinRate, setKpiWinRate] = useState<number | null>(null);
  const [kpiScanToQuote, setKpiScanToQuote] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchEstimatesThisMonth(),
      fetchPendingValue(),
      fetchWinRate(),
      fetchAvgScanToQuote(),
    ]).then(([m, pv, wr, stq]) => {
      if (cancelled) return;
      setKpiEstimatesMonth(m.value);
      setKpiPendingValue(pv.value);
      setKpiWinRate(wr.value);
      setKpiScanToQuote(stq.value);
    });
    return () => { cancelled = true; };
  }, []);

  const fmtCount = (n: number | null) => (n == null ? "—" : String(n));
  const fmtMoney = (n: number | null) => {
    if (n == null) return "—";
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${Math.round(n)}`;
  };
  const fmtPct = (n: number | null) => (n == null ? "—" : `${n}%`);

  return (
    <div className="anim-in">
      {/* Data source indicator */}
      {!isLive && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, backgroundColor: C.amberSoft, color: C.amber, fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, marginBottom: 16 }}>
          Demo data — Supabase tables not yet created
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: FONT.heading,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "0 0 6px 0",
            lineHeight: 1.15,
          }}
        >
          Good morning, Damien.
        </h1>
        <p style={{ color: C.textMuted, fontStyle: "italic", margin: 0, fontSize: 16 }}>
          You have <B>{displayScans.length} scans</B> in queue and <B>${allPendingValue.toLocaleString()}</B> in pending estimates.
        </p>
      </div>

      {/* KPI strip — live from Supabase, falls back to "—" when empty/unavailable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <Kpi label="Estimates this month" value={fmtCount(kpiEstimatesMonth)} delta=""    sub="MTD"            up />
        <Kpi label="Pending value"        value={fmtMoney(kpiPendingValue)}   delta=""    sub="sent + viewed"  up />
        <Kpi label="Win rate"             value={fmtPct(kpiWinRate)}          delta=""    sub="last 90 days"   up />
        <Kpi label="Avg scan-to-quote"    value={formatScanToQuote(kpiScanToQuote)} delta="" sub="linked scans" up />
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 24 }}>
        {/* Left — active scans + insight */}
        <section>
          <SectionHead title="Active scans" cta="View all" onCta={() => navigate("/detection")} />
          <Card>
            {displayScans.map((s: any, i: number) => (
              <ScanRow
                key={s.id ?? s.file_name}
                file={s.file_name ?? s.file}
                client={s.client ?? ""}
                progress={s.progress ?? 0}
                stage={s.stage ?? "Processing"}
                divider={i > 0}
                onClick={() => navigate(`/detection/${s.id ?? `scan-${i + 1}`}`)}
              />
            ))}
          </Card>

          {/* Aries insight card */}
          <div
            style={{
              marginTop: 20,
              padding: 18,
              backgroundColor: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Sparkles size={14} color={C.orange} />
              <span
                style={{
                  fontFamily: FONT.heading,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: C.textMuted,
                }}
              >
                Aries insight
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>
              Your GPO rates are <B>14% below</B> regional average. Reviewing the top 5 could add{" "}
              <span style={{ color: C.green, fontStyle: "italic" }}>~$3,200</span> to April's pipeline.
            </p>
            <button
              className="es-link"
              onClick={() => navigate("/pricing-schedule")}
              style={{
                marginTop: 10,
                fontSize: 13,
                color: C.orange,
                fontFamily: FONT.heading,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Open rate library <ArrowUpRight size={13} />
            </button>
          </div>
        </section>

        {/* Right — recent estimates */}
        <section>
          <SectionHead title="Recent estimates" cta="Open estimates" onCta={() => navigate("/estimate")} />
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
                {displayEstimates.map((e: any) => (
                  <tr
                    key={e.id ?? e.reference ?? e.ref ?? e.r}
                    className="es-row"
                    style={{
                      borderTop: `1px solid ${C.border}`,
                      transition: "background-color 120ms",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/estimate")}
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
        </section>
      </div>

      <Footer />
    </div>
  );
}
