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

  return (
    <div className="anim-in">
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
          You have <B>3 scans</B> in queue and <B>${pendingValue.toLocaleString()}</B> in pending estimates.
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        <Kpi label="Estimates this month" value="24" delta="+8"  sub="vs April"       up />
        <Kpi label="Pending value"        value={`$${(pendingValue / 1000).toFixed(0)}k`} delta="+12%" sub="vs last week"   up />
        <Kpi label="Win rate"             value="68%" delta="+4%"  sub="30-day rolling" up />
        <Kpi label="Avg scan-to-quote"    value="7m 12s" delta="−2m" sub="vs April"     up />
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 24 }}>
        {/* Left — active scans + insight */}
        <section>
          <SectionHead title="Active scans" cta="View all" onCta={() => navigate("/detection")} />
          <Card>
            {ACTIVE_SCANS.map((s, i) => (
              <ScanRow
                key={s.file}
                file={s.file}
                client={s.client}
                progress={s.progress}
                stage={s.stage}
                divider={i > 0}
                onClick={() => navigate(`/detection/scan-${i + 1}`)}
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
                  <Th>Ref</Th>
                  <Th>Client</Th>
                  <Th align="right">Value</Th>
                  <Th>Status</Th>
                  <Th align="right">Sent</Th>
                  <Th width={32} />
                </tr>
              </thead>
              <tbody>
                {ESTIMATES.map(e => (
                  <tr
                    key={e.r}
                    className="es-row"
                    style={{
                      borderTop: `1px solid ${C.border}`,
                      transition: "background-color 120ms",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/estimate")}
                  >
                    <Td mono>
                      <span style={{ fontWeight: 500, fontSize: 13, letterSpacing: "-0.01em" }}>{e.r}</span>
                    </Td>
                    <Td>{e.client}</Td>
                    <Td align="right" mono>
                      <span style={{ fontWeight: 500 }}>${e.value.toLocaleString()}</span>
                    </Td>
                    <Td><StatusPill status={e.status} /></Td>
                    <Td align="right" muted>
                      <span style={{ fontStyle: "italic", fontSize: 13 }}>{e.days}d ago</span>
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
