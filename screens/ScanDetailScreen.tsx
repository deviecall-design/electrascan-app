/**
 * ScanDetailScreen — the 4-step scan pipeline.
 *
 * Route: /detection/:id
 *   1. Upload   — dashed dropzone
 *   2. Detect   — floor plan SVG + live detection list
 *   3. Review   — editable line items table w/ confidence bars
 *   4. Quote    — letterhead PDF preview + totals + CTAs
 *
 * All four step views + the StepBar + FloorPlan SVG live in this file. It's
 * long but keeping them colocated makes the mockup-to-code diff reviewable.
 * In Phase 5 follow-ups the Upload handler will wire to analyze_pdf.ts and
 * the Detect list will stream from Claude Vision via Supabase Edge Functions.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Bot,
  Send,
  Copy,
  Sparkles,
} from "lucide-react";
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

// ─── Mock data ──────────────────────────────────────────────────────────
// TODO: Replace DETECTED_ITEMS with streamed output from analyze_pdf.ts /
// Claude Vision. The shape is intentionally stable so the swap is a
// one-line useEffect that accumulates items onto state.
interface DetectedItem {
  id: number;
  symbol: string;
  qty: number;
  desc: string;
  rateCode: string;
  conf: number;
  x: number;
  y: number;
}

const DETECTED_ITEMS: DetectedItem[] = [
  { id: 1,  symbol: "GPO", qty: 14, desc: "Double power outlet",        rateCode: "GPO-001", conf: 0.98, x: 120, y: 140 },
  { id: 2,  symbol: "GPO", qty: 2,  desc: "Weatherproof GPO (balcony)", rateCode: "GPO-003", conf: 0.94, x: 380, y: 90  },
  { id: 3,  symbol: "LT",  qty: 22, desc: "LED downlight",              rateCode: "LT-001",  conf: 0.96, x: 210, y: 210 },
  { id: 4,  symbol: "SW",  qty: 9,  desc: "2-way light switch",         rateCode: "SW-002",  conf: 0.91, x: 85,  y: 280 },
  { id: 5,  symbol: "SW",  qty: 3,  desc: "Dimmer switch",              rateCode: "SW-003",  conf: 0.72, x: 340, y: 260 },
  { id: 6,  symbol: "DB",  qty: 1,  desc: "12-way distribution board",  rateCode: "SB-002",  conf: 0.99, x: 60,  y: 70  },
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

// ─── Screen root ────────────────────────────────────────────────────────
export default function ScanDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  // New scans start at Upload; existing scans jump to Detect for the demo.
  // Once real scans are persisted the step should come from the DB row.
  const [step, setStep] = useState(id === "new" ? 1 : 2);

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
          Switchboard_LV2_rev3.pdf
        </h1>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: C.textSubtle }}>
          {id ?? "EST-2026-0143"}
        </span>
      </div>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: "0 0 28px 0" }}>
        Bondi Tower Residences · Level 2 · uploaded 14 minutes ago
      </p>

      <StepBar step={step} onStep={setStep} />

      {step === 1 && <StepUpload onNext={() => setStep(2)} />}
      {step === 2 && <StepDetecting onNext={() => setStep(3)} />}
      {step === 3 && <StepReview onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <StepQuote onBack={() => setStep(3)} />}

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
function StepUpload({ onNext }: { onNext: () => void }) {
  // TODO: real drag-and-drop + file input wired to analyze_pdf.ts.
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
        gap: 14,
        textAlign: "center",
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: RADIUS.xl, backgroundColor: C.orangeSoft, color: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <UploadIcon size={24} />
      </div>
      <h2 style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600, margin: 0 }}>Drop your floor plan here</h2>
      <p style={{ color: C.textMuted, fontStyle: "italic", margin: 0, maxWidth: 420 }}>
        PDF, PNG, or DWG. Claude Vision will detect symbols, map them to your rate library, and draft a quote.
      </p>
      <PrimaryButton onClick={onNext}>Simulate upload →</PrimaryButton>
    </div>
  );
}

// ─── Step 2: Detecting ──────────────────────────────────────────────────
function StepDetecting({ onNext }: { onNext: () => void }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed(n => {
        if (n >= DETECTED_ITEMS.length) { clearInterval(id); return n; }
        return n + 1;
      });
    }, 380);
    return () => clearInterval(id);
  }, []);

  const items = DETECTED_ITEMS.slice(0, revealed);
  const ready = revealed >= DETECTED_ITEMS.length;

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
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textSubtle }}>Level 2 · Page 3/5</span>
        </div>
        <FloorPlan items={items} />
      </div>

      {/* Detection list */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontFamily: FONT.heading, fontSize: 15, fontWeight: 600, margin: 0 }}>
            Detected items{" "}
            <span style={{ color: C.textSubtle, fontWeight: 400 }}>({revealed}/{DETECTED_ITEMS.length})</span>
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
                  matched {it.rateCode}
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

