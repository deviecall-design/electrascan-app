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
import { fetchScanById, ScanRow } from "../services/supabaseData";
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
} from "lucide-react";
import { detectElectricalComponents, DetectionResult, DetectionPhase } from "../analyze_pdf";
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
import { downloadEstimatePDF } from "../utils/estimatePdf";
import SourcePlanPreview from "../components/SourcePlanPreview";
import { ariesMarginSuggestion } from "../lib/ariesSuggestion";
import { computeQuoteTotals, DEFAULT_MARGIN_PCT, formatAud, lineTotal as qtyRateTotal, roundCents } from "../lib/quoteTotals";
import { mapDetectionToQuoteItems, quoteVisibleLines, formatQtyRate, type ScanQuoteItem } from "../lib/scanQuote";

interface DetectedItem extends ScanQuoteItem {
  /** Room / location from the detector — never a hardcoded "Level 2". */
  room?: string;
  /** Raw analyze_pdf ComponentType, when we have one. */
  detectedType?: string;
}

/** Line total for an item: catalogue price when known, demo rates otherwise. */
function lineTotal(it: DetectedItem): number {
  return qtyRateTotal(it.qty, unitPriceOf(it));
}

function unitPriceOf(it: DetectedItem): number {
  if (typeof it.unitPrice === "number" && it.unitPrice > 0) return it.unitPrice;
  const r = RATE_LOOKUP[it.rateCode];
  return r ? r.rate + r.labour : 0;
}

/** True when we have no price at all — surfaced as "Price required" in Review. */
function isUnpriced(it: DetectedItem): boolean {
  return lineTotal(it) === 0;
}

const DETECTED_ITEMS: DetectedItem[] = [
  { id: 1,  symbol: "GPO", qty: 14, desc: "Double power outlet",        rateCode: "GPO-001", conf: 0.98, x: 120, y: 140 },
  { id: 2,  symbol: "GPO", qty: 2,  desc: "Weatherproof GPO (balcony)", rateCode: "GPO-003", conf: 0.94, x: 380, y: 90  },
  { id: 3,  symbol: "LT",  qty: 22, desc: "LED downlight",              rateCode: "LT-001",  conf: 0.96, x: 210, y: 210 },
  { id: 4,  symbol: "SW",  qty: 9,  desc: "2-way light switch",         rateCode: "SW-002",  conf: 0.91, x: 85,  y: 280 },
  { id: 5,  symbol: "SW",  qty: 3,  desc: "Dimmer switch",              rateCode: "SW-003",  conf: 0.72, x: 340, y: 260 },
  { id: 6,  symbol: "EDB", qty: 1,  desc: "Electrical distribution board", rateCode: "SB-002", conf: 0.85, x: 60,  y: 70, detectedType: "SWITCHBOARD_MAIN", category: "Distribution board" },
  { id: 7,  symbol: "SA",  qty: 5,  desc: "Smoke alarm",                rateCode: "SA-001",  conf: 0.95, x: 290, y: 180 },
  { id: 8,  symbol: "FN",  qty: 3,  desc: "Bathroom exhaust fan",       rateCode: "FN-001",  conf: 0.88, x: 440, y: 220 },
  { id: 9,  symbol: "DC",  qty: 6,  desc: "Cat6A data point",           rateCode: "DC-001",  conf: 0.93, x: 180, y: 320 },
  { id: 10, symbol: "LT",  qty: 2,  desc: "Pendant light (kitchen)",    rateCode: "LT-005",  conf: 0.65, x: 240, y: 120 },
];


