import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates } from "../services/supabaseData";
import {
  diffTakeoffLines,
  estimateRef,
  linesOf,
  pickVariationPair,
} from "../lib/variationDiff";
import { formatQuotedValue } from "../lib/estimateMoney";
import QueryBanner from "../components/QueryBanner";

const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  added: { bg: C.greenSoft, fg: C.green, label: "Added" },
  removed: { bg: C.redSoft, fg: C.red, label: "Removed" },
  increased: { bg: C.amberSoft, fg: C.amber, label: "Changed" },
  decreased: { bg: C.amberSoft, fg: C.amber, label: "Changed" },
};

export default function VariationReportScreen() {
  const navigate = useNavigate();
  const { data: estimates, loading, error } = useSupabaseQuery(fetchEstimates);
  const pair = useMemo(() => pickVariationPair(estimates), [estimates]);
  const changes = useMemo(
    () => pair ? diffTakeoffLines(linesOf(pair.base), linesOf(pair.next)) : [],
    [pair],
  );
  const net = changes.reduce((sum, line) => sum + line.delta, 0);
  const baseTotal = Number(pair?.base.subtotal) || linesOf(pair?.base).reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const pct = baseTotal > 0 ? (net / baseTotal) * 100 : 0;

  return (
    <div className="anim-in">
      <QueryBanner loading={loading} error={error} noun="variations" />
      <PageHeader
        crumb="Projects"
        title="Variation report"
        sub="Compares two saved quotes for the same client. Nothing here is a sample job."
      />

      {!loading && !pair && (
        <EmptyState
          title="No variation to compare"
          body="Save two quotes that include takeoff lines — usually the original scan and a revised plan. This report will show what was added, removed, or changed."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      )}

      {pair && (
        <>
          <p style={{ color: C.textMuted, marginTop: 0 }}>
            {pair.next.client || pair.base.client || "Client not set"} · {estimateRef(pair.base)} → {estimateRef(pair.next)}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            <Stat label="Net change" value={`${net >= 0 ? "+" : "−"}${formatQuotedValue(Math.abs(net))}`} />
            <Stat label="% change" value={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`} />
            <Stat label="Items changed" value={String(changes.length)} />
          </div>
          <Card>
            {changes.length === 0 ? (
              <p style={{ padding: 20, color: C.textMuted }}>These two quotes have the same quantities.</p>
            ) : changes.map(line => {
              const tone = TONE[line.change];
              return (
                <div key={`${line.change}-${line.description}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: `1px solid ${C.border}` }}>
                  <span style={{ width: 88, textAlign: "center", borderRadius: 999, padding: "4px 8px", fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>{tone.label}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>
                    {line.description}
                    <span style={{ display: "block", fontWeight: 400, color: C.textMuted, fontSize: 13 }}>
                      {line.prevQty} → {line.newQty}
                    </span>
                  </span>
                  <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: line.delta < 0 ? C.red : C.text }}>
                    {line.delta < 0 ? "−" : "+"}{formatQuotedValue(Math.abs(line.delta))}
                  </span>
                </div>
              );
            })}
          </Card>
        </>
      )}
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: C.textMuted }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{value}</div>
    </Card>
  );
}