// ─── Step 3: Review ─────────────────────────────────────────────────────
function StepReview({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [items, setItems] = useState(
    DETECTED_ITEMS.map(it => ({ ...it, ok: false })),
  );
  const needsReview = items.filter(i => i.conf < 0.8).length;
  const toggle = (id: number) =>
    setItems(arr => arr.map(i => (i.id === id ? { ...i, ok: !i.ok } : i)));

  return (
    <div className="anim-in" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      {needsReview > 0 && (
        <div
          style={{
            backgroundColor: C.amberSoft,
            border: `1px solid #e6d2aa`,
            borderRadius: RADIUS.lg,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={16} color={C.amber} />
          <span style={{ fontSize: 14 }}>
            <B>{needsReview} items</B> below 80% confidence — quick review recommended before rate matching.
          </span>
        </div>
      )}

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
              const rate = RATE_LOOKUP[it.rateCode];
              const unit = rate ? rate.rate + rate.labour : 0;
              const total = unit * it.qty;
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
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.textMuted }}>{it.rateCode}</span>
                    <span style={{ color: C.textSubtle, margin: "0 6px" }}>·</span>
                    <span style={{ fontSize: 13 }}>{rate?.description}</span>
                  </Td>
                  <Td align="right" mono>{it.qty}</Td>
                  <Td align="right" mono>${unit}</Td>
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
        <PrimaryButton onClick={onNext} icon={<ArrowRight size={15} />}>Generate quote</PrimaryButton>
      </div>
    </div>
  );
}

// ─── Step 4: Quote ──────────────────────────────────────────────────────
function StepQuote({ onBack }: { onBack: () => void }) {
  const company = getActiveCompanyProfile();
  const subtotal = useMemo(
    () =>
      DETECTED_ITEMS.reduce((sum, it) => {
        const r = RATE_LOOKUP[it.rateCode];
        return sum + (r ? (r.rate + r.labour) * it.qty : 0);
      }, 0),
    [],
  );
  const margin = Math.round(subtotal * 0.18);
  const gst = Math.round((subtotal + margin) * 0.1);
  const total = subtotal + margin + gst;

  const rows = [
    { d: "Power outlets (GPO + WP)",            t: subtotal * 0.12 },
    { d: "Lighting (LED downlights + pendant)", t: subtotal * 0.22 },
    { d: "Switching & dimming",                 t: subtotal * 0.08 },
    { d: "Data & comms (Cat6A)",                t: subtotal * 0.09 },
    { d: "Distribution board (12-way)",         t: subtotal * 0.10 },
    { d: "Safety & compliance",                 t: subtotal * 0.09 },
    { d: "Cabling & conduit",                   t: subtotal * 0.30 },
  ];

  return (
    <div className="anim-in" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
      {/* Letterhead preview */}
      <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONT.heading, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Preview · page 1 of 3</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: C.textSubtle }}>EST-2026-0143.pdf</span>
        </div>
        <div style={{ padding: 40, backgroundColor: C.bgPaper }}>
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
                <div style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 500 }}>EST-2026-0143</div>
              </div>
            </div>

            {/* Prepared-for / scope */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24, fontSize: 12 }}>
              <div>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textSubtle, marginBottom: 4 }}>Prepared for</div>
                <div style={{ fontWeight: 500 }}>Bondi Tower Residences</div>
                <div style={{ color: C.textMuted }}>Attn: Marco Petrou</div>
                <div style={{ color: C.textMuted }}>12 Campbell Parade, Bondi Beach</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT.heading, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textSubtle, marginBottom: 4 }}>Scope</div>
                <div style={{ fontWeight: 500 }}>Level 2 electrical fit-out</div>
                <div style={{ color: C.textMuted, fontStyle: "italic" }}>per Switchboard_LV2_rev3.pdf</div>
              </div>
            </div>

            {/* Line items summary */}
            <div style={{ fontSize: 11, fontFamily: FONT.mono, color: C.textSubtle, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Line items · summary
            </div>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span>{row.d}</span>
                <span style={{ fontFamily: FONT.mono }}>${Math.round(row.t).toLocaleString()}</span>
              </div>
            ))}

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <div style={{ width: 220, fontSize: 12 }}>
                <LetterRow l="Subtotal"     v={`$${subtotal.toLocaleString()}`} />
                <LetterRow l="Margin (18%)" v={`$${margin.toLocaleString()}`} />
                <LetterRow l="GST (10%)"    v={`$${gst.toLocaleString()}`} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0 0", marginTop: 6, borderTop: `2px solid ${C.text}`, fontFamily: FONT.heading, fontWeight: 600, fontSize: 14 }}>
                  <span>Total</span>
                  <span>${total.toLocaleString()}</span>
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
            ${total.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic", marginTop: 8 }}>
            incl. GST · 68 items · 18% margin
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
            <MiniStat label="Materials" v={`$${Math.round(subtotal * 0.55).toLocaleString()}`} />
            <MiniStat label="Labour"    v={`$${Math.round(subtotal * 0.45).toLocaleString()}`} />
            <MiniStat label="Margin"    v={`$${margin.toLocaleString()}`} tint={C.green} />
            <MiniStat label="Scan time" v="6m 48s" />
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
            Bondi Tower's last 3 quotes closed at <B>15–22%</B> margin. Your current <B>18%</B> sits in the sweet spot — I wouldn't push it.
          </p>
        </Card>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryButton icon={<Send size={15} />}>Send to client</PrimaryButton>
          <GhostButton icon={<FileDown size={14} />}>Download PDF</GhostButton>
          <GhostButton icon={<Copy size={14} />}>Duplicate as template</GhostButton>
        </div>

        <GhostButton onClick={onBack} icon={<ArrowLeft size={14} />}>Back to review</GhostButton>
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

// ─── FloorPlan SVG ──────────────────────────────────────────────────────
function FloorPlan({ items }: { items: DetectedItem[] }) {
  return (
    <svg viewBox="0 0 520 380" style={{ display: "block", width: "100%", height: "auto", backgroundColor: C.bgPaper }}>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={C.border} strokeWidth="0.5" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="520" height="380" fill="url(#grid)" />
      {/* Outer walls */}
      <rect x="30" y="40" width="460" height="310" fill="none" stroke={C.text} strokeWidth="2.5" />
      {/* Inner partitions */}
      <line x1="30"  y1="170" x2="260" y2="170" stroke={C.text} strokeWidth="2" />
      <line x1="260" y1="40"  x2="260" y2="260" stroke={C.text} strokeWidth="2" />
      <line x1="260" y1="260" x2="490" y2="260" stroke={C.text} strokeWidth="2" />
      <line x1="160" y1="170" x2="160" y2="350" stroke={C.text} strokeWidth="2" />
      <line x1="380" y1="40"  x2="380" y2="150" stroke={C.text} strokeWidth="2" />
      {/* Door gaps */}
      <line x1="110" y1="170" x2="140" y2="170" stroke={C.bgPaper} strokeWidth="3" />
      <line x1="260" y1="200" x2="260" y2="230" stroke={C.bgPaper} strokeWidth="3" />
      <line x1="200" y1="260" x2="230" y2="260" stroke={C.bgPaper} strokeWidth="3" />

      {/* Room labels */}
      {[
        { x: 95,  y: 100, t: "OFFICE A" },
        { x: 320, y: 150, t: "BOARDROOM" },
        { x: 95,  y: 260, t: "WORKSTATIONS" },
        { x: 210, y: 310, t: "BREAKOUT" },
        { x: 425, y: 310, t: "KITCHEN" },
      ].map((r, i) => (
        <text key={i} x={r.x} y={r.y} fontFamily={FONT.heading} fontSize="8" fill={C.textSubtle} letterSpacing="1.5">
          {r.t}
        </text>
      ))}

      {/* Detected markers */}
      {items.map(it => (
        <g key={it.id} className="anim-in">
          <circle cx={it.x} cy={it.y} r="14" fill={C.orangeSoft} opacity="0.7" />
          <circle cx={it.x} cy={it.y} r="8" fill={C.orange} />
          <text x={it.x} y={it.y + 2.5} fontFamily={FONT.heading} fontSize="7" fontWeight="600" fill="#fff" textAnchor="middle">
            {it.symbol}
          </text>
          <circle cx={it.x} cy={it.y} r="14" fill="none" stroke={C.orange} strokeWidth="1" opacity="0.5">
            <animate attributeName="r" from="8" to="22" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      <text x="490" y="368" fontFamily={FONT.mono} fontSize="8" fill={C.textSubtle} textAnchor="end" opacity="0.7">
        analysed by Claude Vision · 0.4.2
      </text>
    </svg>
  );
}
