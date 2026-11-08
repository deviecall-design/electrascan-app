/**
 * ScanDetailScreen — the 4-step scan pipeline.
 *
 * Route: /detection/:id
 *   1. Upload   — dashed dropzone
 *   2. Detect   — floor plan SVG + live detection list
 *   3. Review   — editable line items table w/ confidence bars
 *   4. Quote    — letterhead PDF preview + totals + CTAs
 *
 * All four step views + the StepBar live in this file. Detect previews the
 * uploaded drawing (not a mock office plan). Quote identity is allocated
 * as EST-YYMM-XXXX and Aries copy is scoped to the current job.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchEstimates, fetchScanById, fetchScans, insertScan, updateScan, ScanRow } from "../services/supabaseData";
import { buildScanWrite, readDetectedItems, recallScanFile, rememberScanFile, type StoredDetectedItem } from "../lib/scanRecord";
import { publicScanFailure } from "../lib/scanFailure";
import ScanFailure from "../components/ScanFailure";
import { billableItems, canSendQuote, formatVerified, verifiedPercent } from "../lib/takeoff";
import { generateScope, scopeLineItem, type ScopeOfWorks } from "../lib/scopeOfWorks";
import { loadAssemblies } from "../lib/assemblies";
import ScopeOfWorksCard, { ScopePreview } from "../components/desktop/ScopeOfWorksCard";
import { estimateSubtotal, groupEstimateLines, scaleMemberQtys } from "../lib/groupEstimateLines";
import { buildEstimateWorkbook, checkWorkbookUpload, linesFromDetections, workbookToArrayBuffer, type WorkbookPreview } from "../lib/estimateWorkbook";
import EstimateBoard from "../components/desktop/EstimateBoard";
import TakeoffWorkspace from "../components/desktop/TakeoffWorkspace";
import { approvalsHref } from "../lib/approvalsLink";
import { fetchWorkspaceSettings } from "../services/workspaceSettings";
import {
  ArrowLeft,
  ArrowRight,
  Upload as UploadIcon,
  Wand2,
  FileEdit,
  FileDown,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Bot,
  Send,
  Copy,
  Sparkles,
  RefreshCw,
  Plus,
  Flag,
} from "lucide-react";
import { detectElectricalComponents, DetectionResult, DetectionPhase } from "../analyze_pdf";
import { publicDetectionFailure } from "../lib/detectionCopy";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import {
  Card,
  MiniStat,
  Footer,
  B,
  Th,
  Td,
  ConfPill,
  SymbolBadge,
  Dots,
} from "../components/ui/anthropic";
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";
import { getActiveCompanyProfile } from "../services/companyProfile";
import {
  REVIEW_CATEGORIES,
  type ReviewSuggestion,
  displayRoom,
  getConfidenceMeta,
  getConfidenceState,
  groupSuggestionsByCategory,
  mapComponentToReviewFields,
  shouldQueueForReview,
  suggestReviewItem,
} from "../lib/reviewClassification";
import { peekNextReference } from "../services/estimateReferenceService";
import { persistQuoteFromScan } from "../services/persistQuote";
import { displayClient } from "../lib/jobLink";
import { cleanDocumentName, downloadStem, indexRows, readLocalDocumentLabels } from "../lib/documentLabel";
import { saveDocumentLabel } from "../services/documentLabel";
import RenameLabel from "../components/desktop/RenameLabel";
import { downloadEstimatePDF } from "../utils/estimatePdf";
import SourcePlanPreview from "../components/SourcePlanPreview";
import { ariesMarginSuggestion } from "../lib/ariesSuggestion";
import { computeQuoteTotals, lineTotal as qtyRateTotal } from "../lib/quoteTotals";
import { clampMargin, loadDefaultMargin } from "../lib/margin";
import { mapDetectionToQuoteItems, formatQtyRate, type ScanQuoteItem } from "../lib/scanQuote";
import { rememberPlanContext, recallPlanContext } from "../lib/planContext";

interface DetectedItem extends ScanQuoteItem {
  /** Room / location from the detector — never a hardcoded "Level 2". */
  room?: string;
  /** Raw analyze_pdf ComponentType, when we have one. */
  detectedType?: string;
  status?: StoredDetectedItem["status"];
  group?: string;
  marks?: StoredDetectedItem["marks"];
  manualPrice?: boolean;
  materialUnit?: number;
  labourUnit?: number;
  unit?: string;
  notes?: string;
}

/** Line total for an item: catalogue price when known, demo rates otherwise. */
function lineTotal(it: DetectedItem): number {
  return qtyRateTotal(it.qty, unitPriceOf(it));
}

function unitPriceOf(it: DetectedItem): number {
  if (typeof it.unitPrice === "number" && it.unitPrice > 0) return it.unitPrice;
  return 0;
}

function toStored(items: DetectedItem[]): StoredDetectedItem[] {
  return items.map(item => ({
    id: item.id,
    symbol: item.symbol,
    qty: item.qty,
    desc: item.desc,
    rateCode: item.rateCode,
    conf: item.conf,
    x: item.x,
    y: item.y,
    unitPrice: item.unitPrice,
    ...(item.manualPrice ? { manualPrice: true as const } : {}),
    ...(typeof item.materialUnit === "number" ? { materialUnit: item.materialUnit } : {}),
    ...(typeof item.labourUnit === "number" ? { labourUnit: item.labourUnit } : {}),
    ...(item.unit ? { unit: item.unit } : {}),
    ...(item.notes ? { notes: item.notes } : {}),
    category: item.category,
    room: item.room,
    detectedType: item.detectedType,
    status: item.status,
    group: item.group,
    marks: item.marks,
  }));
}

/** True when we have no price at all — surfaced as "Price required" in Review. */
function isUnpriced(it: DetectedItem): boolean {
  return lineTotal(it) === 0;
}

/** Green that clears WCAG AA as text on white and as white text on this fill. */
const AA_GREEN = "#047857";

