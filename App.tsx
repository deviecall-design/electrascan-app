import { useState, useCallback, useRef } from "react";
import {
  detectElectricalComponents,
  DetectionResult,
  DetectedComponent,
  groupByRoom,
  getReviewItems,
} from "./analyze_pdf";

// ─── Design tokens ─────────────────────────────
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
};

// ─── Types ─────────────────────────────────────
type Screen = "upload" | "scanning" | "results" | "estimate";
type ResultTab = "schedule" | "risks";

// ─── Line item for estimate editor ─────────────
interface LineItem {
  id: string;
  description: string;
  room: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  locked: boolean;
  fromDetection: boolean;
  catalogueName?: string;
}

// ─── Component labels ───────────────────────────
const LABELS: Record<string, string> = {
  GPO_STANDARD:"Power Point",GPO_DOUBLE:"Double Power Point",GPO_WEATHERPROOF:"Weatherproof GPO",
  GPO_USB:"USB Power Point",DOWNLIGHT_RECESSED:"Downlight",PENDANT_FEATURE:"Pendant Light",
  EXHAUST_FAN:"Exhaust Fan",SWITCHING_STANDARD:"Light Switch",SWITCHING_DIMMER:"Dimmer Switch",
  SWITCHING_2WAY:"2-Way Switch",SWITCHBOARD_MAIN:"Main Switchboard",SWITCHBOARD_SUB:"Sub Board",
  AC_SPLIT:"Split System AC",AC_DUCTED:"Ducted AC",DATA_CAT6:"Data Point",DATA_TV:"TV/Data Point",
  SECURITY_CCTV:"CCTV Camera",SECURITY_INTERCOM:"Intercom",SECURITY_ALARM:"Alarm Sensor",
  EV_CHARGER:"EV Charger",POOL_OUTDOOR:"Pool Equipment",GATE_ACCESS:"Gate/Access",
  AUTOMATION_HUB:"Home Automation",
};

const CSS = `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{margin:0;padding:0;background:#0A1628;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
  @keyframes slideIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
  input[type=number]{-moz-appearance:textfield;}
`;

const fmt = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : fmt(n);

// ─── Convert detection results → line items ─────
function toLineItems(components: DetectedComponent[]): LineItem[] {
  return components.map((c, i) => ({
    id: `li-${i}-${Date.now()}`,
    description: c.catalogue_item_name ?? LABELS[c.type] ?? c.type,
    room: c.room,
    qty: c.quantity,
    unitPrice: c.unit_price,
    lineTotal: c.line_total,
    locked: false,
    fromDetection: true,
    catalogueName: c.catalogue_item_name,
  }));
}

// ─── Upload Screen ──────────────────────────────
function UploadScreen({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [drag, setDrag] = useState(false);
  const drop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") onFile(f);
  }, [onFile]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.blue, letterSpacing: "-0.03em" }}>
          Electra<span style={{ color: C.text }}>Scan</span>
        </div>
        <div style={{ fontSize: 11, color: C.muted, background: C.navy, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.border}` }}>Vesh Electrical</div>
      </div>
      {error && (
        <div style={{ margin: "12px 20px 0", background: `${C.red}22`, border: `1px solid ${C.red}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: C.red }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      <div style={{ padding: "32px 20px 0", animation: "fadeUp .4s ease" }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 10 }}>Scan a<br />drawing</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 28 }}>Upload the electrical PDF from your email. ElectraScan reads the legend, identifies every symbol, and builds your estimate automatically.</div>
        <label style={{ display: "block", cursor: "pointer" }}>
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}
            style={{ background: drag ? "#0D2347" : C.card, border: `2px dashed ${drag ? C.blue : C.border}`, borderRadius: 20, padding: "40px 20px", textAlign: "center", transition: "all .2s" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}>Drop PDF here</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>or tap to choose from files or email</div>
            <div style={{ display: "inline-block", background: C.blue, color: "#fff", fontSize: 15, fontWeight: 700, padding: "13px 32px", borderRadius: 12 }}>Choose PDF</div>
          </div>
          <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      </div>
      <div style={{ margin: "20px 20px 0", background: C.card, borderRadius: 16, padding: "18px", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 14 }}>What gets detected</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
          {[["⚡","Power points"],["💡","Downlights & strips"],["🔆","Switches & dimmers"],["🔌","Switchboards"],["🪟","Motorised blinds"],["📡","Data & TV"],["📹","Security & CCTV"],["🚗","EV chargers"],["🏊","Pool equipment"],["🏠","Automation"]].map(([icon,label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.dim }}><span style={{ fontSize: 14 }}>{icon}</span>{label}</div>
          ))}
        </div>
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}

