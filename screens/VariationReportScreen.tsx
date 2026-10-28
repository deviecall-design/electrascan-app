import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScans, insertScan } from "../services/supabaseData";
import { detectElectricalComponents } from "../analyze_pdf";
import { mapDetectionToQuoteItems } from "../lib/scanQuote";
import { buildScanWrite } from "../lib/scanRecord";
import { publicDetectionFailure } from "../lib/detectionCopy";
import {
  diffTakeoffLines,
  estimateRef,
  linesFromDetected,
  linesOf,
  materialsExGst,
  pickVariationPair,
  type TakeoffLine,
  type VariationLine,
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
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: estimates, loading, error } = useSupabaseQuery(fetchEstimates);
  const { data: scans, loading: scansLoading, error: scansError } = useSupabaseQuery(fetchScans);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [revision, setRevision] = useState<{ name: string; changes: VariationLine[] } | null>(null);

  const scansWithLines = scans.filter((scan: { detected_items?: unknown }) => linesFromDetected(scan.detected_items).length > 0);
  const base = scansWithLines.find((scan: { id?: string }) => scan.id === baseId) ?? scansWithLines[0] ?? null;
  const baseLines = linesFromDetected(base?.detected_items);
  const pair = useMemo(() => pickVariationPair(estimates), [estimates]);
  const savedChanges = useMemo(
    () => (pair && !revision ? diffTakeoffLines(linesOf(pair.base), linesOf(pair.next)) : []),
    [pair, revision],
  );
  const changes = revision?.changes ?? savedChanges;
  const net = changes.reduce((sum, line) => sum + line.delta, 0);
  const baseTotal = revision || !pair
    ? materialsExGst(baseLines)
    : (Number(pair.base.subtotal) || materialsExGst(linesOf(pair.base)));
  const pct = baseTotal > 0 ? (net / baseTotal) * 100 : 0;
  const pageLoading = loading || scansLoading;

  async function onRevisedPlan(file: File) {
    if (!base) {
      setUploadError("Save a scan before comparing a revised plan.");
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const detected = await detectElectricalComponents(file, "001");
      const nextLines: TakeoffLine[] = mapDetectionToQuoteItems(detected.components).map(item => ({
        description: item.desc,
        qty: item.qty,
        unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : 0,
      }));
      const diff = diffTakeoffLines(baseLines, nextLines);
      setRevision({ name: file.name, changes: diff });
      const saved = await insertScan(buildScanWrite({
        fileName: file.name,
        client: base.client ?? null,
        stage: "review",
        items: nextLines.map((line, index) => ({
          id: index + 1,
          symbol: "",
          qty: line.qty,
          desc: line.description,
          rateCode: "",
          conf: 1,
          x: 20,
          y: 20,
          unitPrice: line.unitPrice,
          status: "ai" as const,
        })),
      }));
      if (saved.error) setUploadError(saved.error.message || "The comparison is on screen. The revised scan was not saved.");
    } catch (err) {
      setUploadError(publicDetectionFailure(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={pageLoading} error={error || scansError} noun="variations" />
      <PageHeader
        crumb="Projects"
        title="Variation report"
        sub="Upload a revised plan to see what was added or removed, with the materials cost of each change."
      />

      {!pageLoading && !base && !pair && (
        <EmptyState
          title="No takeoff to compare"
          body="Upload a plan and review the detected items. Then come back and upload the revised drawing."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      )}

      {(base || pair) && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <p style={{ color: C.textMuted, marginTop: 0 }}>
              {revision
                ? `${base?.file_name || "Original plan"} → ${revision.name}`
                : pair
                  ? `${pair.next.client || pair.base.client || "Client not set"} · ${estimateRef(pair.base)} → ${estimateRef(pair.next)}`
                  : `${base?.file_name || "Original plan"} · ${formatQuotedValue(materialsExGst(baseLines))} materials on the original takeoff`}
            </p>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,application/pdf,image/png"
                style={{ display: "none" }}
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void onRevisedPlan(file);
                  event.target.value = "";
                }}
              />
              <PrimaryButton disabled={busy || !base} onClick={() => fileRef.current?.click()}>
                {busy ? "Reading revised plan…" : "Upload revised plan"}
              </PrimaryButton>
            </div>
          </div>
          {scansWithLines.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {scansWithLines.map((scan: { id: string; file_name?: string }) => (
                <button
                  key={scan.id}
                  type="button"
                  onClick={() => { setBaseId(scan.id); setRevision(null); }}
                  style={{ minHeight: 44, borderRadius: 999, padding: "0 14px", border: `1px solid ${C.border}`, background: base?.id === scan.id ? C.ink : C.bgCard, color: base?.id === scan.id ? "#fff" : C.text, fontWeight: 600 }}
                >
                  {scan.file_name || "Scan"}
                </button>
              ))}
            </div>
          )}
          {uploadError && <p style={{ color: C.red }}>{uploadError}</p>}
          {(revision || pair) && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                <Stat label="Materials change" value={`${net >= 0 ? "+" : "−"}${formatQuotedValue(Math.abs(net))}`} />
                <Stat label="% change" value={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`} />
                <Stat label="Items changed" value={String(changes.length)} />
              </div>
              <Card>
                {changes.length === 0 ? (
                  <p style={{ padding: 20, color: C.textMuted }}>These two takeoffs have the same quantities.</p>
                ) : changes.map(line => {
                  const tone = TONE[line.change];
                  return (
                    <div key={`${line.change}-${line.description}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
                      <span style={{ minWidth: 88, textAlign: "center", borderRadius: 999, padding: "8px 8px", fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>{tone.label}</span>
                      <span style={{ flex: 1, fontWeight: 600, minWidth: 160 }}>
                        {line.description}
                        <span style={{ display: "block", fontWeight: 400, color: C.textMuted, fontSize: 13 }}>
                          {line.prevQty} → {line.newQty} · {formatQuotedValue(line.unitPrice)} each
                        </span>
                      </span>
                      <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: line.delta < 0 ? C.red : C.text }}>
                        {line.delta < 0 ? "−" : "+"}{formatQuotedValue(Math.abs(line.delta))} materials
                      </span>
                    </div>
                  );
                })}
              </Card>
            </>
          )}
          {!revision && !pair && base && (
            <p style={{ color: C.textMuted }}>
              {baseLines.length} original items are ready. Upload the revised drawing to list what was added and what was removed.
            </p>
          )}
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