// ─── mapDetectionToItems ─────────────────────────────────────────────────
function mapDetectionToItems(detection: DetectionResult | null | undefined): DetectedItem[] {
  if (!detection || !Array.isArray(detection.components) || detection.components.length === 0) {
    return [];
  }
  // Quote mapping from #9 (qty×rate, no fabricated GPO codes), then #10 Review
  // classification so an EDB does not inherit the lighting LT badge/label.
  return mapDetectionToQuoteItems(detection.components).map((item, i) => {
    const c = detection.components[i];
    const fields = mapComponentToReviewFields(c);
    return {
      ...item,
      symbol: fields.symbol,
      desc: fields.desc,
      category: fields.quoteCategory,
      room: c.room,
      detectedType: c.type,
    };
  });
}

// ─── Screen root ────────────────────────────────────────────────────────
export default function ScanDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [liveScan, setLiveScan] = useState<ScanRow | null>(null);
  const [step, setStep] = useState(id === "new" ? 1 : 2);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [uploadedName, setUploadedName] = useState<string>("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedRef, setSavedRef] = useState<string | null>(null);
  const [minVerifiedPct, setMinVerifiedPct] = useState<number | null>(null);
  const [scanLoading, setScanLoading] = useState(Boolean(id && id !== "new"));
  const skipStageRestore = useRef(false);
  const skipTakeoffSave = useRef(true);
  const { data: labelEstimates } = useSupabaseQuery(fetchEstimates);
  const { data: labelScans } = useSupabaseQuery(fetchScans);
  const [labelTick, setLabelTick] = useState(0);

  useEffect(() => {
    if (!id || id === "new") {
      setScanLoading(false);
      setLoadError(null);
      return;
    }
    setScanLoading(true);
    setLoadError(null);
    let cancelled = false;
    fetchScanById(id).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message || "This scan could not be opened.");
        setScanLoading(false);
        return;
      }
      setLoadError(null);
      const row = data as ScanRow;
      setLiveScan(row);
      const restored = readDetectedItems(row.detected_items);
      if (restored.length) {
        skipTakeoffSave.current = true;
        setDetectedItems(restored as DetectedItem[]);
      }
      const cached = recallScanFile(id);
      if (cached) {
        setSourceFile(cached);
        setUploadedName(cached.name);
      } else if (row.file_name) {
        setUploadedName(row.file_name);
      }
      if (row.estimate_ref) setSavedRef(row.estimate_ref);
      const stageMap: Record<string, number> = {
        upload: 1, detecting: 2, review: 2, quote: 3, sign: 4,         complete: 4,
      };
      const persisted = stageMap[row.stage ?? ""];
      if (persisted && !skipStageRestore.current) setStep(persisted);
      skipStageRestore.current = false;
      setScanLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoadError("This scan could not be opened.");
      setScanLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, loadAttempt]);

  const isNew = id === "new";
  // Prefer the name of the file the user actually uploaded this session, then
  // the persisted scan, and only then a placeholder. Previously a new scan was
  // always titled "New scan" no matter what was uploaded, and a saved scan fell
  // back to a hardcoded demo filename.
  const fileName =
    uploadedName || liveScan?.file_name || (isNew ? "New scan" : "Untitled scan");
  const clientLabel = liveScan?.client ?? "";
  const estimateReference = savedRef || liveScan?.estimate_ref || "";
  const planLabel = useMemo(() => {
    const labels = indexRows(
      labelEstimates as Array<Record<string, unknown>>,
      labelScans as Array<Record<string, unknown>>,
      readLocalDocumentLabels(),
    );
    return (id && labels.byScanId[id])
      || (estimateReference && labels.byReference[estimateReference])
      || cleanDocumentName(fileName)
      || fileName;
  }, [labelEstimates, labelScans, id, estimateReference, fileName, labelTick]);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceSettings().then(settings => {
      if (!cancelled) setMinVerifiedPct(settings.minVerifiedPct);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!id || id === "new" || skipTakeoffSave.current) {
      skipTakeoffSave.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const stored = toStored(detectedItems);
      void updateScan(id, {
        detected_items: stored,
        items_detected: billableItems(stored).length,
      }).then(result => {
        if (result?.error) setPersistError(result.error.message || "This takeoff could not be saved.");
        else setPersistError(null);
      });
    }, 500);
    return () => window.clearTimeout(handle);
  }, [detectedItems, id]);

  const retrySave = async () => {
    const stored = toStored(detectedItems);
    if (!id || id === "new") {
      const payload = buildScanWrite({
        fileName: uploadedName || fileName,
        client: clientLabel || null,
        stage: "review",
        items: stored,
      });
      const { data, error } = await insertScan(payload);
      if (error || !data?.id) {
        setPersistError(error?.message || "This scan could not be saved.");
        return;
      }
      setPersistError(null);
      if (sourceFile) rememberScanFile(data.id, sourceFile);
      skipStageRestore.current = true;
      navigate(`/detection/${data.id}`, { replace: true });
      return;
    }
    const result = await updateScan(id, {
      detected_items: stored,
      items_detected: billableItems(stored).length,
    });
    if (result?.error) setPersistError(result.error.message || "This takeoff could not be saved.");
    else setPersistError(null);
  };

  return (
    <div className="anim-in es-flow">
      <button
        type="button"
        className="es-link"
        onClick={() => navigate("/detection")}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted, fontFamily: FONT.heading, marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to scans
      </button>

      {loadError && !liveScan ? (
        <ScanFailure
          title="This scan could not be opened"
          body={publicScanFailure(loadError, "The scan did not come back. Try again in a moment.")}
          onRetry={() => setLoadAttempt(n => n + 1)}
        />
      ) : (
      <>
      <div className="es-scan-title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>
          {scanLoading ? "Loading takeoff" : planLabel}
        </h1>
        {!scanLoading && (
          <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textMuted, flexShrink: 0 }}>
            {estimateReference || (isNew ? "New scan" : "No estimate yet")}
          </span>
        )}
      </div>
      {!scanLoading && (
        <RenameLabel
          label={planLabel}
          onSave={async next => {
            await saveDocumentLabel({ label: next, reference: estimateReference, scanId: id });
            setLabelTick(tick => tick + 1);
          }}
        />
      )}
      {!scanLoading && (
        <p style={{ color: C.textMuted, margin: "0 0 8px 0" }}>
          {step === 1 && "Drop a PDF floor plan. Detected symbols are priced from your rate library."}
          {step === 2 && (clientLabel || "Confirm each line. Low-confidence items stay off the quote until you confirm them.")}
          {step === 3 && "Price the takeoff and save it. The dashboard and estimates list read this quote."}
          {step === 4 && "Review the breakdown, save the quote if it is not saved yet, then send it for signature or prepare the materials list."}
        </p>
      )}
      {persistError && (
        <div style={{ marginBottom: 16 }}>
          <ScanFailure
            title="This scan could not be saved"
            body={publicScanFailure(persistError, "This scan could not be saved. Try again in a moment.")}
            onRetry={retrySave}
          />
        </div>
      )}

      {scanLoading ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: RADIUS.xl,
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <Loader2 size={28} className="spin" color={C.orange} aria-hidden="true" />
          <h2 style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, margin: 0 }}>Loading this takeoff</h2>
          <p style={{ color: C.textMuted, margin: 0 }}>Saved detections will appear here in a moment.</p>
        </div>
      ) : (
      <>
      <StepBar step={step} onStep={setStep} />

      {step === 1 && (
        <StepUpload
          onNext={async (items, file) => {
            const nextItems = items ?? [];
            setDetectedItems(nextItems);
            setSourceFile(file);
            setUploadedName(file.name);
            setStep(2);
            setPersistError(null);
            const context = recallPlanContext(file.name);
            const payload = {
              ...buildScanWrite({
                fileName: file.name,
                client: clientLabel || null,
                stage: "review",
                items: toStored(nextItems),
              }),
              risk_flags: context ? [{ type: "plan_context", ...context }] : [],
            };
            const { data, error } = await insertScan(payload);
            if (error || !data?.id) {
              setPersistError(error?.message || "This scan could not be saved.");
              return;
            }
            rememberScanFile(data.id, file);
            skipStageRestore.current = true;
            navigate(`/detection/${data.id}`, { replace: true });
          }}
        />
      )}
      {step === 2 && (
        <StepReview
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          items={detectedItems}
          file={sourceFile}
          fileName={fileName}
          marginPct={loadDefaultMargin()}
          minVerifiedPct={minVerifiedPct}
          onChange={next => {
            skipTakeoffSave.current = false;
            setDetectedItems(next as DetectedItem[]);
          }}
        />
      )}
      {step === 3 && (
        <StepQuote
          onBack={() => setStep(2)}
          items={detectedItems}
          onChange={next => {
            skipTakeoffSave.current = false;
            setDetectedItems(next);
          }}
          clientName={clientLabel}
          sourceFileName={uploadedName || liveScan?.file_name}
          planLabel={planLabel}
          scanId={id}
          minVerifiedPct={minVerifiedPct}
          onSaved={ref => {
            setSavedRef(ref);
            setStep(4);
          }}
        />
      )}
      {step === 4 && (
        <SignHandoff
          reference={savedRef || liveScan?.estimate_ref}
          scanId={id}
          items={detectedItems}
          onBack={() => setStep(3)}
        />
      )}
      </>
      )}
      </>
      )}

      <Footer />
    </div>
  );
}

