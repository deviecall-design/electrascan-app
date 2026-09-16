import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";
import { C } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  MiniStat,
  Footer,
  StatusPill,
  Th,
  Td,
} from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates } from "../services/supabaseData";
import {
  computeDashboardMoneyStats,
  quotedTotalIncGst,
  formatQuotedValue,
  estimateDisplayRef,
  daysSinceSent,
} from "../lib/estimateMoney";
import QueryBanner from "../components/QueryBanner";

export default function EstimateScreen() {
  const navigate = useNavigate();
  const { data: liveEstimates, loading, error } = useSupabaseQuery(fetchEstimates);

  const stats = useMemo(
    () => computeDashboardMoneyStats(liveEstimates),
    [liveEstimates],
  );
  const drafted = liveEstimates.length;
  const sentCount = liveEstimates.filter((e: any) => e.status === "sent").length;
  const approvedCount = liveEstimates.filter((e: any) => e.status === "approved").length;

  return (
    <div className="anim-in">
      <PageHeader
        title="Estimates"
        sub="Every quote saved for Vesh Electrical. Value is GST-inclusive. New estimates start from a scan."
        cta={
          <PrimaryButton icon={<Plus size={15} />} onClick={() => navigate("/estimate/new")}>
            New estimate
          </PrimaryButton>
        }
      />

      <QueryBanner loading={loading} error={error} noun="estimates" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Drafted"   v={loading ? "—" : String(drafted)} />
        <MiniStat label="Sent"      v={loading ? "—" : String(sentCount)}     tint={C.blue} />
        <MiniStat label="Approved"  v={loading ? "—" : String(approvedCount)} tint={C.green} />
        <MiniStat label="Win value" v={loading ? "—" : formatQuotedValue(stats.wonValue)} tint={C.green} />
      </div>

      <Card>
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>Reference</Th>
              <Th>Client</Th>
              <Th align="right">Value (inc GST)</Th>
              <Th>Status</Th>
              <Th align="right">Sent</Th>
              <Th width={32} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td>
                  <span style={{ fontStyle: "italic", color: C.textMuted }}>Loading estimates…</span>
                </Td>
                <Td>{""}</Td>
                <Td align="right">{""}</Td>
                <Td>{""}</Td>
                <Td align="right">{""}</Td>
                <Td>{""}</Td>
              </tr>
            ) : liveEstimates.length === 0 ? (
              <tr>
                <Td>
                  <span style={{ fontStyle: "italic", color: C.textMuted }}>
                    No estimates yet — send a quote from a scan to land it here.
                  </span>
                </Td>
                <Td>{""}</Td>
                <Td align="right">{""}</Td>
                <Td>{""}</Td>
                <Td align="right">{""}</Td>
                <Td>{""}</Td>
              </tr>
            ) : liveEstimates.map((e: any) => {
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

      <Footer />
    </div>
  );
}