const RATE_LOOKUP: Record<string, { description: string; rate: number; labour: number }> = {
  "GPO-001": { description: "Double GPO install (flush)",      rate: 85,  labour: 45 },
  "GPO-003": { description: "Weatherproof GPO IP56",           rate: 145, labour: 60 },
  "LT-001":  { description: "LED downlight 10W dimmable",      rate: 65,  labour: 40 },
  "LT-005":  { description: "Pendant rough-in",                rate: 120, labour: 55 },
  "SW-002":  { description: "2-way switch 1-gang",             rate: 55,  labour: 30 },
  "SW-003":  { description: "Dimmer switch LED-compatible",    rate: 95,  labour: 35 },
  "SB-002":  { description: "Distribution board 12-way",       rate: 680, labour: 320 },
  "SA-001":  { description: "Smoke alarm 240V interconnect",   rate: 140, labour: 50 },
  "FN-001":  { description: "Bathroom exhaust fan + duct",     rate: 185, labour: 75 },
  "DC-001":  { description: "Cat6A data point + faceplate",    rate: 135, labour: 55 },
};

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

  useEffect(() => {
    if (!id || id === "new") return;
    fetchScanById(id).then(({ data }) => {
      if (data) {
        setLiveScan(data as ScanRow);
        // Restore step from persisted stage when available
        const stageMap: Record<string, number> = {
          upload: 1, detecting: 2, review: 3, quote: 4,
        };
        const persisted = stageMap[data.stage ?? ""];
        if (persisted) setStep(persisted);
      }
    });
  }, [id]);

  const isNew = id === "new";
  // Prefer the name of the file the user actually uploaded this session, then
  // the persisted scan, and only then a placeholder. Previously a new scan was
  // always titled "New scan" no matter what was uploaded, and a saved scan fell
  // back to a hardcoded demo filename.
  const fileName =
    uploadedName || liveScan?.file_name || (isNew ? "New scan" : "Untitled scan");
  const clientLabel = liveScan?.client ?? "";

  return (
    <div className="anim-in">
      <button
        className="es-link"
        onClick={() => navigate("/detection")}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted, fontFamily: FONT.heading, marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to scans
      </button>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontFamily: FONT.heading, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          {fileName}
        </h1>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textSubtle }}>
          {isNew ? "new" : (id ?? "")}
        </span>
      </div>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: "0 0 28px 0" }}>
        {/* "uploaded 14 minutes ago" was hardcoded and shown on every scan
            regardless of age, leaving a dangling separator when no client is
            set. Show the client when we have one, and nothing when we do not. */}
        {clientLabel}
      </p>

      <StepBar step={step} onStep={setStep} />

      {step === 1 && (
        <StepUpload
          onNext={(items, file) => {
            setDetectedItems(items ?? []);
            if (file) {
              setSourceFile(file);
              setUploadedName(file.name);
            }
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <StepDetecting
          onNext={() => setStep(3)}
          items={detectedItems}
          sourceFile={sourceFile}
          sourceFileName={uploadedName || liveScan?.file_name}
        />
      )}
      {step === 3 && <StepReview onNext={() => setStep(4)} onBack={() => setStep(2)} items={detectedItems} />}
      {step === 4 && (
        <StepQuote
          onBack={() => setStep(3)}
          items={detectedItems}
          clientName={clientLabel}
          sourceFileName={uploadedName || liveScan?.file_name}
          scanId={id}
        />
      )}

      <Footer />
    </div>
  );
}

// ─── StepBar ────────────────────────────────────────────────────────────
interface StepBarProps { step: number; onStep: (n: number) => void }

