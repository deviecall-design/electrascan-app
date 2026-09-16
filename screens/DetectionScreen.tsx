import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileCheck2 } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  Footer,
  Th,
  Td,
  EmptyState,
} from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchScans } from "../services/supabaseData";
import QueryBanner from "../components/QueryBanner";
import { formatAuShortDateTime } from "../lib/dates";

export default function DetectionScreen() {
  const navigate = useNavigate();

  const { data: liveScans, loading, error } = useSupabaseQuery(fetchScans);

  return (
    <div className="anim-in">
      <QueryBanner loading={loading} error={error} noun="scans" />
      <PageHeader
        title="Scans"
        sub="Upload a floor plan and let Claude turn it into a costed estimate."
        cta={
          <PrimaryButton
            icon={<Plus size={15} strokeWidth={2.5} />}
            onClick={() => navigate("/detection/new")}
          >
            New scan
          </PrimaryButton>
        }
      />

      {loading ? (
        <Card>
          <div style={{ padding: 18, color: C.textMuted, fontStyle: "italic", fontSize: 14 }}>
            Loading scans…
          </div>
        </Card>
      ) : liveScans.length === 0 ? (
        <EmptyState
          title="No scans yet"
          body="Upload your first plan to start a scan and generate an estimate."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      ) : (
        <Card>
          <table style={{ width: "100%", fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <Th>File</Th>
                <Th>Client</Th>
                <Th>Stage</Th>
                <Th align="right">Items</Th>
                <Th>Progress</Th>
                <Th align="right">Started</Th>
              </tr>
            </thead>
            <tbody>
              {liveScans.map((s: any, i: number) => (
                <tr
                  key={s.id ?? s.file_name}
                  className="es-row"
                  onClick={() => navigate(`/detection/${s.id ?? `scan-${i + 1}`}`)}
                  style={{
                    borderTop: `1px solid ${C.border}`,
                    transition: "background-color 120ms",
                    cursor: "pointer",
                  }}
                >
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FileCheck2 size={16} color={(s.progress ?? s.p) === 100 ? C.green : C.orange} />
                      <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 500 }}>{s.file_name ?? s.f}</span>
                    </div>
                  </Td>
                  <Td>{s.client ?? s.c}</Td>
                  <Td>
                    <span style={{ fontFamily: FONT.heading, fontSize: 13, color: C.textMuted }}>{s.stage ?? s.s}</span>
                  </Td>
                  <Td align="right" mono>
                    <span style={{ fontWeight: 500 }}>{s.items_detected ?? s.n ?? 0}</span>
                  </Td>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, width: 160 }}>
                      <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border, overflow: "hidden" }}>
                        <div style={{ width: `${s.progress ?? s.p}%`, height: "100%", backgroundColor: (s.progress ?? s.p) === 100 ? C.green : C.orange }} />
                      </div>
                      <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.textMuted, width: 34 }}>{s.progress ?? s.p}%</span>
                    </div>
                  </Td>
                  <Td align="right" muted>
                    <span style={{ fontStyle: "italic", fontSize: 13 }}>
                      {formatAuShortDateTime(s.started_at ?? s.t)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Footer />
    </div>
  );
}