// ─── StepBar ────────────────────────────────────────────────────────────
interface StepBarProps { step: number; onStep: (n: number) => void }

function StepBar({ step, onStep }: StepBarProps) {
  const steps = [
    { n: 1, label: "Upload plan", icon: <UploadIcon size={14} /> },
    { n: 2, label: "Review takeoff", icon: <FileEdit size={14} /> },
    { n: 3, label: "Price & send", icon: <FileDown size={14} /> },
    { n: 4, label: "Sign & order", icon: <Send size={14} /> },
  ];
  return (
    <div className="es-stepbar" style={{ display: "flex", alignItems: "center", backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: 6, marginBottom: 24, gap: 4 }}>
      {steps.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <button
            key={s.n}
            type="button"
            aria-current={active ? "step" : undefined}
            aria-label={done ? `${s.label}, completed` : active ? `${s.label}, current step` : s.label}
            onClick={() => onStep(s.n)}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 7,
              backgroundColor: active ? C.orange : "transparent",
              color: active ? "#fff" : done ? C.text : C.textMuted,
              fontFamily: FONT.heading,
              fontSize: 13,
              fontWeight: 500,
              transition: "background-color 180ms",
              minWidth: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 20, height: 20, borderRadius: "50%",
                backgroundColor: active ? "rgba(255,255,255,0.22)" : done ? AA_GREEN : C.borderSoft,
                color: active ? "#fff" : done ? "#fff" : C.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {done ? <Check size={11} strokeWidth={3} /> : s.n}
            </span>
            <span className="es-step-label">{s.label}</span>
            {i < steps.length - 1 && <ChevronRight className="es-step-chevron" size={14} aria-hidden="true" style={{ marginLeft: 8, opacity: 0.4, flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Step 1: Upload ─────────────────────────────────────────────────────
type UploadState = "idle" | "detecting" | "error";

function StepUpload({ onNext }: { onNext: (items: DetectedItem[], file: File) => void }) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<DetectionPhase>("rendering");
  const [phaseMsg, setPhaseMsg] = useState<string>("Starting…");
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A scan runs for minutes. Ticking the elapsed time is the clearest signal
  // that work is still happening — a static spinner reads as a hung page.
  useEffect(() => {
    if (uploadState !== "detecting") return;
    const started = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [uploadState]);

  const runDetection = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadState("detecting");
    setErrorMsg("");
    setPhase("rendering");
    setPhaseMsg("Rendering drawing pages…");
    try {
      const result = await detectElectricalComponents(file, "001", undefined, p => {
        setPhase(p.phase);
        setPhaseMsg(p.message);
      });
      const mapped = mapDetectionToItems(result);
      rememberPlanContext(file.name, {
        pageCount: result.page_count ?? null,
        legend: (result.legend_items || []).map(row => ({
          symbol: row.mapped_type || "",
          description: row.symbol_description || "",
          quantity: row.quantity,
          inScope: row.in_electrical_scope,
          kind: "legend" as const,
        })),
        schedules: (result.legend_items || [])
          .filter(row => /schedule|board|db/i.test(`${row.symbol_description} ${row.notes}`))
          .map(row => ({
            symbol: row.mapped_type || "DB",
            description: row.symbol_description || "",
            quantity: row.quantity,
            inScope: row.in_electrical_scope,
            kind: "schedule" as const,
          })),
        notes: (result.legend_items || []).map(row => row.notes).filter(Boolean),
      });
      onNext(mapped, file);
    } catch (err: any) {
      console.error("[ElectraScan] Detection failed:", err);
      setErrorMsg(publicDetectionFailure(err?.message ?? ""));
      setUploadState("error");
    }
  }, [onNext]);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    if (!isPdf && !isPng) {
      setErrorMsg("Only PDF or PNG files are accepted.");
      setUploadState("error");
      return;
    }
    runDetection(file);
  }, [runDetection]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    handleFile(file);
    // Reset so the same file can be re-selected after an error
    e.target.value = "";
  }, [handleFile]);

  // ── Detecting state ──
  if (uploadState === "detecting") {
    return (
      <div
        className="anim-in"
        style={{
          backgroundColor: C.bgCard,
          border: `2px dashed ${C.border}`,
          borderRadius: RADIUS.xl,
          padding: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: RADIUS.xl, backgroundColor: C.orangeSoft, color: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={28} className="spin" />
        </div>
        <div>
          <h2 style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, margin: "0 0 6px 0" }}>
            ElectraScan is analysing
          </h2>
          <p style={{ color: C.textMuted, fontStyle: "italic", margin: 0 }}>
            {fileName} — {phaseMsg}
          </p>
          <p style={{ color: C.textSubtle, fontFamily: FONT.mono, fontSize: 12, margin: "8px 0 0 0" }}>
            {Math.floor(elapsed / 60)}m {String(elapsed % 60).padStart(2, "0")}s elapsed
            {" · "}a full drawing usually takes 2–4 minutes
          </p>
        </div>
        {/* These pills used to animate on a timer regardless of what was
            happening. They now track the real phase reported by the detector,
            so a long pass looks like progress instead of a stalled page. */}
        <div style={{ display: "flex", gap: 4 }}>
          {([
            { label: "Rendering pages", key: "rendering" },
            { label: "Reading legend", key: "legend" },
            { label: "Scanning floor plan", key: "floorplan" },
            { label: "Pricing", key: "building" },
          ] as const).map(({ label, key }, i) => {
            const order: DetectionPhase[] = ["rendering", "legend", "floorplan", "building", "done"];
            const current = order.indexOf(phase);
            const mine = order.indexOf(key);
            const state = mine < current ? "done" : mine === current ? "active" : "pending";
            return (
            <span
              key={label}
              style={{
                fontSize: 11, fontFamily: FONT.heading, padding: "3px 10px",
                borderRadius: RADIUS.pill,
                backgroundColor: state === "pending" ? C.bgSoft : C.orangeSoft,
                color: state === "pending" ? C.textSubtle : C.orange,
                fontWeight: state === "active" ? 600 : 400,
                opacity: state === "pending" ? 0.6 : 1,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
              className={state === "active" ? "pulse" : undefined}
            >
              {state === "done" ? <Check size={10} strokeWidth={3} /> : null}
              {label}
            </span>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (uploadState === "error") {
    return (
      <div
        className="anim-in"
        style={{
          backgroundColor: C.bgCard,
          border: `2px dashed ${C.red}`,
          borderRadius: RADIUS.xl,
          padding: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: RADIUS.xl, backgroundColor: C.redSoft, color: C.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, margin: 0, color: C.red }}>
          Detection failed
        </h2>
        <p style={{ color: C.textMuted, fontStyle: "italic", margin: 0, maxWidth: 480 }}>
          {errorMsg}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <PrimaryButton
            onClick={() => { setUploadState("idle"); setErrorMsg(""); setFileName(""); }}
            icon={<RefreshCw size={15} />}
          >
            Try again
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ── Idle / drag-and-drop state ──
  return (
    <div
      className="anim-in"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        backgroundColor: dragOver ? C.orangeSoft : C.bgCard,
        border: `2px dashed ${dragOver ? C.orange : C.border}`,
        borderRadius: RADIUS.xl,
        padding: 64,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
        transition: "background-color 180ms, border-color 180ms",
        cursor: "default",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,application/pdf,image/png"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />
      <div style={{ width: 56, height: 56, borderRadius: RADIUS.xl, backgroundColor: C.orangeSoft, color: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <UploadIcon size={24} />
      </div>
      <h2 style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, margin: 0 }}>
        Drop your floor plan here
      </h2>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: 0, maxWidth: 420 }}>
        PDF or PNG. ElectraScan AI will detect symbols, map them to your rate library, and draft a quote.
      </p>
      <PrimaryButton onClick={() => fileInputRef.current?.click()}>
        Upload floor plan →
      </PrimaryButton>
    </div>
  );
}

// ─── Step 2: Detecting ──────────────────────────────────────────────────
function StepDetecting({
  onNext,
  items: propItems,
  sourceFile,
  sourceFileName,
}: {
  onNext: () => void;
  items?: DetectedItem[];
  sourceFile: File | null;
  sourceFileName?: string;
}) {
  const source = propItems ?? [];
  const isRealDetection = source.length > 0;
  const [revealed, setRevealed] = useState(isRealDetection ? source.length : 0);

  useEffect(() => {
    if (isRealDetection) return; // real detection already complete — skip animation
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed(n => {
        if (n >= source.length) { clearInterval(id); return n; }
        return n + 1;
      });
    }, 380);
    return () => clearInterval(id);
  }, [source.length]);

  const items = source.slice(0, revealed);
  const ready = revealed >= source.length;

  return (
    <div className="anim-in es-split">
      {/* Floor plan */}
      <div style={{ backgroundColor: C.bgPaper, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, overflow: "hidden", position: "relative" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: C.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={14} color={C.orange} className={ready ? "" : "pulse"} />
            <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 500, color: C.textMuted }}>
              {ready ? "Detection complete" : "ElectraScan AI analysing"}
              {!ready && <Dots />}
            </span>
          </div>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textSubtle }}>
            {sourceFileName || "Source drawing"}
          </span>
        </div>
        <SourcePlanPreview file={sourceFile} fileName={sourceFileName} />
      </div>

      {/* Detection list */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, margin: 0 }}>
            Detected items{" "}
            <span style={{ color: C.textSubtle, fontWeight: 400 }}>({revealed}/{source.length})</span>
          </h3>
          {!ready && <Loader2 size={14} className="spin" color={C.orange} />}
        </div>
        <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, overflow: "hidden" }}>
          {items.map((it, i) => (
            <div
              key={it.id}
              className="anim-in"
              style={{
                padding: "12px 16px",
                borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <SymbolBadge symbol={it.symbol} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500 }}>
                  {it.desc}{" "}
                  <span style={{ color: C.textSubtle, fontWeight: 400 }}>× {it.qty}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>
                  {it.room ? `${it.room} · ` : ""}
                  {typeof it.unitPrice === "number" && it.unitPrice > 0
                    ? formatQtyRate(it.qty, it.unitPrice)
                    : (it.rateCode ? `matched ${it.rateCode}` : "price required")}
                </div>
              </div>
              <ConfPill c={it.conf} />
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: C.textSubtle, fontStyle: "italic", fontSize: 13 }}>
              Waiting for first symbols…
            </div>
          )}
        </div>

        {ready && (
          <div className="anim-in" style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <PrimaryButton onClick={onNext} icon={<ArrowRight size={15} />}>
              Review detected items
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confidence state helpers (spec Section 8.2) ────────────────────────

type ConfidenceState = "recognised" | "low_confidence" | "unrecognised" | "unclear";

const CONF_TONE: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  green: {
    icon: <Check size={11} strokeWidth={3} />,
    color: AA_GREEN,
    bg: C.greenSoft,
    border: AA_GREEN,
  },
  amber: {
    icon: <AlertTriangle size={11} />,
    color: C.amber,
    bg: C.amberSoft,
    border: C.amber,
  },
  orange: {
    icon: <AlertTriangle size={11} />,
    color: C.amber,
    bg: C.amberSoft,
    border: C.amber,
  },
  red: {
    icon: <HelpCircle size={11} />,
    color: "#9f1239",
    bg: C.redSoft,
    border: "#9f1239",
  },
};

function ConfStateBadge({ conf }: { conf: number }) {
  const meta = getConfidenceMeta(conf);
  const cfg = CONF_TONE[meta.tone];
  return (
    <span
      title={meta.hint}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 11, fontFamily: FONT.heading, fontWeight: 500,
        padding: "3px 8px", borderRadius: RADIUS.sm,
        color: cfg.color, backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.icon}
      {meta.label}
    </span>
  );
}

// ─── Review Queue Panel (spec Section 8.3) ───────────────────────────────

type ReviewAction = "classify" | "not_in_scope" | "flag_site";

interface ReviewQueueItem {
  id: number;
  symbol: string;
  desc: string;
  room: string;
  conf: number;
  state: ConfidenceState;
  suggestion: ReviewSuggestion;
  resolution: ReviewAction | null;
  classifyData?: {
    category: string;
    description: string;
    qty: number;
    rate: number;
  };
}

function ClassifyForm({
  suggestion,
  onSave,
  onCancel,
}: {
  suggestion: ReviewSuggestion;
  onSave: (data: ReviewQueueItem["classifyData"]) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(suggestion.category);
  const [description, setDescription] = useState(suggestion.description);
  const [qty, setQty] = useState(suggestion.qty);
  const [rate, setRate] = useState(suggestion.rate);

  return (
    <div style={{
      marginTop: 10, padding: 14,
      backgroundColor: C.bg, borderRadius: RADIUS.md,
      border: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: C.textSubtle, marginBottom: 4, fontFamily: FONT.heading }}>Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              width: "100%", padding: "6px 8px", fontSize: 13,
              border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
              backgroundColor: C.bgCard, color: C.text, fontFamily: FONT.heading,
            }}
          >
            {REVIEW_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: C.textSubtle, marginBottom: 4, fontFamily: FONT.heading }}>Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={suggestion.placeholder}
            style={{
              width: "100%", padding: "6px 8px", fontSize: 13,
              border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
              backgroundColor: C.bgCard, color: C.text, fontFamily: FONT.heading,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: C.textSubtle, marginBottom: 4, fontFamily: FONT.heading }}>Qty</label>
          <input
            type="number"
            value={qty}
            min={1}
            onChange={e => setQty(Math.max(1, Number(e.target.value)))}
            style={{
              width: "100%", padding: "6px 8px", fontSize: 13,
              border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
              backgroundColor: C.bgCard, color: C.text, fontFamily: FONT.mono,
              boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, color: C.textSubtle, marginBottom: 4, fontFamily: FONT.heading }}>Rate ($/unit)</label>
          <input
            type="number"
            value={rate}
            min={0}
            onChange={e => setRate(Math.max(0, Number(e.target.value)))}
            style={{
              width: "100%", padding: "6px 8px", fontSize: 13,
              border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
              backgroundColor: C.bgCard, color: C.text, fontFamily: FONT.mono,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSave({
            category,
            description: description || suggestion.label || "Unclassified item",
            qty,
            rate,
          })}
          style={{
            padding: "7px 14px", fontSize: 12, fontFamily: FONT.heading, fontWeight: 600,
            backgroundColor: C.orange, color: "#fff", border: "none",
            borderRadius: RADIUS.sm, cursor: "pointer",
          }}
        >
          Add to estimate
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "7px 14px", fontSize: 12, fontFamily: FONT.heading,
            backgroundColor: "transparent", color: C.textMuted,
            border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function classifyPayload(suggestion: ReviewSuggestion): ReviewQueueItem["classifyData"] {
  return {
    category: suggestion.category,
    description: suggestion.description || suggestion.label,
    qty: suggestion.qty,
    rate: suggestion.rate,
  };
}

function ReviewQueuePanel({
  items,
  onResolve,
  onResolveMany,
}: {
  items: ReviewQueueItem[];
  onResolve: (id: number, action: ReviewAction, classifyData?: ReviewQueueItem["classifyData"]) => void;
  onResolveMany: (ids: number[], action: ReviewAction, classifyData?: ReviewQueueItem["classifyData"]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [classifyingId, setClassifyingId] = useState<number | null>(null);

  const unresolvedItems = items.filter(i => i.resolution === null);
  const blockers = unresolvedItems.filter(i => getConfidenceMeta(i.conf).blocksLock);
  const groups = groupSuggestionsByCategory(
    unresolvedItems.map(item => ({ item, suggestion: item.suggestion })),
  );

  if (unresolvedItems.length === 0) return null;

  const headerTone = blockers.length > 0 ? C.red : C.amber;
  const headerBg = blockers.length > 0 ? C.redSoft : C.amberSoft;
  const headerBorder = blockers.length > 0 ? C.red : C.amber;

  return (
    <div style={{
      border: `1px solid ${headerBorder}`,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: headerBg,
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "none", border: "none",
          cursor: "pointer", gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <AlertCircle size={16} color={headerTone} />
          <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: headerTone }}>
            Review Queue
          </span>
          <span style={{
            fontSize: 11, fontFamily: FONT.heading, fontWeight: 700,
            backgroundColor: headerTone, color: "#fff",
            padding: "2px 8px", borderRadius: RADIUS.pill,
          }}>
            {unresolvedItems.length} to confirm
          </span>
          <span style={{ fontSize: 12, color: headerTone, fontFamily: FONT.heading }}>
            {groups.length} {groups.length === 1 ? "group" : "groups"} · add by type, then tweak outliers
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {blockers.length > 0 && (
            <span style={{ fontSize: 11, color: C.red, fontFamily: FONT.heading }}>
              {blockers.length} unrecognised — blocks estimate lock
            </span>
          )}
          {collapsed ? <ChevronDown size={15} color={headerTone} /> : <ChevronUp size={15} color={headerTone} />}
        </div>
      </button>

      {!collapsed && (
        <div style={{ backgroundColor: C.bgCard, borderTop: `1px solid ${headerBorder}55` }}>
          {groups.map(group => {
            const ids = group.items.map(g => g.item.id);
            const sample = group.items[0].suggestion;
            return (
              <div key={group.category} style={{ borderTop: `1px solid ${C.border}` }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 12, padding: "10px 16px", backgroundColor: C.bgSoft,
                  flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600 }}>
                      {group.category}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      {" · "}suggested ${sample.rate.toLocaleString()} / unit
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onResolveMany(ids, "classify")}
                      style={{
                        padding: "6px 12px", fontSize: 12, fontFamily: FONT.heading, fontWeight: 600,
                        backgroundColor: C.orange, color: "#fff",
                        border: "none", borderRadius: RADIUS.sm, cursor: "pointer",
                      }}
                    >
                      Add all {group.items.length} as {group.category}
                    </button>
                    <button
                      onClick={() => onResolveMany(ids, "not_in_scope")}
                      style={{
                        padding: "6px 12px", fontSize: 12, fontFamily: FONT.heading,
                        backgroundColor: "transparent", color: C.textMuted,
                        border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, cursor: "pointer",
                      }}
                    >
                      All not in scope
                    </button>
                  </div>
                </div>

                {group.items.map(({ item }) => (
                  <div
                    key={item.id}
                    style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <SymbolBadge symbol={item.symbol} small />
                          <span style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600 }}>
                            {item.desc}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: C.textMuted }}>{item.room}</span>
                          <ConfStateBadge conf={item.conf} />
                          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.textSubtle }}>
                            {Math.round((item.conf > 1 ? item.conf : item.conf * 100))}%
                          </span>
                          <span style={{ fontSize: 12, color: C.textSubtle }}>
                            {item.suggestion.category} · ${item.suggestion.rate.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {classifyingId !== item.id && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => onResolve(item.id, "classify", classifyPayload(item.suggestion))}
                          style={{
                            padding: "6px 12px", fontSize: 12, fontFamily: FONT.heading, fontWeight: 600,
                            backgroundColor: C.orange, color: "#fff",
                            border: "none", borderRadius: RADIUS.sm, cursor: "pointer",
                          }}
                        >
                          Classify & Add
                        </button>
                        <button
                          onClick={() => setClassifyingId(item.id)}
                          style={{
                            padding: "6px 12px", fontSize: 12, fontFamily: FONT.heading,
                            backgroundColor: "transparent", color: C.text,
                            border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, cursor: "pointer",
                          }}
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => onResolve(item.id, "not_in_scope")}
                          style={{
                            padding: "6px 12px", fontSize: 12, fontFamily: FONT.heading,
                            backgroundColor: "transparent", color: C.textMuted,
                            border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, cursor: "pointer",
                          }}
                        >
                          Not In Scope
                        </button>
                        <button
                          onClick={() => onResolve(item.id, "flag_site")}
                          style={{
                            padding: "6px 12px", fontSize: 12, fontFamily: FONT.heading,
                            backgroundColor: C.amberSoft, color: C.amber,
                            border: `1px solid ${C.amber}`, borderRadius: RADIUS.sm, cursor: "pointer",
                          }}
                        >
                          Flag for Site Check
                        </button>
                      </div>
                    )}

                    {classifyingId === item.id && (
                      <ClassifyForm
                        suggestion={item.suggestion}
                        onSave={data => {
                          onResolve(item.id, "classify", data);
                          setClassifyingId(null);
                        }}
                        onCancel={() => setClassifyingId(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Review ─────────────────────────────────────────────────────
function buildQueueItem(it: DetectedItem): ReviewQueueItem {
  const suggestion = suggestReviewItem({
    description: it.desc,
    symbol: it.symbol,
    detectedType: it.detectedType,
    qty: it.qty,
    unitPrice: it.unitPrice,
  });
  return {
    id: it.id,
    symbol: suggestion.symbol,
    desc: suggestion.label,
    room: displayRoom(it.room),
    conf: it.conf,
    state: getConfidenceState(it.conf),
    suggestion,
    resolution: null,
  };
}

function StepReview({
  onNext,
  onBack,
  items: propItems,
  file,
  fileName,
  marginPct,
  minVerifiedPct,
  onChange,
}: {
  onNext: () => void;
  onBack: () => void;
  items?: DetectedItem[];
  file: File | null;
  fileName?: string;
  marginPct: number;
  minVerifiedPct: number | null;
  onChange: (items: StoredDetectedItem[]) => void;
}) {
  return (
    <TakeoffWorkspace
      items={propItems ?? []}
      file={file}
      fileName={fileName}
      marginPct={marginPct}
      minVerifiedPct={minVerifiedPct}
      onChange={onChange}
      onNext={onNext}
      onBack={onBack}
    />
  );
}


// ─── Step 4: Quote ──────────────────────────────────────────────────────
function StepQuote({
  onBack,
  items: propItems,
  onChange,
  clientName,
  sourceFileName,
  planLabel,
  scanId,
  minVerifiedPct = null,
  onSaved,
}: {
  onBack: () => void;
  items?: DetectedItem[];
  onChange?: (items: DetectedItem[]) => void;
  clientName?: string;
  sourceFileName?: string;
  planLabel?: string;
  scanId?: string;
  minVerifiedPct?: number | null;
  onSaved?: (reference: string) => void;
}) {
  const allItems = propItems ?? [];
  const source = billableItems(allItems) as DetectedItem[];
  const verifiedLabel = formatVerified(allItems);
  const sendBlocked = !canSendQuote(allItems, minVerifiedPct);
  const company = getActiveCompanyProfile();
  const [estimateRef, setEstimateRef] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const plan = useMemo(() => recallPlanContext(sourceFileName), [sourceFileName]);
  const generatedScope = useMemo(() => generateScope({
    items: allItems,
    assemblies: loadAssemblies(),
    legend: plan?.legend,
    schedules: plan?.schedules,
  }), [allItems, plan]);
  const [scope, setScope] = useState<ScopeOfWorks>(generatedScope);
  const [scopeEdited, setScopeEdited] = useState(false);
  useEffect(() => {
    if (!scopeEdited) setScope(generatedScope);
  }, [generatedScope, scopeEdited]);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<WorkbookPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    peekNextReference().then(ref => {
      if (!cancelled) setEstimateRef(ref);
    });
    return () => { cancelled = true; };
  }, []);

  const [marginPct, setMarginPct] = useState(loadDefaultMargin);
  const [marginTouched, setMarginTouched] = useState(false);
  const pricedLines = useMemo(() => source.filter(item => !isUnpriced(item)).map(item => ({
    description: item.desc,
    qty: item.qty,
    unitPrice: unitPriceOf(item),
    category: item.category || "Other",
    code: item.rateCode,
    ids: [item.id],
  })), [source]);
  const subtotal = useMemo(() => estimateSubtotal(pricedLines), [pricedLines]);
  const totals = computeQuoteTotals(subtotal, marginPct);
  const suggestion = ariesMarginSuggestion({
    clientName,
    marginPct,
  });

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceSettings().then(settings => {
      if (cancelled || marginTouched) return;
      setMarginPct(clampMargin(settings.defaultMarginPct));
    });
    return () => { cancelled = true; };
  }, [marginTouched]);

  // Breakdown built by summing the detected lines in each category. This used
  // to be fixed percentages of the subtotal (12% power, 22% lighting, ...),
  // which produced a plausible-looking quote with no relationship to the
  // drawing — including a "Cabling & conduit" line worth 30% of every job
  // whether or not any cable was detected.
  const groups = useMemo(() => {
    const buckets = new Map<string, ReturnType<typeof groupEstimateLines<typeof pricedLines[number]>>>();
    for (const line of groupEstimateLines(pricedLines)) {
      const list = buckets.get(line.category || "Other") ?? [];
      list.push(line);
      buckets.set(line.category || "Other", list);
    }
    return [...buckets.entries()].map(([category, lines]) => ({
      category,
      total: estimateSubtotal(lines),
      lines,
    }));
  }, [pricedLines]);

  function editGroupedLine(ids: number[] | undefined, patch: { qty?: number; unitPrice?: number }) {
    if (!onChange || !ids?.length) return;
    const idSet = new Set(ids);
    const members = allItems.filter(item => idSet.has(item.id));
    if (patch.unitPrice != null) {
      const unitPrice = patch.unitPrice;
      onChange(allItems.map(item => idSet.has(item.id)
        ? { ...item, unitPrice, materialUnit: unitPrice, labourUnit: 0, manualPrice: true }
        : item));
      return;
    }
    if (patch.qty == null) return;
    const scaled = scaleMemberQtys(members.map(item => item.qty), patch.qty);
    const nextQty = new Map(members.map((item, index) => [item.id, scaled[index] ?? 0]));
    onChange(allItems.map(item => nextQty.has(item.id) ? { ...item, qty: nextQty.get(item.id) ?? item.qty } : item));
  }

  // Items detection found but could not price. They are excluded from the
  // subtotal above, so the quote must say so rather than reading as complete.
  const unpricedCount = useMemo(() => source.filter(isUnpriced).length, [source]);

  const persistItems = useMemo(
    () => source.map(it => ({
      description: it.desc,
      qty: it.qty,
      unitPrice: unitPriceOf(it),
      category: it.category,
      symbol: it.symbol,
    })),
    [source],
  );

  async function handleSend() {
    if (sendBlocked) {
      setSaveError(`This workspace requires ${minVerifiedPct}% of the takeoff to be verified before a quote can be sent.`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const result = await persistQuoteFromScan({
      client: clientName || "",
      projectName: clientName || sourceFileName || null,
      drawingFile: sourceFileName || null,
      subtotal: totals.subtotal,
      marginPct: totals.marginPct,
      lineItems: [
        ...persistItems,
        { description: "Takeoff verified", qty: 0, unitPrice: 0, meta: "takeoff", verifiedPct: verifiedPercent(allItems) },
        scopeLineItem(scope),
      ],
      scopeOfWorks: scope,
      approvalStatus: "ready_for_approval",
      scanId,
      verifiedPct: verifiedPercent(allItems),
    });
    setSaving(false);
    if (result.ok === false) {
      setSaveError(result.error);
      return;
    }
    setEstimateRef(result.reference);
    setSaveMessage(`Saved as ${result.reference}. It is ready for approval.`);
    if (scanId && scanId !== "new") {
      await updateScan(scanId, { stage: "complete", progress: 100, estimate_ref: result.reference });
    }
    onSaved?.(result.reference);
  }

  async function handleDownloadPdf() {
    setPdfBusy(true);
    setSaveError(null);
    try {
      await downloadEstimatePDF({
        company,
        estimateNumber: estimateRef || "EST-DRAFT",
        date: new Date().toLocaleDateString("en-AU"),
        drawingFile: sourceFileName,
        projectName: planLabel || cleanDocumentName(sourceFileName) || "Electrical estimate",
        clientName,
        items: source
          .filter(it => !isUnpriced(it))
          .map(it => ({
            description: it.desc,
            qty: it.qty,
            unitPrice: unitPriceOf(it),
            category: it.category,
            code: it.rateCode,
          })),
        marginPercent: marginPct,
        scope,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  const estimateId = estimateRef || "EST-DRAFT";
  const marginLocked = Boolean(saveMessage);
  const labourAmount = source.filter(item => !isUnpriced(item)).reduce((sum, item) => sum + item.qty * (item.labourUnit ?? 0), 0);
  const labourShare = Math.min(subtotal, labourAmount);
  const materialShare = Math.max(0, subtotal - labourShare);

  function handleDownloadExcel() {
    setExcelBusy(true);
    setExcelError(null);
    try {
      const lines = linesFromDetections(source, estimateId);
      const book = buildEstimateWorkbook({ estimateId, marginPct, lines, planLabel });
      const blob = new Blob([workbookToArrayBuffer(book)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${downloadStem(planLabel || estimateId, estimateId)}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : "Could not build the workbook.");
    } finally {
      setExcelBusy(false);
    }
  }

  async function handleExcelFile(file: File) {
    setExcelError(null);
    const checked = checkWorkbookUpload({
      estimateId,
      marginPct,
      items: allItems,
      file: await file.arrayBuffer(),
      locked: marginLocked,
    });
    if (!checked.ok) {
      setExcelPreview(null);
      setExcelError(checked.error);
      return;
    }
    setExcelPreview(checked);
  }

  function applyExcel() {
    if (!excelPreview || !onChange) return;
    onChange(excelPreview.next as DetectedItem[]);
    setExcelPreview(null);
  }

  const blockReason = source.length === 0
    ? "No billable lines on this quote yet. Confirm items on the takeoff first."
    : sendBlocked
      ? `This workspace requires ${minVerifiedPct}% of the takeoff to be verified before a quote can be sent.`
      : null;

  return (
    <EstimateBoard
      companyName={company.name}
      licence={company.licence}
      estimateId={estimateId}
      planLabel={planLabel || cleanDocumentName(sourceFileName)}
      client={displayClient({ client: clientName, fileName: sourceFileName, drawingFile: sourceFileName })}
      site={sourceFileName || "Site not set"}
      status={saveMessage ? "Ready for approval" : "Draft"}
      date={new Date().toLocaleDateString("en-AU")}
      totals={totals}
      marginPct={marginPct}
      onMargin={value => {
        setMarginTouched(true);
        setMarginPct(clampMargin(value, marginPct));
      }}
      marginLocked={marginLocked}
      lineCount={groups.reduce((sum, group) => sum + group.lines.length, 0)}
      unpricedCount={unpricedCount}
      materials={materialShare}
      labour={labourShare}
      sections={groups.map(group => ({
        category: group.category,
        total: group.total,
        lines: group.lines.map(line => ({
          key: `${line.category}-${line.description}-${line.unitPrice}-${line.code || ""}`,
          description: line.description,
          qty: line.qty,
          unit: "ea",
          rate: line.unitPrice,
          total: line.lineAmount ?? line.qty * line.unitPrice,
          ids: line.ids,
        })),
      }))}
      onQty={(ids, qty) => editGroupedLine(ids, { qty })}
      onRate={(ids, rate) => editGroupedLine(ids, { unitPrice: rate })}
      onPdf={handleDownloadPdf}
      pdfBusy={pdfBusy}
      onExcel={handleDownloadExcel}
      excelBusy={excelBusy}
      onExcelFile={file => void handleExcelFile(file)}
      excelError={excelError || saveError}
      excelPreview={excelPreview}
      onApplyExcel={applyExcel}
      onDismissExcel={() => setExcelPreview(null)}
      onSave={handleSend}
      saveBusy={saving}
      saveDisabled={saving || source.length === 0 || sendBlocked}
      saveLabel={saving ? "Saving…" : "Save for approval"}
      blockReason={blockReason}
      suggestion={suggestion}
      onBack={onBack}
      scopeSection={(
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <ScopePreview scope={scope} />
          </Card>
          <Card style={{ padding: 18 }}>
            <ScopeOfWorksCard
              scope={scope}
              onChange={next => { setScopeEdited(true); setScope(next); }}
              onRebuild={() => { setScopeEdited(false); setScope(generatedScope); }}
            />
          </Card>
        </div>
      )}
    />
  );
}

function SignHandoff({
  reference,
  scanId,
  items,
  onBack,
}: {
  reference?: string | null;
  scanId?: string;
  items: DetectedItem[];
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const href = approvalsHref(scanId, reference);
  return (
    <Card style={{ padding: 28, maxWidth: 720 }}>
      <h2 style={{ margin: "0 0 8px", fontFamily: FONT.heading, fontSize: 20 }}>Sign and order</h2>
      <p style={{ color: C.textMuted, marginTop: 0 }}>
        {formatVerified(items)}. {reference ? `Quote ${reference} is saved.` : "The quote is not saved yet."} Signature and the materials request are handled on Approvals, so there is one place to send them.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <PrimaryButton icon={<Send size={16} />} onClick={() => navigate(href)}>
          Open approvals
        </PrimaryButton>
        <GhostButton onClick={onBack}>Back to price & send</GhostButton>
      </div>
    </Card>
  );
}