function StepBar({ step, onStep }: StepBarProps) {
  const steps = [
    { n: 1, label: "Upload", icon: <UploadIcon size={14} /> },
    { n: 2, label: "Detect", icon: <Wand2 size={14} /> },
    { n: 3, label: "Review", icon: <FileEdit size={14} /> },
    { n: 4, label: "Quote",  icon: <FileDown size={14} /> },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: 6, marginBottom: 24, gap: 4 }}>
      {steps.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <button
            key={s.n}
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
              color: active ? "#fff" : done ? C.text : C.textSubtle,
              fontFamily: FONT.heading,
              fontSize: 13,
              fontWeight: 500,
              transition: "background-color 180ms",
            }}
          >
            <span
              style={{
                width: 20, height: 20, borderRadius: "50%",
                backgroundColor: active ? "rgba(255,255,255,0.22)" : done ? C.green : C.borderSoft,
                color: active ? "#fff" : done ? "#fff" : C.textSubtle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {done ? <Check size={11} strokeWidth={3} /> : s.n}
            </span>
            <span>{s.label}</span>
            {i < steps.length - 1 && <ChevronRight size={14} style={{ marginLeft: 8, opacity: 0.4 }} />}
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
      onNext(mapped, file);
    } catch (err: any) {
      console.error("[ElectraScan] Detection failed:", err);
      setErrorMsg(err?.message ?? "Unknown error during detection.");
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
            Claude Vision is analysing
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
          backgroundColor: "#FEF2F2",
          border: `2px dashed #EF4444`,
          borderRadius: RADIUS.xl,
          padding: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: RADIUS.xl, backgroundColor: "#FEE2E2", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, margin: 0, color: "#EF4444" }}>
          Detection failed
        </h2>
        <p style={{ color: "#B91C1C", fontStyle: "italic", margin: 0, maxWidth: 480 }}>
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
        PDF, PNG, or DWG. Claude Vision will detect symbols, map them to your rate library, and draft a quote.
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
    <div className="anim-in" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
      {/* Floor plan */}
      <div style={{ backgroundColor: C.bgPaper, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, overflow: "hidden", position: "relative" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: C.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bot size={14} color={C.orange} className={ready ? "" : "pulse"} />
            <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 500, color: C.textMuted }}>
              {ready ? "Detection complete" : "Claude Vision analysing"}
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
    color: "#10B981",
    bg: "#F0FDF4",
    border: "#10B981",
  },
  amber: {
    icon: <AlertTriangle size={11} />,
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#F59E0B",
  },
  orange: {
    icon: <AlertTriangle size={11} />,
    color: "#C2410C",
    bg: "#FFF7ED",
    border: "#FB923C",
  },
  red: {
    icon: <HelpCircle size={11} />,
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#EF4444",
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

  const headerTone = blockers.length > 0 ? "#EF4444" : "#B45309";
  const headerBg = blockers.length > 0 ? "#FEF2F2" : "#FFFBEB";
  const headerBorder = blockers.length > 0 ? "#EF4444" : "#F59E0B";

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
            <span style={{ fontSize: 11, color: "#EF4444", fontFamily: FONT.heading }}>
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
  const lookup = RATE_LOOKUP[it.rateCode];
  const fallbackRate = lookup ? lookup.rate + lookup.labour : undefined;
  const suggestion = suggestReviewItem({
    description: it.desc,
    symbol: it.symbol,
    detectedType: it.detectedType,
    qty: it.qty,
    unitPrice: it.unitPrice ?? fallbackRate,
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

function StepReview({ onNext, onBack, items: propItems }: { onNext: () => void; onBack: () => void; items?: DetectedItem[] }) {
  const source = propItems ?? [];
  const [items, setItems] = useState(
    source.map(it => ({ ...it, ok: false })),
  );

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(
    source.filter(it => shouldQueueForReview(it.conf)).map(buildQueueItem),
  );

  const toggle = (id: number) =>
    setItems(arr => arr.map(i => (i.id === id ? { ...i, ok: !i.ok } : i)));

  const resolveQueueItem = (id: number, action: ReviewAction, classifyData?: ReviewQueueItem["classifyData"]) => {
    setReviewQueue(q => q.map(i => i.id === id ? { ...i, resolution: action, classifyData } : i));
  };

  const resolveQueueItems = (ids: number[], action: ReviewAction, classifyData?: ReviewQueueItem["classifyData"]) => {
    const idSet = new Set(ids);
    setReviewQueue(q => q.map(i => {
      if (!idSet.has(i.id)) return i;
      const data = action === "classify"
        ? (classifyData ?? classifyPayload(i.suggestion))
        : classifyData;
      return { ...i, resolution: action, classifyData: data };
    }));
  };

  // Estimate lock is blocked if any Unrecognised or Unclear items are unresolved
  const blockingUnresolved = reviewQueue.filter(i =>
    (i.state === "unrecognised" || i.state === "unclear") && i.resolution === null
  );
  const lockBlocked = blockingUnresolved.length > 0;

  return (
    <div className="anim-in" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      {/* Review Queue — appears above component table */}
      <ReviewQueuePanel items={reviewQueue} onResolve={resolveQueueItem} onResolveMany={resolveQueueItems} />

      <Card>
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th width={48} />
              <Th>Symbol</Th>
              <Th>Description</Th>
              <Th>Matched rate</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Unit rate</Th>
              <Th align="right">Line total</Th>
              <Th>Confidence</Th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const total = lineTotal(it);
              const unit = it.qty > 0 ? total / it.qty : 0;
              return (
                <tr key={it.id} className="es-row" style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td>
                    <button
                      onClick={() => toggle(it.id)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1.5px solid ${it.ok ? C.green : C.border}`,
                        backgroundColor: it.ok ? C.green : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {it.ok && <Check size={11} color="#fff" strokeWidth={3} />}
                    </button>
                  </Td>
                  <Td><SymbolBadge symbol={it.symbol} small /></Td>
                  <Td>{it.desc}</Td>
                  <Td>
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.textMuted }}>
                      {it.rateCode || "—"}
                    </span>
                    <span style={{ color: C.textSubtle, margin: "0 6px" }}>·</span>
                    <span style={{ fontSize: 13 }}>
                      {RATE_LOOKUP[it.rateCode]?.description ?? (total > 0 ? "Catalogue rate" : "Price required")}
                    </span>
                  </Td>
                  <Td align="right" mono>{it.qty}</Td>
                  <Td align="right" mono>${Math.round(unit).toLocaleString()}</Td>
                  <Td align="right" mono><B>${total.toLocaleString()}</B></Td>
                  <Td><ConfPill c={it.conf} withBar /></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <GhostButton onClick={onBack} icon={<ArrowLeft size={14} />}>Back to detection</GhostButton>

        {/* Lock blocked tooltip wrapper */}
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          {lockBlocked && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", right: 0,
              backgroundColor: C.text, color: "#fff",
              fontSize: 12, fontFamily: FONT.heading,
              padding: "6px 10px", borderRadius: RADIUS.md,
              whiteSpace: "nowrap", pointerEvents: "none", zIndex: 10,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>
              <Lock size={11} style={{ marginRight: 5 }} />
              Resolve all Unrecognised / Unclear items first
            </div>
          )}
          <PrimaryButton
            onClick={lockBlocked ? undefined : onNext}
            icon={lockBlocked ? <Lock size={15} /> : <ArrowRight size={15} />}
          >
            {lockBlocked ? `Blocked — ${blockingUnresolved.length} unresolved` : "Generate quote"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Quote ──────────────────────────────────────────────────────
function StepQuote({
  onBack,
  items: propItems,
  clientName,
  sourceFileName,
  scanId,
}: {
  onBack: () => void;
  items?: DetectedItem[];
  clientName?: string;
  sourceFileName?: string;
  scanId?: string;
}) {
  const navigate = useNavigate();
  const source = propItems ?? [];
  const company = getActiveCompanyProfile();
  const [estimateRef, setEstimateRef] = useState<string>("…");
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    peekNextReference().then(ref => {
      if (!cancelled) setEstimateRef(ref);
    });
    return () => { cancelled = true; };
  }, []);

  const marginPct = company.defaultMargin ?? DEFAULT_MARGIN_PCT;
  const subtotal = useMemo(
    () => roundCents(source.reduce((sum, it) => sum + lineTotal(it), 0)),
    [source],
  );
  const totals = computeQuoteTotals(subtotal, marginPct);
  const ariesCopy = ariesMarginSuggestion({
    clientName,
    marginPct,
  });

  // Breakdown built by summing the detected lines in each category. This used
  // to be fixed percentages of the subtotal (12% power, 22% lighting, ...),
  // which produced a plausible-looking quote with no relationship to the
  // drawing — including a "Cabling & conduit" line worth 30% of every job
  // whether or not any cable was detected.
  const groups = useMemo(
    () => quoteVisibleLines(source.map(it => ({
      category: it.category,
      desc: it.desc,
      qty: it.qty,
      unitPrice: unitPriceOf(it),
    }))),
    [source],
  );

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
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    const result = await persistQuoteFromScan({
      client: clientName || "",
      projectName: clientName || sourceFileName || null,
      drawingFile: sourceFileName || null,
      subtotal: totals.subtotal,
      marginPct: totals.marginPct,
      lineItems: persistItems,
      status: "sent",
      scanId,
    });
    setSaving(false);
    if (result.ok === false) {
      setSaveError(result.error);
      return;
    }
    setEstimateRef(result.reference);
    setSaveMessage(`Saved as ${result.reference}. Dashboard pending value uses this GST-inclusive total.`);
  }

  async function handleDownloadPdf() {
    setPdfBusy(true);
    setSaveError(null);
    try {
      await downloadEstimatePDF({
        company,
        estimateNumber: estimateRef === "…" ? "EST-DRAFT" : estimateRef,
        date: new Date().toLocaleDateString("en-AU"),
        drawingFile: sourceFileName,
        projectName: clientName || sourceFileName || "Electrical estimate",
        clientName,
        items: source
          .filter(it => !isUnpriced(it))
          .map(it => ({
            description: it.desc,
            qty: it.qty,
            unitPrice: unitPriceOf(it),
          })),
        marginPercent: marginPct,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not generate the PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="anim-in" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
      {/* Letterhead preview */}
      <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Preview</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textSubtle }}>{estimateRef}.pdf</span>
        </div>
        {/* The quote preview is a document, so it stays on light paper even in
            the navy theme. Pin the text colour here: the inherited `C.text` is
            near-white and would be invisible on this surface. */}
        <div style={{ padding: 40, backgroundColor: C.bgPaper, color: C.paperText }}>
          <div
            style={{
              backgroundColor: "#fff",
              padding: 36,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
              minHeight: 540,
            }}
          >
            {/* Letterhead header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, paddingBottom: 16, borderBottom: `2px solid ${C.text}` }}>
              <div>
                <div style={{ fontFamily: FONT.heading, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {company.name.replace(" Pty Ltd", "").replace(" Services", "")}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", marginTop: 2 }}>
                  Licensed electrical contractor · NSW Lic. {company.licence}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT.heading, fontSize: 11, color: C.textSubtle, textTransform: "uppercase", letterSpacing: "0.1em" }}>Estimate</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 500 }}>{estimateRef}</div>
              </div>
            </div>

            {/* Prepared-for / scope */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, fontSize: 12 }}>
              <div>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textSubtle, marginBottom: 4 }}>Prepared for</div>
                {/* Was hardcoded to a fictional client (Bondi Tower Residences,
                    Attn: Marco Petrou). On a document the contractor sends to a
                    builder, invented recipient details are worse than a blank —
                    so show a clear prompt until the client is set. */}
                {clientName ? (
                  <div style={{ fontWeight: 500 }}>{clientName}</div>
                ) : (
                  <div style={{ fontWeight: 500, color: C.orange }}>Client not set</div>
                )}
              </div>
              <div>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textSubtle, marginBottom: 4 }}>Scope</div>
                <div style={{ fontWeight: 500 }}>Electrical fit-out</div>
                <div style={{ color: C.textMuted, fontStyle: "italic" }}>
                  {sourceFileName ? `per ${sourceFileName}` : "per uploaded drawing"}
                </div>
              </div>
            </div>

            {/* Line items summary */}
            <div style={{ fontSize: 11, fontFamily: FONT.mono, color: C.textSubtle, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Line items · qty × rate
            </div>
            {groups.length === 0 ? (
              <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", padding: "8px 0" }}>
                No priced lines yet.
              </div>
            ) : groups.map(group => (
              <div key={group.category} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, fontWeight: 600 }}>
                  <span>{group.category}</span>
                  <span style={{ fontFamily: FONT.mono }}>${Math.round(group.total).toLocaleString()}</span>
                </div>
                {group.lines.map((line, i) => (
                  <div key={`${line.desc}-${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0 3px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>
                    <span>{line.desc}</span>
                    <span style={{ fontFamily: FONT.mono }}>
                      {formatQtyRate(line.qty, line.unitPrice)} = ${Math.round(line.lineTotal).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <div style={{ width: 220, fontSize: 12 }}>
                <LetterRow l="Subtotal"     v={`$${formatAud(totals.subtotal)}`} />
                <LetterRow l={`Margin (${totals.marginPct}%)`} v={`$${formatAud(totals.marginAmount)}`} />
                <LetterRow l={`GST (${totals.gstRatePct}%)`}    v={`$${formatAud(totals.gst)}`} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0 0", marginTop: 6, borderTop: `2px solid ${C.text}`, fontFamily: FONT.heading, fontWeight: 600, fontSize: 14 }}>
                  <span>Total</span>
                  <span>${formatAud(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar — totals + Aries + actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Quoted total */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textSubtle, marginBottom: 6 }}>Quoted total</div>
          <div style={{ fontFamily: FONT.heading, fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1 }}>
            ${formatAud(totals.total, true)}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic", marginTop: 8 }}>
            incl. GST · {source.length} {source.length === 1 ? "item" : "items"} · {totals.marginPct}% margin
          </div>

          {/* Materials/Labour used to be a fixed 55/45 split of the subtotal.
              The catalogue gives a single supply-and-install rate per item, so
              that split was invented. These four are values we actually hold. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
            <MiniStat label="Subtotal ex GST" v={`$${formatAud(totals.subtotal, true)}`} />
            <MiniStat label="GST"             v={`$${formatAud(totals.gst, true)}`} />
            <MiniStat label="Margin"          v={`$${formatAud(totals.marginAmount, true)}`} tint={C.green} />
            <MiniStat
              label="Price required"
              v={String(unpricedCount)}
              tint={unpricedCount > 0 ? C.orange : undefined}
            />
          </div>
        </Card>

        {/* Aries suggests */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Sparkles size={14} color={C.orange} />
            <span style={{ fontFamily: FONT.heading, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textMuted }}>
              Aries suggests
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            {ariesCopy}
          </p>
        </Card>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryButton
            icon={<Send size={15} />}
            onClick={handleSend}
            disabled={saving || source.length === 0}
          >
            {saving ? "Saving…" : "Send to client"}
          </PrimaryButton>
          <GhostButton
            icon={<FileDown size={14} />}
            onClick={handleDownloadPdf}
            disabled={pdfBusy || source.length === 0}
          >
            {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </GhostButton>
          {saveMessage && (
            <p style={{ margin: 0, fontSize: 13, color: C.green, fontStyle: "italic" }}>{saveMessage}</p>
          )}
          {saveError && (
            <p style={{ margin: 0, fontSize: 13, color: "#B91C1C", fontStyle: "italic" }}>{saveError}</p>
          )}
          <GhostButton icon={<Copy size={14} />} disabled>
            Duplicate as template
          </GhostButton>
        </div>

        <GhostButton onClick={onBack} icon={<ArrowLeft size={14} />}>Back to review</GhostButton>
        <GhostButton onClick={() => navigate('/detection/new')} icon={<Plus size={14} />}>New scan</GhostButton>
      </div>
    </div>
  );
}

function LetterRow({ l, v }: { l: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: C.textMuted }}>
      <span>{l}</span>
      <span style={{ fontFamily: FONT.mono, color: C.text }}>{v}</span>
    </div>
  );
}
