import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { C, FONT } from "../components/desktop/tokens";
import { PageHeader, Card, Footer, EmptyState } from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchRateLibrary, fetchScans, insertScan } from "../services/supabaseData";
import { detectElectricalComponents } from "../analyze_pdf";
import { mapDetectionToQuoteItems } from "../lib/scanQuote";
import { buildScanWrite, type StoredDetectedItem } from "../lib/scanRecord";
import { publicDetectionFailure } from "../lib/detectionCopy";
import { costSplit, type RateLike } from "../lib/takeoff";
import {
  linesFromDetected,
  variationChain,
  variationProjectKey,
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

interface ChainScan {
  id: string;
  file_name?: string;
  client?: string | null;
  started_at?: string | null;
  detected_items?: unknown;
}

function signedMoney(amount: number) {
  return `${amount < 0 ? "−" : "+"}${formatQuotedValue(Math.abs(amount))}`;
}

export default function VariationReportScreen() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: scans, loading, error } = useSupabaseQuery(fetchScans);
  const { data: rates } = useSupabaseQuery(fetchRateLibrary);
  const [project, setProject] = useState<string | null>(null);
  const [addedScans, setAddedScans] = useState<ChainScan[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const rateRows = rates as RateLike[];
  const known = scans.filter((scan: { detected_items?: unknown }) => linesFromDetected(scan.detected_items).length > 0);
  const pool: ChainScan[] = [...known, ...addedScans];
  const projectKeys = [...new Set(pool.map(scan => variationProjectKey(scan)))];
  const newest = [...pool].sort((a, b) => Date.parse(a.started_at || "") - Date.parse(b.started_at || "")).at(-1);
  const activeKey = project && projectKeys.includes(project) ? project : (newest ? variationProjectKey(newest) : "unassigned");
  const versions = variationChain(pool, activeKey, rateRows);
  const latest = versions.length > 1 ? versions[versions.length - 1] : null;
  const materialNet = latest ? latest.changes.reduce((sum, line) => sum + line.materialDelta, 0) : 0;
  const labourNet = latest ? latest.changes.reduce((sum, line) => sum + line.labourDelta, 0) : 0;

  async function onRevisedPlan(file: File) {
    const base = versions[versions.length - 1]?.scan;
    if (!base) {
      setUploadError("Save a scan before comparing a revised plan.");
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const detected = await detectElectricalComponents(file, "001");
      const items: StoredDetectedItem[] = mapDetectionToQuoteItems(detected.components).map(item => {
        const draft: StoredDetectedItem = {
          ...item,
          status: "ai",
          materialUnit: typeof item.unitPrice === "number" ? item.unitPrice : 0,
          labourUnit: 0,
        };
        const labour = rateRows.length > 0 ? costSplit(draft, rateRows).labour : 0;
        return { ...draft, labourUnit: labour };
      });
      const write = buildScanWrite({
        fileName: file.name,
        client: base.client ?? null,
        stage: "review",
        items,
      });
      const saved = await insertScan(write);
      const savedId = saved.data && typeof saved.data === "object" && "id" in saved.data
        ? String((saved.data as { id?: string }).id || "")
        : "";
      setAddedScans(prev => [...prev, {
        id: savedId || `local-${Date.now()}`,
        file_name: write.file_name,
        client: write.client,
        started_at: new Date().toISOString(),
        detected_items: write.detected_items,
      }]);
      if (saved.error) {
        setUploadError(saved.error.message || "The comparison is on screen. The revised scan was not saved.");
      }
    } catch (err) {
      setUploadError(publicDetectionFailure(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="anim-in">
      <QueryBanner loading={loading} error={error} noun="variations" />
      <PageHeader
        crumb="Projects"
        title="Variation report"
        sub="Each later plan for the same job is compared with the takeoff before it. Added and removed items show materials and labour."
      />

      {!loading && versions.length === 0 && (
        <EmptyState
          title="No takeoff to compare"
          body="Upload a plan and review the detected items. Then come back and upload the revised drawing."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      )}

      {versions.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <p style={{ color: C.textMuted, marginTop: 0 }}>
              {versions[0].scan.client || "Unassigned takeoff"}
              {" · "}
              {versions[0].scan.file_name || "Original plan"}
              {latest ? ` → ${latest.scan.file_name || "Revised plan"}` : ""}
              {" · "}
              {formatQuotedValue(versions[0].materials)} materials on the original takeoff
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
              <PrimaryButton disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "Reading revised plan…" : "Upload revised plan"}
              </PrimaryButton>
            </div>
          </div>

          {projectKeys.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {projectKeys.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProject(key)}
                  style={{ minHeight: 44, borderRadius: 999, padding: "0 14px", border: `1px solid ${C.border}`, background: activeKey === key ? C.ink : C.bgCard, color: activeKey === key ? "#fff" : C.text, fontWeight: 600 }}
                >
                  {key === "unassigned" ? "Unassigned" : key}
                </button>
              ))}
            </div>
          )}

          {uploadError && <p style={{ color: C.red }}>{uploadError}</p>}

          {latest && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
              <Stat label="Materials change" value={signedMoney(materialNet)} />
              <Stat label="Labour change" value={signedMoney(labourNet)} />
              <Stat label="Combined change" value={signedMoney(materialNet + labourNet)} />
              <Stat label="Items changed" value={String(latest.changes.length)} />
            </div>
          )}

          <p style={{ color: C.textMuted, fontSize: 14 }}>
            Materials stay at the saved takeoff price. Labour is the matching rate-library allowance and is stored on the revised scan so it is still here after a refresh.
          </p>

          {versions.map((version, index) => (
            <Card key={version.scan.id || `variation-${index}`} style={{ padding: 0, marginBottom: 16 }}>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ fontWeight: 700 }}>
                  Variation {index + 1}{index === 0 ? " · original plan" : ""}
                </div>
                <div style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>
                  {version.scan.file_name || "Plan"}
                  {" · "}
                  {formatQuotedValue(version.materials)} materials
                  {" · "}
                  {formatQuotedValue(version.labour)} labour
                </div>
              </div>
              {index === 0 ? (
                <p style={{ margin: 0, padding: "0 18px 16px", color: C.textMuted }}>
                  {version.lines.length} original items are ready. Upload the revised drawing to list what was added and what was removed.
                </p>
              ) : version.changes.length === 0 ? (
                <p style={{ margin: 0, padding: "0 18px 16px", color: C.textMuted }}>This plan matches the previous takeoff.</p>
              ) : version.changes.map(line => (
                <ChangeRow key={`${version.scan.id}-${line.change}-${line.description}`} line={line} />
              ))}
            </Card>
          ))}
        </>
      )}
      <Footer />
    </div>
  );
}

function ChangeRow({ line }: { line: VariationLine }) {
  const tone = TONE[line.change];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <span style={{ minWidth: 88, textAlign: "center", borderRadius: 999, padding: "8px 8px", fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>{tone.label}</span>
      <span style={{ flex: 1, fontWeight: 600, minWidth: 160 }}>
        {line.description}
        <span style={{ display: "block", fontWeight: 400, color: C.textMuted, fontSize: 13 }}>
          {line.prevQty} → {line.newQty}
        </span>
      </span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: line.materialDelta < 0 ? C.red : C.text }}>
        {signedMoney(line.materialDelta)} materials
      </span>
      <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: line.labourDelta < 0 ? C.red : C.text }}>
        {signedMoney(line.labourDelta)} labour
      </span>
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