// ─── Scanning Screen ────────────────────────────
function ScanningScreen({ fileName }: { fileName: string }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div style={{ width: 88, height: 88, borderRadius: "50%", background: `${C.blue}18`, border: `2.5px solid ${C.blue}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 28, animation: "pulse 1.8s ease-in-out infinite" }}>⚡</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 10, letterSpacing: "-0.02em" }}>Scanning drawing...</div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, maxWidth: 280 }}>
        Reading legend symbols then scanning every room in <strong style={{ color: C.dim }}>{fileName}</strong>
      </div>
      <div style={{ marginTop: 20, fontSize: 12, color: C.muted }}>Pass 1: Reading legend symbols...</div>
    </div>
  );
}

// ─── Results Screen ─────────────────────────────
function ResultsScreen({ result, fileName, onReset, onBuildEstimate }: {
  result: DetectionResult; fileName: string; onReset: () => void; onBuildEstimate: () => void;
}) {
  const [tab, setTab] = useState<ResultTab>("schedule");
  const byRoom = groupByRoom(result.components);
  const rooms = Object.keys(byRoom);
  const reviewCount = getReviewItems(result.components).length;
  const highRisks = result.risk_flags.filter(f => f.level === "high").length;
  const gst = result.estimate_subtotal * 0.1;
  const total = result.estimate_subtotal + gst;
  const [openRooms, setOpenRooms] = useState<Set<string>>(new Set([rooms[0]]));

  const toggleRoom = (room: string) => {
    setOpenRooms(prev => { const s = new Set(prev); s.has(room) ? s.delete(room) : s.add(room); return s; });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", paddingBottom: 80 }}>
      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>Electra<span style={{ color: C.text }}>Scan</span></div>
          <button onClick={onReset} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>New scan</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{fmtK(total)}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>inc GST</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: reviewCount > 0 ? C.amber : C.green }}>{reviewCount}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>to review</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: highRisks > 0 ? C.red : C.green }}>{result.components.length}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>items</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
          {fileName} · {result.page_count}p · Scale {result.scale_detected}
        </div>
      </div>

      <div style={{ flex: 1, padding: "16px 16px 0" }}>
        {tab === "schedule" && (
          <div>
            {rooms.map(room => {
              const comps = byRoom[room];
              const roomTotal = comps.reduce((s, c) => s + c.line_total, 0);
              const open = openRooms.has(room);
              return (
                <div key={room} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
                  <button onClick={() => toggleRoom(room)} style={{ width: "100%", background: "none", border: "none", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{room}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: C.blue }}>{fmtK(roomTotal)}</div>
                      <div style={{ fontSize: 20, color: C.muted, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s" }}>›</div>
                    </div>
                  </button>
                  {open && (
                    <div style={{ padding: "0 18px 16px" }}>
                      <div style={{ height: 1, background: C.border, marginBottom: 14 }} />
                      {comps.map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < comps.length - 1 ? `1px solid ${C.border}` : "none", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{c.catalogue_item_name ?? LABELS[c.type] ?? c.type}</div>
                            {c.symbol_visual && <div style={{ fontSize: 10, color: C.muted }}>Symbol: {c.symbol_visual}</div>}
                          </div>
                          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginBottom: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.confidence >= 90 ? C.green : c.confidence >= 70 ? C.amber : C.red }} />
                              <span style={{ fontSize: 11, color: C.muted }}>{c.confidence}%</span>
                            </div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", marginBottom: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{c.quantity}</span>
                              <span style={{ fontSize: 10, color: C.muted }}>EA</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(c.line_total)}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>{fmt(c.unit_price)}/ea</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Totals */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginTop: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Subtotal ex GST</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{fmt(result.estimate_subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.muted }}>GST (10%)</span>
                <span style={{ fontSize: 13, color: C.muted }}>{fmt(gst)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Total inc GST</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{fmt(total)}</span>
              </div>
              {/* Build estimate button */}
              <button onClick={onBuildEstimate} style={{ width: "100%", marginTop: 16, background: C.blue, border: "none", borderRadius: 12, padding: "15px", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer", letterSpacing: "-0.01em" }}>
                Build Estimate → EST-2026-001
              </button>
            </div>
          </div>
        )}
        {tab === "risks" && (
          <div>
            {result.risk_flags.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
                <div style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>No risk flags</div>
              </div>
            ) : result.risk_flags.map((flag, i) => (
              <div key={i} style={{ background: C.card, border: `1px solid ${flag.level === "high" ? `${C.red}55` : flag.level === "medium" ? `${C.amber}55` : C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: flag.level === "high" ? `${C.red}22` : flag.level === "medium" ? `${C.amber}22` : `${C.blue}22`, color: flag.level === "high" ? C.red : flag.level === "medium" ? C.amber : C.blueLt }}>
                    {flag.level.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{LABELS[flag.component_type] ?? flag.component_type}</div>
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{flag.description}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: C.navy, borderTop: `1px solid ${C.border}`, display: "flex", padding: "0 12px" }}>
        <button onClick={() => setTab("schedule")} style={{ flex: 1, background: "none", border: "none", padding: "12px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>📋</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: tab === "schedule" ? C.blue : C.muted }}>Schedule</div>
          {tab === "schedule" && <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />}
        </button>
        <button onClick={onBuildEstimate} style={{ flex: 1, background: "none", border: "none", padding: "6px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>📝</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Estimate</div>
        </button>
        <button onClick={() => setTab("risks")} style={{ flex: 1, background: "none", border: "none", padding: "12px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20, position: "relative" as const }}>
            ⚠️
            {result.risk_flags.length > 0 && <span style={{ position: "absolute" as const, top: -4, right: -8, fontSize: 9, fontWeight: 700, background: C.red, color: "#fff", width: 14, height: 14, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{result.risk_flags.length}</span>}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: tab === "risks" ? C.blue : C.muted }}>Risks</div>
          {tab === "risks" && <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />}
        </button>
      </div>
    </div>
  );
}

// ─── Estimate Editor Screen ─────────────────────
function EstimateEditor({ result, fileName, onBack, onReset }: {
  result: DetectionResult; fileName: string; onBack: () => void; onReset: () => void;
}) {
  const [items, setItems] = useState<LineItem[]>(() => toLineItems(result.components));
  const [margin, setMargin] = useState(15);
  const [locked, setLocked] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [estNumber] = useState(() => `EST-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}-001`);
  const [activeEdit, setActiveEdit] = useState<string | null>(null);

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const marginAmount = subtotal * (margin / 100);
  const subtotalWithMargin = subtotal + marginAmount;
  const gst = subtotalWithMargin * 0.1;
  const total = subtotalWithMargin + gst;

  const updateQty = (id: string, qty: number) => {
    if (locked) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, qty), lineTotal: Math.max(0, qty) * i.unitPrice } : i));
  };

  const updatePrice = (id: string, price: number) => {
    if (locked) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, unitPrice: price, lineTotal: i.qty * price } : i));
  };

  const deleteItem = (id: string) => {
    if (locked) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addItem = () => {
    if (locked) return;
    const newItem: LineItem = {
      id: `manual-${Date.now()}`,
      description: "New item",
      room: "General",
      qty: 1,
      unitPrice: 0,
      lineTotal: 0,
      locked: false,
      fromDetection: false,
    };
    setItems(prev => [...prev, newItem]);
    setActiveEdit(newItem.id);
  };

  const exportEstimate = () => {
    const lines = [
      `ELECTRICAL ESTIMATE`,
      `${estNumber}`,
      ``,
      `Vesh Electrical Services Pty Ltd`,
      `7/108 Old Pittwater Road, Brookvale NSW 2100`,
      `ABN: XX XXX XXX XXX | Electrical Licence: XXXXXXXXX`,
      ``,
      `Date: ${new Date().toLocaleDateString("en-AU")}`,
      `Drawing: ${fileName}`,
      `Scale: ${result.scale_detected}`,
      ``,
      `─────────────────────────────────────────────`,
      `ITEM                                QTY    RATE      TOTAL`,
      `─────────────────────────────────────────────`,
      ...items.map(i => `${i.description.padEnd(36)} ${String(i.qty).padStart(3)}  $${String(i.unitPrice).padStart(7)}  $${String(i.qty * i.unitPrice).padStart(8)}`),
      `─────────────────────────────────────────────`,
      ``,
      `Subtotal (ex GST):        ${fmt(subtotal).padStart(12)}`,
      `Margin (${margin}%):            ${fmt(marginAmount).padStart(12)}`,
      `Subtotal with margin:     ${fmt(subtotalWithMargin).padStart(12)}`,
      `GST (10%):                ${fmt(gst).padStart(12)}`,
      `TOTAL INC GST:            ${fmt(total).padStart(12)}`,
      ``,
      `─────────────────────────────────────────────`,
      `This estimate is valid for 30 days from the date above.`,
      `All prices exclude any variations or additional works.`,
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines], { type: "text/plain" }));
    a.download = `${estNumber}.txt`;
    a.click();
  };

  const handleLock = () => {
    setLocked(true);
    setShowLockConfirm(false);
  };

  const MARGINS = [10, 15, 20, 25];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", paddingBottom: 90 }}>

      {/* Lock confirm modal */}
      {showLockConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.navy, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, maxWidth: 380, width: "100%" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>Lock estimate?</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 6 }}>
              This will lock <strong style={{ color: C.text }}>{estNumber}</strong> for <strong style={{ color: C.green }}>{fmt(total)}</strong> inc GST.
            </div>
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 20 }}>Once locked, line items cannot be edited. Export a copy before locking.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLockConfirm(false)} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 14, padding: "12px", borderRadius: 10, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleLock} style={{ flex: 1, background: C.green, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px", borderRadius: 10, cursor: "pointer" }}>Lock & Finalise</button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
          {locked ? (
            <div style={{ fontSize: 11, fontWeight: 700, background: `${C.green}22`, color: C.green, padding: "4px 10px", borderRadius: 20, border: `1px solid ${C.green}` }}>🔒 LOCKED</div>
          ) : (
            <div style={{ fontSize: 11, color: C.muted }}>Draft</div>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{estNumber}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>{fileName} · {new Date().toLocaleDateString("en-AU")}</div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{fmtK(total)}</div>
            <div style={{ fontSize: 10, color: C.muted }}>inc GST</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{items.length}</div>
            <div style={{ fontSize: 10, color: C.muted }}>line items</div>
          </div>
          <div style={{ background: C.card, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{margin}%</div>
            <div style={{ fontSize: 10, color: C.muted }}>margin</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "16px 16px 0" }}>

        {/* Margin selector */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>Margin / Markup</div>
          <div style={{ display: "flex", gap: 8 }}>
            {MARGINS.map(m => (
              <button key={m} onClick={() => !locked && setMargin(m)} style={{
                flex: 1, padding: "10px 0", border: `1.5px solid ${margin === m ? C.blue : C.border}`,
                background: margin === m ? `${C.blue}22` : "transparent", color: margin === m ? C.blue : C.muted,
                borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: locked ? "default" : "pointer",
              }}>{m}%</button>
            ))}
          </div>
        </div>

        {/* Line items */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Line Items</div>
            {!locked && (
              <button onClick={addItem} style={{ background: `${C.blue}22`, border: `1px solid ${C.blue}`, color: C.blue, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}>+ Add</button>
            )}
          </div>
          {items.map((item, i) => (
            <div key={item.id} style={{ padding: "12px 16px", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 1 }}>{item.description}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{item.room}</div>
                </div>
                {!locked && (
                  <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 16, cursor: "pointer", padding: 4, lineHeight: 1 }}>×</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Qty */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  {!locked && <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, padding: "6px 10px", cursor: "pointer" }}>−</button>}
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text, padding: "6px 10px", minWidth: 32, textAlign: "center" as const }}>{item.qty}</span>
                  {!locked && <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, padding: "6px 10px", cursor: "pointer" }}>+</button>}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>×</div>
                {/* Unit price */}
                <div style={{ display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", flex: 1 }}>
                  <span style={{ color: C.muted, fontSize: 13, marginRight: 3 }}>$</span>
                  <input
                    type="number"
                    value={item.unitPrice}
                    disabled={locked}
                    onChange={e => updatePrice(item.id, Number(e.target.value))}
                    style={{ background: "none", border: "none", color: C.text, fontSize: 14, fontWeight: 600, width: "100%", outline: "none" }}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 70, textAlign: "right" as const }}>{fmt(item.qty * item.unitPrice)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals breakdown */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
          {[
            ["Subtotal ex GST", fmt(subtotal), C.text],
            [`Margin (${margin}%)`, `+ ${fmt(marginAmount)}`, C.amber],
            ["Subtotal with margin", fmt(subtotalWithMargin), C.text],
            ["GST (10%)", fmt(gst), C.muted],
          ].map(([label, value, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: C.border, margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Total inc GST</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.green }}>{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: C.navy, borderTop: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", gap: 10 }}>
        <button onClick={exportEstimate} style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontWeight: 600, padding: "13px", borderRadius: 12, cursor: "pointer" }}>
          Export
        </button>
        {!locked ? (
          <button onClick={() => setShowLockConfirm(true)} style={{ flex: 2, background: C.green, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, padding: "13px", borderRadius: 12, cursor: "pointer" }}>
            🔒 Lock & Finalise
          </button>
        ) : (
          <button onClick={exportEstimate} style={{ flex: 2, background: C.blue, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, padding: "13px", borderRadius: 12, cursor: "pointer" }}>
            📤 Export PDF Quote
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Root App ───────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f); setError(null); setScreen("scanning");
    try {
      const d = await detectElectricalComponents(f, "001");
      setResult(d); setScreen("results");
    } catch (err: any) {
      setError(err?.message ?? "Detection failed."); setScreen("upload");
    }
  };

  const reset = () => { setScreen("upload"); setFile(null); setResult(null); setError(null); };

  return (
    <>
      <style>{CSS}</style>
      {screen === "upload" && <UploadScreen onFile={handleFile} error={error} />}
      {screen === "scanning" && file && <ScanningScreen fileName={file.name} />}
      {screen === "results" && result && file && (
        <ResultsScreen result={result} fileName={file.name} onReset={reset}
          onBuildEstimate={() => setScreen("estimate")} />
      )}
      {screen === "estimate" && result && file && (
        <EstimateEditor result={result} fileName={file.name}
          onBack={() => setScreen("results")} onReset={reset} />
      )}
    </>
  );
}
