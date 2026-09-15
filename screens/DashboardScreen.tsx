import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
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
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import {
  fetchEstimates,
  fetchScans,
  formatScanToQuote,
  type EstimateRow,
} from "../services/supabaseData";
import { DEFAULT_MARGIN_PCT } from "../lib/quoteTotals";
import {
  computeDashboardMoneyStats,
  quotedTotalIncGst,
  formatQuotedValue,
  formatPipelineKpi,
  estimateDisplayRef,
  daysSinceSent,
  impliedSubtotalFromIncGst,
} from "../lib/estimateMoney";
import { ariesPipelineInsight } from "../lib/ariesSuggestion";

// Demo rows are labelled in the UI. `value` is the GST-inclusive quoted total
// (what the table always showed). Subtotal is implied so we do not store the
// same number as both ex-GST and inc-GST.
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

function toDemoEstimate(e: (typeof ESTIMATES)[number]): EstimateRow {
  return {
    id: e.r,
    ref: e.r,
    reference: e.r,
    client: e.client,
    value: e.value,
    status: e.status as EstimateRow["status"],
    days_since_sent: e.days,
    project_name: null,
    drawing_file: null,
    margin_pct: DEFAULT_MARGIN_PCT,
    subtotal: impliedSubtotalFromIncGst(e.value, DEFAULT_MARGIN_PCT),
    line_items: [],
    created_at: new Date(Date.now() - e.days * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export default function DashboardScreen() {
  const navigate = useNavigate();

  const { data: liveEstimates, isLive: estimatesLive } = useSupabaseQuery(
    fetchEstimates,
    ESTIMATES.map(toDemoEstimate),
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

  const stats = useMemo(
    () => computeDashboardMoneyStats(liveEstimates, liveScans),
    [liveEstimates, liveScans],
  );

  const ariesCopy = ariesPipelineInsight({
    isLive: estimatesLive,
    pendingValue: stats.pendingValue,
    estimateCount: liveEstimates.length,
  });

  const fmtCount = (n: number) => String(n);
  const fmtPct = (n: number | null) => (n == null ? "—" : `${n}%`);

  return (
    <div className="anim-in">
      {!isLive && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, backgroundColor: C.amberSoft, color: C.amber, fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, marginBottom: 16 }}>
          Demo data — sample rows, not Vesh jobs
        </div>
      )}

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
          You have <B>{displayScans.length} scans</B> in queue and <B>{formatQuotedValue(stats.pendingValue)}</B> in pending estimates.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <Kpi label="Estimates this month" value={fmtCount(stats.estimatesThisMonth)} delta=""    sub="MTD"                 up />
        <Kpi label="Pending value"        value={formatPipelineKpi(stats.pendingValue)} delta="" sub="sent + viewed inc GST" up />
        <Kpi label="Win rate"             value={fmtPct(stats.winRate)}          delta=""    sub="closed last 90 days"  up />
        <Kpi label="Avg scan-to-quote"    value={formatScanToQuote(stats.avgScanToQuoteMs)} delta="" sub="linked scans" up />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 24 }}>
        <section>
          <SectionHead title="Active scans" cta="View all" onCta={() => navigate("/detection")} />
          <Card>
            {displayScans.length === 0 ? (
              <div style={{ padding: 18, color: C.textMuted, fontStyle: "italic", fontSize: 14 }}>
                No scans in progress.
              </div>
            ) : displayScans.map((s: any, i: number) => (
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
              {ariesCopy}
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
                {displayEstimates.length === 0 ? (
                  <tr>
                    <Td>
                      <span style={{ fontStyle: "italic", color: C.textMuted }}>
                        No estimates yet — send a quote from a scan.
                      </span>
                    </Td>
                    <Td>{""}</Td>
                    <Td align="right">{""}</Td>
                    <Td>{""}</Td>
                    <Td align="right">{""}</Td>
                    <Td>{""}</Td>
                  </tr>
                ) : displayEstimates.map((e: any) => {
                  const days = daysSinceSent(e);
                  return (
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
                        <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: "-0.01em" }}>
                          {estimateDisplayRef(e)}
                        </span>
                      </Td>
                      <Td>{e.client}</Td>
                      <Td align="right" mono>
                        <span style={{ fontWeight: 500 }}>{formatQuotedValue(quotedTotalIncGst(e))}</span>
                      </Td>
                      <Td><StatusPill status={e.status} /></Td>
                      <Td align="right" muted>
                        <span style={{ fontStyle: "italic", fontSize: 13 }}>
                          {days == null ? "—" : `${days}d ago`}
                        </span>
                      </Td>
                      <Td align="right">
                        <MoreHorizontal size={15} color={C.textSubtle} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>
      </div>

      <Footer />
    </div>
  );
}
