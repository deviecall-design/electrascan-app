import { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard, Scan, FileText, BookOpen, Settings,
  Search, Bell, Plus, ArrowUpRight, ArrowDownRight, ArrowLeft, ArrowRight,
  Zap, MoreHorizontal, CheckCircle2, Eye, Send, FileEdit, Sparkles,
  Upload, FileCheck2, Wand2, FileDown, Pencil,
  ChevronRight, Loader2, Check,
  AlertCircle, Keyboard, Bot, Copy
} from 'lucide-react';
import { detectElectricalComponents } from '../../analyze_pdf';
import { fetchPriceMap, seedRateLibraryFromVeshCatalogue } from '../../services/rateLibraryService';
import { fetchEstimates } from '../../services/estimateService';

const C = {
  bg: '#faf9f5', bgSoft: '#f4f2ea', bgCard: '#ffffff', bgPaper: '#fcfbf7',
  border: '#e8e6dc', borderSoft: '#efede4',
  text: '#141413', textMuted: '#6b6a63', textSubtle: '#8a887f',
  orange: '#d97757', orangeDark: '#c46a4b', orangeSoft: '#f5e4da',
  blue: '#6a9bcc', blueSoft: '#e2ecf5',
  green: '#788c5d', greenSoft: '#e4ead9',
  amber: '#c89450', amberSoft: '#f3e6cf',
};
const fontHeading = "'Poppins', Arial, sans-serif";
const fontBody    = "'Lora', Georgia, serif";
const fontMono    = "'JetBrains Mono', ui-monospace, monospace";

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`;

const RATE_LIBRARY = [
  { code: 'GPO-001', category: 'Power',    description: 'Double GPO install (flush)',       unit: 'ea',  rate: 85,   labour: 45  },
  { code: 'GPO-002', category: 'Power',    description: 'Double GPO with USB-C',            unit: 'ea',  rate: 125,  labour: 45  },
  { code: 'GPO-003', category: 'Power',    description: 'Weatherproof GPO IP56',            unit: 'ea',  rate: 145,  labour: 60  },
  { code: 'GPO-004', category: 'Power',    description: 'Single GPO install',               unit: 'ea',  rate: 65,   labour: 35  },
  { code: 'GPO-005', category: 'Power',    description: '3-phase outlet 32A',               unit: 'ea',  rate: 320,  labour: 120 },
  { code: 'LT-001',  category: 'Lighting', description: 'LED downlight 10W dimmable',       unit: 'ea',  rate: 65,   labour: 40  },
  { code: 'LT-002',  category: 'Lighting', description: 'LED downlight 13W tri-colour',     unit: 'ea',  rate: 85,   labour: 40  },
  { code: 'LT-003',  category: 'Lighting', description: 'Oyster light LED 18W',             unit: 'ea',  rate: 95,   labour: 35  },
  { code: 'LT-004',  category: 'Lighting', description: 'LED strip 5m (incl. driver)',      unit: 'set', rate: 180,  labour: 90  },
  { code: 'LT-005',  category: 'Lighting', description: 'Pendant rough-in',                 unit: 'ea',  rate: 120,  labour: 55  },
  { code: 'SW-001',  category: 'Switches', description: 'Single switch 1-gang',             unit: 'ea',  rate: 45,   labour: 25  },
  { code: 'SW-002',  category: 'Switches', description: '2-way switch 1-gang',              unit: 'ea',  rate: 55,   labour: 30  },
  { code: 'SW-003',  category: 'Switches', description: 'Dimmer switch LED-compatible',     unit: 'ea',  rate: 95,   labour: 35  },
  { code: 'SW-004',  category: 'Switches', description: '4-gang switch plate',              unit: 'ea',  rate: 110,  labour: 40  },
  { code: 'CB-001',  category: 'Cabling',  description: 'TPS 2.5mm\u00b2 per metre',        unit: 'm',   rate: 8,    labour: 4   },
  { code: 'CB-002',  category: 'Cabling',  description: 'TPS 4mm\u00b2 per metre',          unit: 'm',   rate: 12,   labour: 5   },
  { code: 'CB-003',  category: 'Cabling',  description: 'TPS 6mm\u00b2 per metre',          unit: 'm',   rate: 18,   labour: 6   },
  { code: 'CB-004',  category: 'Cabling',  description: 'Cat6A data cable per metre',       unit: 'm',   rate: 6,    labour: 3   },
  { code: 'CB-005',  category: 'Cabling',  description: 'Conduit 20mm orange per metre',    unit: 'm',   rate: 4,    labour: 3   },
  { code: 'SB-001',  category: 'Boards',   description: 'Meter box upgrade to 100A',        unit: 'ea',  rate: 1450, labour: 480 },
  { code: 'SB-002',  category: 'Boards',   description: 'Distribution board 12-way',        unit: 'ea',  rate: 680,  labour: 320 },
  { code: 'SB-003',  category: 'Boards',   description: 'RCBO install per pole',            unit: 'ea',  rate: 145,  labour: 45  },
  { code: 'SB-004',  category: 'Boards',   description: 'Main switch 63A',                  unit: 'ea',  rate: 220,  labour: 85  },
  { code: 'SA-001',  category: 'Safety',   description: 'Smoke alarm 240V interconnect',    unit: 'ea',  rate: 140,  labour: 50  },
  { code: 'SA-002',  category: 'Safety',   description: 'RCD safety switch install',        unit: 'ea',  rate: 180,  labour: 60  },
  { code: 'SA-003',  category: 'Safety',   description: 'Emergency exit light LED',         unit: 'ea',  rate: 220,  labour: 85  },
  { code: 'DC-001',  category: 'Data',     description: 'Cat6A data point + faceplate',     unit: 'ea',  rate: 135,  labour: 55  },
  { code: 'DC-002',  category: 'Data',     description: 'TV point + coax run',              unit: 'ea',  rate: 110,  labour: 45  },
  { code: 'DC-003',  category: 'Data',     description: 'Patch panel 24-port install',      unit: 'ea',  rate: 280,  labour: 120 },
  { code: 'FN-001',  category: 'Fans',     description: 'Bathroom exhaust fan + duct',      unit: 'ea',  rate: 185,  labour: 75  },
  { code: 'FN-002',  category: 'Fans',     description: 'Ceiling fan rough-in',             unit: 'ea',  rate: 145,  labour: 55  },
  { code: 'EX-001',  category: 'Ext.',     description: 'External sensor light LED',        unit: 'ea',  rate: 155,  labour: 65  },
  { code: 'EX-003',  category: 'Ext.',     description: 'EV charger 7kW single-phase',      unit: 'ea',  rate: 1850, labour: 380 },
  { code: 'TS-001',  category: 'Testing',  description: 'Pre-handover test & tag',          unit: 'hr',  rate: 125,  labour: 125 },
  { code: 'TS-002',  category: 'Testing',  description: 'Compliance certificate',           unit: 'ea',  rate: 280,  labour: 0   },
];

const DETECTED_ITEMS = [
  { id: 1,  symbol: 'GPO', qty: 14, desc: 'Double power outlet',        rate: 'GPO-001', conf: 0.98, x: 120, y: 140 },
  { id: 2,  symbol: 'GPO', qty: 2,  desc: 'Weatherproof GPO (balcony)', rate: 'GPO-003', conf: 0.94, x: 380, y: 90  },
  { id: 3,  symbol: 'LT',  qty: 22, desc: 'LED downlight',              rate: 'LT-001',  conf: 0.96, x: 210, y: 210 },
  { id: 4,  symbol: 'SW',  qty: 9,  desc: '2-way light switch',         rate: 'SW-002',  conf: 0.91, x: 85,  y: 280 },
  { id: 5,  symbol: 'SW',  qty: 3,  desc: 'Dimmer switch',              rate: 'SW-003',  conf: 0.72, x: 340, y: 260 },
  { id: 6,  symbol: 'DB',  qty: 1,  desc: '12-way distribution board',  rate: 'SB-002',  conf: 0.99, x: 60,  y: 70  },
  { id: 7,  symbol: 'SA',  qty: 5,  desc: 'Smoke alarm',                rate: 'SA-001',  conf: 0.95, x: 290, y: 180 },
  { id: 8,  symbol: 'FN',  qty: 3,  desc: 'Bathroom exhaust fan',       rate: 'FN-001',  conf: 0.88, x: 440, y: 220 },
  { id: 9,  symbol: 'DC',  qty: 6,  desc: 'Cat6A data point',           rate: 'DC-001',  conf: 0.93, x: 180, y: 320 },
  { id: 10, symbol: 'LT',  qty: 2,  desc: 'Pendant light (kitchen)',    rate: 'LT-005',  conf: 0.65, x: 240, y: 120 },
];

// Group real DetectedComponent.type values into the 3-letter symbol codes
// the mockup floor plan uses for badges.
const TYPE_TO_SYMBOL = {
  GPO_STANDARD: 'GPO', GPO_DOUBLE: 'GPO', GPO_WEATHERPROOF: 'GPO', GPO_USB: 'GPO',
  DOWNLIGHT_RECESSED: 'LT', PENDANT_FEATURE: 'LT',
  EXHAUST_FAN: 'FN',
  SWITCHING_STANDARD: 'SW', SWITCHING_DIMMER: 'SW', SWITCHING_2WAY: 'SW',
  SWITCHBOARD_MAIN: 'DB', SWITCHBOARD_SUB: 'DB',
  AC_SPLIT: 'AC', AC_DUCTED: 'AC',
  DATA_CAT6: 'DC', DATA_TV: 'DC',
  SECURITY_CCTV: 'SE', SECURITY_INTERCOM: 'SE', SECURITY_ALARM: 'SA',
  EV_CHARGER: 'EV', POOL_OUTDOOR: 'EX', GATE_ACCESS: 'EX',
  AUTOMATION_HUB: 'AU',
};

const TYPE_LABELS = {
  GPO_STANDARD: 'Power Point', GPO_DOUBLE: 'Double Power Point',
  GPO_WEATHERPROOF: 'Weatherproof GPO', GPO_USB: 'USB Power Point',
  DOWNLIGHT_RECESSED: 'Downlight', PENDANT_FEATURE: 'Pendant Light',
  EXHAUST_FAN: 'Exhaust Fan',
  SWITCHING_STANDARD: 'Light Switch', SWITCHING_DIMMER: 'Dimmer Switch', SWITCHING_2WAY: '2-Way Switch',
  SWITCHBOARD_MAIN: 'Main Switchboard', SWITCHBOARD_SUB: 'Sub Board',
  AC_SPLIT: 'Split System AC', AC_DUCTED: 'Ducted AC',
  DATA_CAT6: 'Data Point', DATA_TV: 'TV/Data Point',
  SECURITY_CCTV: 'CCTV Camera', SECURITY_INTERCOM: 'Intercom', SECURITY_ALARM: 'Alarm Sensor',
  EV_CHARGER: 'EV Charger', POOL_OUTDOOR: 'Pool Equipment', GATE_ACCESS: 'Gate/Access',
  AUTOMATION_HUB: 'Home Automation',
};

// Spread N items deterministically across the floor plan rectangle so the
// badges don't overlap. Floor plan viewBox is 520x380 with the room rect
// at (30,40)-(490,350).
function gridPosition(index, total) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total * 1.4)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = 60 + (col + 0.5) * (400 / cols);
  const y = 70 + (row + 0.5) * (260 / rows);
  return { x: Math.round(x), y: Math.round(y) };
}

// Shared loader for estimates rows from Supabase. Both the dashboard
// "Recent estimates" section and the dedicated Estimates view consume
// this. Each call hits the DB once on mount; the dataset is small and
// scoped to the signed-in user via RLS so re-renders are cheap.
function useEstimates() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchEstimates().then((r) => {
      if (!mounted) return;
      if (r.ok) setItems(r.estimates);
      else setError(r.error);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  return { items, loading, error };
}

// Convert a DetectionResult from analyze_pdf.ts into the item shape the
// mockup's StepDetecting / StepReview / StepQuote already render.
function mapDetectionToItems(result) {
  if (!result?.components?.length) return null;
  return result.components.map((c, i) => {
    const pos = gridPosition(i, result.components.length);
    return {
      id: i + 1,
      symbol: TYPE_TO_SYMBOL[c.type] ?? 'EL',
      qty: c.quantity,
      desc: c.catalogue_item_name || TYPE_LABELS[c.type] || c.type,
      rate: `CV-${c.type}`,
      conf: Math.max(0, Math.min(1, (c.confidence ?? 0) / 100)),
      x: pos.x,
      y: pos.y,
      unitPrice: c.unit_price ?? 0,
      lineTotal: c.line_total ?? 0,
      room: c.room,
      flags: c.flags ?? [],
    };
  });
}

export default function App() {
  const [route, setRoute] = useState('dashboard');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div style={{ backgroundColor: C.bg, backgroundImage: GRAIN, color: C.text, fontFamily: fontBody, minHeight: '100vh', fontSize: 15, lineHeight: 1.55, position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; padding: 0; }
        table { border-collapse: collapse; }
        input, textarea { font-family: inherit; outline: none; border: none; background: none; color: inherit; }
        .es-row:hover { background-color: ${C.bgSoft}; }
        .es-nav:hover { background-color: ${C.borderSoft}; }
        .es-link:hover { color: ${C.orangeDark}; }
        .es-btn-primary:hover { background-color: ${C.orangeDark} !important; }
        .es-btn-ghost:hover { background-color: ${C.bgSoft}; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dot { 0%, 20% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .anim-in { animation: fadeInUp 450ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      <div style={{ display: 'flex' }}>
        <Sidebar route={route} go={setRoute} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <TopBar onCommand={() => setPaletteOpen(true)} go={setRoute} />
          <div style={{ padding: '36px 32px', maxWidth: 1400 }}>
            {route === 'dashboard' && <DashboardView go={setRoute} />}
            {route === 'scans'     && <ScansView go={setRoute} />}
            {route === 'scan'      && <ScanDetailView go={setRoute} />}
            {route === 'estimates' && <EstimatesView />}
            {route === 'rates'     && <RateLibraryView />}
            {route === 'settings'  && <StubView title="Settings" />}
            <Footer />
          </div>
        </main>
      </div>

      {paletteOpen && <CommandPalette close={() => setPaletteOpen(false)} go={(r) => { setRoute(r); setPaletteOpen(false); }} />}
    </div>
  );
}

function Sidebar({ route, go }) {
  return (
    <aside style={{ width: 240, minHeight: '100vh', borderRight: `1px solid ${C.border}`, backgroundColor: C.bgSoft, padding: '24px 20px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px', marginBottom: 36 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={16} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' }}>ElectraScan</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" active={route === 'dashboard'} onClick={() => go('dashboard')} />
        <NavItem icon={<Scan size={16} />}            label="Scans" badge="3" active={route === 'scans' || route === 'scan'} onClick={() => go('scans')} />
        <NavItem icon={<FileText size={16} />}        label="Estimates" active={route === 'estimates'} onClick={() => go('estimates')} />
        <NavItem icon={<BookOpen size={16} />}        label="Rate library" active={route === 'rates'} onClick={() => go('rates')} />
        <NavItem icon={<Settings size={16} />}        label="Settings" active={route === 'settings'} onClick={() => go('settings')} />
      </nav>

      <div style={{ marginTop: 28, padding: 14, border: `1px solid ${C.border}`, borderRadius: 10, backgroundColor: C.bgCard }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Sparkles size={13} color={C.orange} />
          <span style={{ fontFamily: fontHeading, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted }}>Vision credits</span>
        </div>
        <div style={{ fontFamily: fontHeading, fontSize: 20, fontWeight: 600 }}>847 <span style={{ color: C.textSubtle, fontWeight: 400, fontSize: 13 }}>/ 1,000</span></div>
        <div style={{ height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: '84.7%', height: '100%', backgroundColor: C.orange }} />
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8, fontStyle: 'italic' }}>Resets 1 May</div>
      </div>

      <div style={{ marginTop: 'auto', borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: C.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontHeading, fontWeight: 500, fontSize: 13 }}>DC</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 500 }}>Damien C.</div>
            <div style={{ fontSize: 12, color: C.textSubtle }}>Vesh Electrical</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, badge, active, onClick }) {
  return (
    <button className="es-nav" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, fontFamily: fontHeading, fontSize: 14, fontWeight: active ? 500 : 400, color: active ? C.text : C.textMuted, backgroundColor: active ? C.borderSoft : 'transparent', textAlign: 'left', width: '100%', transition: 'background-color 120ms, color 120ms' }}>
      <span style={{ color: active ? C.orange : C.textSubtle, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={{ fontSize: 11, fontFamily: fontHeading, fontWeight: 500, padding: '2px 7px', borderRadius: 10, backgroundColor: C.orangeSoft, color: C.orangeDark }}>{badge}</span>}
    </button>
  );
}

function TopBar({ onCommand, go }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
      <button onClick={onCommand} style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSubtle, fontSize: 14, fontStyle: 'italic', padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 8, backgroundColor: C.bgCard, width: 380, textAlign: 'left' }}>
        <Search size={15} />
        <span>Search estimates, scans, rates…</span>
        <span style={{ marginLeft: 'auto', fontFamily: fontHeading, fontSize: 11, color: C.textSubtle, padding: '2px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontStyle: 'normal' }}>⌘K</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, backgroundColor: C.greenSoft, color: C.green, fontFamily: fontHeading, fontSize: 12, fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.green }} className="pulse" />
          Aries online
        </div>
        <button className="es-btn-ghost" style={{ position: 'relative', padding: 8, borderRadius: 6 }}>
          <Bell size={16} />
          <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', backgroundColor: C.orange }} />
        </button>
        <button className="es-btn-primary" onClick={() => go('scan')} style={{ fontFamily: fontHeading, fontSize: 14, fontWeight: 500, backgroundColor: C.orange, color: '#fff', padding: '9px 16px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 7, transition: 'background-color 150ms' }}>
          <Plus size={15} strokeWidth={2.5} /> New scan
        </button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ marginTop: 48, paddingTop: 18, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', color: C.textSubtle, fontSize: 13 }}>
      <span style={{ fontStyle: 'italic' }}>Groundplan measures your plans. ElectraScan reads them — and writes your quote.</span>
      <span style={{ fontFamily: fontMono, fontSize: 12 }}>v0.4.2 · Sydney</span>
    </div>
  );
}

function DashboardView({ go }) {
  const { items: estimateRows, loading: estimatesLoading, error: estimatesError } = useEstimates();
  const recentEstimates = estimateRows.slice(0, 6);

  return (
    <div className="anim-in">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: fontHeading, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px 0', lineHeight: 1.15 }}>Good morning, Damien.</h1>
        <p style={{ color: C.textMuted, fontStyle: 'italic', margin: 0, fontSize: 16 }}>
          You have <B>3 scans</B> in queue and <B>$48,290</B> in pending estimates.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <Kpi label="Estimates this month" value="24" delta="+8" sub="vs April" up />
        <Kpi label="Pending value" value="$48,290" delta="+12%" sub="vs last week" up />
        <Kpi label="Win rate" value="68%" delta="+4%" sub="30-day rolling" up />
        <Kpi label="Avg scan-to-quote" value="7m 12s" delta="−2m" sub="vs April" up />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 24 }}>
        <section>
          <SectionHead title="Active scans" cta="View all" onCta={() => go('scans')} />
          <Card>
            <ScanRow file="Switchboard_LV2_rev3.pdf"  client="Bondi Tower Residences"   progress={72} stage="Enriching rates"  onClick={() => go('scan')} />
            <ScanRow file="Warehouse_ground_floor.pdf" client="Parramatta Logistics Hub" progress={34} stage="Detecting symbols" divider onClick={() => go('scan')} />
            <ScanRow file="Office_fitout_L8.pdf"       client="Martin Place Partners"    progress={96} stage="Finalising"        divider onClick={() => go('scan')} />
          </Card>

          <div style={{ marginTop: 20, padding: 18, backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={14} color={C.orange} />
              <span style={{ fontFamily: fontHeading, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted }}>Aries insight</span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>
              Your GPO rates are <B>14% below</B> regional average. Reviewing the top 5 could add <span style={{ color: C.green, fontStyle: 'italic' }}>~$3,200</span> to April's pipeline.
            </p>
            <button className="es-link" onClick={() => go('rates')} style={{ marginTop: 10, fontSize: 13, color: C.orange, fontFamily: fontHeading, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Open rate library <ArrowUpRight size={13} />
            </button>
          </div>
        </section>

        <section>
          <SectionHead title="Recent estimates" cta="Open estimates" onCta={() => go('estimates')} />
          <Card>
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
                  <Th>Ref</Th><Th>Client</Th><Th align="right">Value</Th>
                  <Th>Status</Th><Th align="right">Sent</Th><Th width={32}></Th>
                </tr>
              </thead>
              <tbody>
                {!estimatesLoading && recentEstimates.map((e) => (
                  <EstRow key={e.id} r={e.reference} client={e.client} value={e.value} status={e.status} days={e.daysAgo} />
                ))}
              </tbody>
            </table>
            {estimatesLoading && (
              <div style={{ padding: 20, textAlign: 'center', color: C.textSubtle, fontStyle: 'italic', fontSize: 13 }}>
                Loading estimates…
              </div>
            )}
            {!estimatesLoading && estimatesError && (
              <div style={{ padding: 20, textAlign: 'center', color: '#b64545', fontSize: 13 }}>
                Couldn't load estimates: {estimatesError}
              </div>
            )}
            {!estimatesLoading && !estimatesError && recentEstimates.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: C.textSubtle, fontStyle: 'italic', fontSize: 13 }}>
                No estimates yet.
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function ScansView({ go }) {
  const scans = [
    { f: 'Switchboard_LV2_rev3.pdf',   c: 'Bondi Tower Residences',   s: 'Enriching rates',   n: 62, p: 72,  t: '14m ago' },
    { f: 'Warehouse_ground_floor.pdf', c: 'Parramatta Logistics Hub', s: 'Detecting symbols', n: 18, p: 34,  t: '32m ago' },
    { f: 'Office_fitout_L8.pdf',       c: 'Martin Place Partners',    s: 'Finalising',        n: 47, p: 96,  t: '1h ago'  },
    { f: 'Shopfit_Chatswood.pdf',      c: 'Chatswood Dental Group',   s: 'Complete',          n: 28, p: 100, t: '3h ago'  },
    { f: 'Mezzanine_rev2.pdf',         c: 'Northern Beaches Council', s: 'Complete',          n: 94, p: 100, t: 'Yesterday' },
  ];
  return (
    <div className="anim-in">
      <PageHeader title="Scans" sub="Upload a floor plan and let Claude turn it into a costed estimate." cta={<PrimaryButton onClick={() => go('scan')} icon={<Plus size={15} strokeWidth={2.5} />}>New scan</PrimaryButton>} />
      <Card>
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>File</Th><Th>Client</Th><Th>Stage</Th>
              <Th align="right">Items</Th><Th>Progress</Th><Th align="right">Started</Th>
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s.f} className="es-row" onClick={() => go('scan')} style={{ borderTop: `1px solid ${C.border}`, transition: 'background-color 120ms', cursor: 'pointer' }}>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileCheck2 size={16} color={s.p === 100 ? C.green : C.orange} />
                    <span style={{ fontFamily: fontHeading, fontSize: 14, fontWeight: 500 }}>{s.f}</span>
                  </div>
                </Td>
                <Td>{s.c}</Td>
                <Td><span style={{ fontFamily: fontHeading, fontSize: 13, color: C.textMuted }}>{s.s}</span></Td>
                <Td align="right" mono><span style={{ fontWeight: 500 }}>{s.n}</span></Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 160 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' }}>
                      <div style={{ width: `${s.p}%`, height: '100%', backgroundColor: s.p === 100 ? C.green : C.orange }} />
                    </div>
                    <span style={{ fontFamily: fontMono, fontSize: 12, color: C.textMuted, width: 34 }}>{s.p}%</span>
                  </div>
                </Td>
                <Td align="right" muted><span style={{ fontStyle: 'italic', fontSize: 13 }}>{s.t}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ScanDetailView({ go }) {
  const [step, setStep] = useState(2);
  const [revealed, setRevealed] = useState(0);
  const [detection, setDetection] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Real detection items if available, otherwise the mockup demo set so the
  // wizard still renders something for design QA without an API key.
  const items = useMemo(
    () => mapDetectionToItems(detection) ?? DETECTED_ITEMS,
    [detection],
  );

  useEffect(() => {
    if (step !== 2) return;
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed((n) => {
        if (n >= items.length) { clearInterval(id); return n; }
        return n + 1;
      });
    }, 380);
    return () => clearInterval(id);
  }, [step, items]);

  const allDetected = revealed >= items.length;

  return (
    <div className="anim-in">
      <button onClick={() => go('scans')} className="es-link" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMuted, fontFamily: fontHeading, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to scans
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ fontFamily: fontHeading, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
          {uploadedFile?.name ?? 'Switchboard_LV2_rev3.pdf'}
        </h1>
        <span style={{ fontFamily: fontMono, fontSize: 13, color: C.textSubtle }}>EST-2026-0143</span>
      </div>
      <p style={{ color: C.textMuted, fontStyle: 'italic', margin: '0 0 28px 0' }}>Bondi Tower Residences · Level 2 · uploaded 14 minutes ago</p>

      <StepBar step={step} onStep={setStep} />

      {step === 1 && (
        <StepUpload
          onNext={() => setStep(2)}
          onDetected={(file, result) => { setUploadedFile(file); setDetection(result); }}
        />
      )}
      {step === 2 && <StepDetecting items={items} revealed={revealed} onNext={() => setStep(3)} ready={allDetected} />}
      {step === 3 && <StepReview items={items} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <StepQuote items={items} onBack={() => setStep(3)} />}
    </div>
  );
}

function StepBar({ step, onStep }) {
  const steps = [
    { n: 1, label: 'Upload', icon: <Upload size={14} /> },
    { n: 2, label: 'Detect', icon: <Wand2 size={14} /> },
    { n: 3, label: 'Review', icon: <FileEdit size={14} /> },
    { n: 4, label: 'Quote',  icon: <FileDown size={14} /> },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, marginBottom: 24, gap: 4 }}>
      {steps.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <button key={s.n} onClick={() => onStep(s.n)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', borderRadius: 7, backgroundColor: active ? C.orange : 'transparent', color: active ? '#fff' : (done ? C.text : C.textSubtle), fontFamily: fontHeading, fontSize: 13, fontWeight: 500, transition: 'background-color 180ms' }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: active ? 'rgba(255,255,255,0.22)' : (done ? C.green : C.borderSoft), color: active ? '#fff' : (done ? '#fff' : C.textSubtle), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
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

function StepUpload({ onNext, onDetected }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const runDetection = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.');
      return;
    }
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      let priceMap = await fetchPriceMap();
      if (priceMap.size === 0) {
        const seed = await seedRateLibraryFromVeshCatalogue();
        if (seed.ok) {
          console.log(`[Detection] Seeded rate_library with ${seed.inserted} catalogue items`);
          priceMap = await fetchPriceMap();
        } else {
          console.warn('[Detection] Auto-seed failed:', seed.error);
        }
      }
      const result = await detectElectricalComponents(file, '001', undefined, priceMap);
      onDetected?.(file, result);
      onNext();
    } catch (err) {
      setError(err?.message || 'Detection failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    runDetection(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      className="anim-in"
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      style={{
        backgroundColor: dragOver ? C.orangeSoft : C.bgCard,
        border: `2px dashed ${dragOver ? C.orange : C.border}`,
        borderRadius: 12, padding: 64,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        textAlign: 'center', transition: 'background-color 150ms, border-color 150ms',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        disabled={busy}
        onChange={(e) => runDetection(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
      <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: C.orangeSoft, color: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <Loader2 size={24} className="spin" /> : <Upload size={24} />}
      </div>
      <h2 style={{ fontFamily: fontHeading, fontSize: 20, fontWeight: 600, margin: 0 }}>
        {busy ? `Analysing ${fileName}…` : 'Drop your floor plan here'}
      </h2>
      <p style={{ color: C.textMuted, fontStyle: 'italic', margin: 0, maxWidth: 460 }}>
        {busy
          ? 'Claude Vision is reading the legend and counting symbols. This usually takes 30–60 seconds.'
          : 'PDF only. Claude Vision will detect symbols, map them to your rate library, and draft a quote.'}
      </p>
      {error && (
        <div style={{ color: '#b64545', fontSize: 13, maxWidth: 460 }}>{error}</div>
      )}
      {!busy && (
        <PrimaryButton onClick={() => inputRef.current?.click()}>Choose PDF</PrimaryButton>
      )}
    </div>
  );
}

function StepDetecting({ items, revealed, onNext, ready }) {
  const visible = items.slice(0, revealed);
  return (
    <div className="anim-in" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
      <div style={{ backgroundColor: C.bgPaper, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={14} color={C.orange} className={ready ? '' : 'pulse'} />
            <span style={{ fontFamily: fontHeading, fontSize: 12, fontWeight: 500, color: C.textMuted }}>
              {ready ? 'Detection complete' : 'Claude Vision analysing'}
              {!ready && <Dots />}
            </span>
          </div>
          <span style={{ fontFamily: fontMono, fontSize: 11, color: C.textSubtle }}>Level 2 · Page 3/5</span>
        </div>
        <FloorPlan items={visible} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontFamily: fontHeading, fontSize: 15, fontWeight: 600, margin: 0 }}>
            Detected items <span style={{ color: C.textSubtle, fontWeight: 400 }}>({revealed}/{items.length})</span>
          </h3>
          {!ready && <Loader2 size={14} className="spin" color={C.orange} />}
        </div>
        <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {visible.map((it, i) => (
            <div key={it.id} className="anim-in" style={{ padding: '12px 16px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <SymbolBadge symbol={it.symbol} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 500 }}>
                  {it.desc} <span style={{ color: C.textSubtle, fontWeight: 400 }}>× {it.qty}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>
                  {it.room ? `${it.room} · ` : ''}matched {it.rate}
                </div>
              </div>
              <ConfPill c={it.conf} />
            </div>
          ))}
          {visible.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.textSubtle, fontStyle: 'italic', fontSize: 13 }}>Waiting for first symbols…</div>
          )}
        </div>

        {ready && (
          <div className="anim-in" style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <PrimaryButton onClick={onNext} icon={<ArrowRight size={15} />}>Review detected items</PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

function StepReview({ items: itemsProp, onNext, onBack }) {
  const [items, setItems] = useState(itemsProp);
  useEffect(() => { setItems(itemsProp); }, [itemsProp]);

  const needsReview = items.filter((i) => i.conf < 0.8).length;
  const toggle = (id) => setItems((arr) => arr.map((i) => i.id === id ? { ...i, _ok: !i._ok } : i));

  return (
    <div className="anim-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
      {needsReview > 0 && (
        <div style={{ backgroundColor: C.amberSoft, border: `1px solid #e6d2aa`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} color={C.amber} />
          <span style={{ fontSize: 14 }}><B>{needsReview} items</B> below 80% confidence — quick review recommended before rate matching.</span>
        </div>
      )}

      <Card>
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th width={48}></Th><Th>Symbol</Th><Th>Description</Th><Th>Matched rate</Th>
              <Th align="right">Qty</Th><Th align="right">Unit rate</Th><Th align="right">Line total</Th><Th>Confidence</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              // Real detection items carry unitPrice/lineTotal directly. Mock
              // items don't, so fall back to the hardcoded rate library lookup.
              const libRate = RATE_LIBRARY.find((r) => r.code === it.rate);
              const unit = it.unitPrice ?? (libRate ? libRate.rate + libRate.labour : 0);
              const total = it.lineTotal ?? unit * it.qty;
              const rateLabel = libRate?.description ?? (it.room ? `${it.room}` : '');
              return (
                <tr key={it.id} className="es-row" style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td>
                    <button onClick={() => toggle(it.id)} style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${it._ok ? C.green : C.border}`, backgroundColor: it._ok ? C.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {it._ok && <Check size={11} color="#fff" strokeWidth={3} />}
                    </button>
                  </Td>
                  <Td><SymbolBadge symbol={it.symbol} small /></Td>
                  <Td>{it.desc}</Td>
                  <Td>
                    <span style={{ fontFamily: fontMono, fontSize: 12, color: C.textMuted }}>{it.rate}</span>
                    {rateLabel && <>
                      <span style={{ color: C.textSubtle, margin: '0 6px' }}>·</span>
                      <span style={{ fontSize: 13 }}>{rateLabel}</span>
                    </>}
                  </Td>
                  <Td align="right" mono>{it.qty}</Td>
                  <Td align="right" mono>${Math.round(unit).toLocaleString()}</Td>
                  <Td align="right" mono><B>${Math.round(total).toLocaleString()}</B></Td>
                  <Td><ConfPill c={it.conf} withBar /></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <GhostButton onClick={onBack} icon={<ArrowLeft size={14} />}>Back to detection</GhostButton>
        <PrimaryButton onClick={onNext} icon={<ArrowRight size={15} />}>Generate quote</PrimaryButton>
      </div>
    </div>
  );
}

function StepQuote({ items, onBack }) {
  const subtotal = useMemo(() => Math.round(items.reduce((sum, it) => {
    if (it.lineTotal != null) return sum + it.lineTotal;
    const r = RATE_LIBRARY.find((x) => x.code === it.rate);
    return sum + (r ? (r.rate + r.labour) * it.qty : 0);
  }, 0)), [items]);
  const margin = Math.round(subtotal * 0.18);
  const gst = Math.round((subtotal + margin) * 0.1);
  const total = subtotal + margin + gst;
  const totalQty = items.reduce((s, it) => s + (it.qty ?? 0), 0);

  const rows = [
    { d: 'Power outlets (GPO + WP)',            t: subtotal * 0.12 },
    { d: 'Lighting (LED downlights + pendant)', t: subtotal * 0.22 },
    { d: 'Switching & dimming',                 t: subtotal * 0.08 },
    { d: 'Data & comms (Cat6A)',                t: subtotal * 0.09 },
    { d: 'Distribution board (12-way)',         t: subtotal * 0.10 },
    { d: 'Safety & compliance',                 t: subtotal * 0.09 },
    { d: 'Cabling & conduit',                   t: subtotal * 0.30 },
  ];

  return (
    <div className="anim-in" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
      <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: fontHeading, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Preview · page 1 of 3</span>
          <span style={{ fontFamily: fontMono, fontSize: 11, color: C.textSubtle }}>EST-2026-0143.pdf</span>
        </div>
        <div style={{ padding: 40, backgroundColor: C.bgPaper }}>
          <div style={{ backgroundColor: '#fff', padding: 36, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)', minHeight: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 16, borderBottom: `2px solid ${C.text}` }}>
              <div>
                <div style={{ fontFamily: fontHeading, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Vesh Electrical</div>
                <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 2 }}>Licensed electrical contractor · NSW Lic. 284551C</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: fontHeading, fontSize: 11, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Estimate</div>
                <div style={{ fontFamily: fontMono, fontSize: 14, fontWeight: 500 }}>EST-2026-0143</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24, fontSize: 12 }}>
              <div>
                <div style={{ fontFamily: fontHeading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textSubtle, marginBottom: 4 }}>Prepared for</div>
                <div style={{ fontWeight: 500 }}>Bondi Tower Residences</div>
                <div style={{ color: C.textMuted }}>Attn: Marco Petrou</div>
                <div style={{ color: C.textMuted }}>12 Campbell Parade, Bondi Beach</div>
              </div>
              <div>
                <div style={{ fontFamily: fontHeading, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textSubtle, marginBottom: 4 }}>Scope</div>
                <div style={{ fontWeight: 500 }}>Level 2 electrical fit-out</div>
                <div style={{ color: C.textMuted, fontStyle: 'italic' }}>per Switchboard_LV2_rev3.pdf</div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontFamily: fontMono, color: C.textSubtle, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Line items · summary</div>
            {rows.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span>{row.d}</span>
                <span style={{ fontFamily: fontMono }}>${Math.round(row.t).toLocaleString()}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <div style={{ width: 220, fontSize: 12 }}>
                <Row l="Subtotal" v={`$${subtotal.toLocaleString()}`} />
                <Row l="Margin (18%)" v={`$${margin.toLocaleString()}`} />
                <Row l="GST (10%)" v={`$${gst.toLocaleString()}`} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', marginTop: 6, borderTop: `2px solid ${C.text}`, fontFamily: fontHeading, fontWeight: 600, fontSize: 14 }}>
                  <span>Total</span><span>${total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: fontHeading, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textSubtle, marginBottom: 6 }}>Quoted total</div>
          <div style={{ fontFamily: fontHeading, fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>${total.toLocaleString()}</div>
          <div style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 8 }}>incl. GST · {totalQty} items · 18% margin</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <MiniStat label="Materials" v={`$${Math.round(subtotal * 0.55).toLocaleString()}`} />
            <MiniStat label="Labour"    v={`$${Math.round(subtotal * 0.45).toLocaleString()}`} />
            <MiniStat label="Margin"    v={`$${margin.toLocaleString()}`} tint={C.green} />
            <MiniStat label="Scan time" v="6m 48s" />
          </div>
        </div>

        <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={14} color={C.orange} />
            <span style={{ fontFamily: fontHeading, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted }}>Aries suggests</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
            Bondi Tower's last 3 quotes closed at <B>15–22%</B> margin. Your current <B>18%</B> sits in the sweet spot — I wouldn't push it.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryButton icon={<Send size={15} />}>Send to client</PrimaryButton>
          <GhostButton icon={<FileDown size={14} />}>Download PDF</GhostButton>
          <GhostButton icon={<Copy size={14} />}>Duplicate as template</GhostButton>
        </div>

        <GhostButton onClick={onBack} icon={<ArrowLeft size={14} />}>Back to review</GhostButton>
      </div>
    </div>
  );
}

function FloorPlan({ items }) {
  return (
    <svg viewBox="0 0 520 380" style={{ display: 'block', width: '100%', height: 'auto', backgroundColor: C.bgPaper }}>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={C.border} strokeWidth="0.5" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="520" height="380" fill="url(#grid)" />
      <rect x="30" y="40" width="460" height="310" fill="none" stroke={C.text} strokeWidth="2.5" />
      <line x1="30" y1="170" x2="260" y2="170" stroke={C.text} strokeWidth="2" />
      <line x1="260" y1="40"  x2="260" y2="260" stroke={C.text} strokeWidth="2" />
      <line x1="260" y1="260" x2="490" y2="260" stroke={C.text} strokeWidth="2" />
      <line x1="160" y1="170" x2="160" y2="350" stroke={C.text} strokeWidth="2" />
      <line x1="380" y1="40"  x2="380" y2="150" stroke={C.text} strokeWidth="2" />
      <line x1="110" y1="170" x2="140" y2="170" stroke={C.bgPaper} strokeWidth="3" />
      <line x1="260" y1="200" x2="260" y2="230" stroke={C.bgPaper} strokeWidth="3" />
      <line x1="200" y1="260" x2="230" y2="260" stroke={C.bgPaper} strokeWidth="3" />

      {[
        { x: 95,  y: 100, t: 'OFFICE A' },
        { x: 320, y: 150, t: 'BOARDROOM' },
        { x: 95,  y: 260, t: 'WORKSTATIONS' },
        { x: 210, y: 310, t: 'BREAKOUT' },
        { x: 425, y: 310, t: 'KITCHEN' },
      ].map((r, i) => (
        <text key={i} x={r.x} y={r.y} fontFamily={fontHeading} fontSize="8" fill={C.textSubtle} letterSpacing="1.5">{r.t}</text>
      ))}

      {items.map((it) => (
        <g key={it.id} className="anim-in">
          <circle cx={it.x} cy={it.y} r="14" fill={C.orangeSoft} opacity="0.7" />
          <circle cx={it.x} cy={it.y} r="8"  fill={C.orange} />
          <text x={it.x} y={it.y + 2.5} fontFamily={fontHeading} fontSize="7" fontWeight="600" fill="#fff" textAnchor="middle">{it.symbol}</text>
          <circle cx={it.x} cy={it.y} r="14" fill="none" stroke={C.orange} strokeWidth="1" opacity="0.5">
            <animate attributeName="r" from="8" to="22" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      ))}
      <text x="490" y="368" fontFamily={fontMono} fontSize="8" fill={C.textSubtle} textAnchor="end" opacity="0.7">analysed by Claude Vision · 0.4.2</text>
    </svg>
  );
}

function EstimatesView() {
  const { items, loading, error } = useEstimates();

  const drafted   = items.filter((i) => i.status === 'draft').length;
  const sent      = items.filter((i) => i.status === 'sent').length;
  const approved  = items.filter((i) => i.status === 'approved').length;
  const winValue  = items
    .filter((i) => i.status === 'approved')
    .reduce((s, i) => s + i.value, 0);
  const winLabel  = winValue >= 1000
    ? `$${Math.round(winValue / 1000)}k`
    : `$${winValue.toLocaleString()}`;

  return (
    <div className="anim-in">
      <PageHeader title="Estimates" sub="Every quote ElectraScan has drafted for your account." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <MiniStat label="Drafted"   v={loading ? '—' : String(drafted)} />
        <MiniStat label="Sent"      v={loading ? '—' : String(sent)}      tint={C.blue} />
        <MiniStat label="Approved"  v={loading ? '—' : String(approved)}  tint={C.green} />
        <MiniStat label="Win value" v={loading ? '—' : winLabel}          tint={C.green} />
      </div>
      <Card>
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>Ref</Th><Th>Client</Th><Th align="right">Value</Th>
              <Th>Status</Th><Th align="right">Sent</Th><Th width={32}></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((e) => (
              <EstRow key={e.id} r={e.reference} client={e.client} value={e.value} status={e.status} days={e.daysAgo} />
            ))}
          </tbody>
        </table>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: C.textSubtle, fontStyle: 'italic', fontSize: 13 }}>
            Loading estimates…
          </div>
        )}
        {!loading && error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#b64545', fontSize: 13 }}>
            Couldn't load estimates: {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: C.textSubtle, fontStyle: 'italic', fontSize: 13 }}>
            No estimates yet. Run a scan and export to create your first one.
          </div>
        )}
      </Card>
    </div>
  );
}

function RateLibraryView() {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');

  const cats = ['All', ...Array.from(new Set(RATE_LIBRARY.map((r) => r.category)))];
  const filtered = RATE_LIBRARY.filter((r) =>
    (filter === 'All' || r.category === filter) &&
    (query === '' || (r.description + ' ' + r.code).toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="anim-in">
      <PageHeader title="Rate library" sub={`${RATE_LIBRARY.length} items · imported from Vesh Electrical · last synced today`} cta={<PrimaryButton icon={<Plus size={14} />}>Add rate</PrimaryButton>} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${C.border}`, borderRadius: 8, backgroundColor: C.bgCard, padding: '7px 12px', width: 280 }}>
          <Search size={14} color={C.textSubtle} />
          <input placeholder="Search rates…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, fontSize: 13, fontFamily: fontBody, color: C.text, fontStyle: query ? 'normal' : 'italic' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)} style={{ padding: '6px 12px', borderRadius: 16, fontFamily: fontHeading, fontSize: 12, fontWeight: 500, backgroundColor: filter === c ? C.text : 'transparent', color: filter === c ? C.bg : C.textMuted, border: `1px solid ${filter === c ? C.text : C.border}`, transition: 'all 120ms' }}>{c}</button>
          ))}
        </div>
      </div>

      <Card>
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>Code</Th><Th>Description</Th><Th>Category</Th><Th>Unit</Th>
              <Th align="right">Material</Th><Th align="right">Labour</Th><Th align="right">Total</Th>
              <Th width={32}></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.code} className="es-row" style={{ borderTop: `1px solid ${C.border}` }}>
                <Td mono><span style={{ fontWeight: 500, fontSize: 12 }}>{r.code}</span></Td>
                <Td>{r.description}</Td>
                <Td><span style={{ fontFamily: fontHeading, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, backgroundColor: C.borderSoft, color: C.textMuted }}>{r.category}</span></Td>
                <Td muted><span style={{ fontFamily: fontMono, fontSize: 12 }}>{r.unit}</span></Td>
                <Td align="right" mono>${r.rate}</Td>
                <Td align="right" mono>${r.labour}</Td>
                <Td align="right" mono><B>${r.rate + r.labour}</B></Td>
                <Td><button style={{ padding: 4, borderRadius: 4, color: C.textSubtle }}><Pencil size={13} /></button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ marginTop: 12, fontSize: 12, color: C.textSubtle, fontStyle: 'italic', textAlign: 'center' }}>{filtered.length} of {RATE_LIBRARY.length} shown</div>
    </div>
  );
}

function CommandPalette({ close, go }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const actions = [
    { label: 'Go to Dashboard',    hint: 'Navigation', icon: <LayoutDashboard size={14} />, go: 'dashboard' },
    { label: 'Open Scans',         hint: 'Navigation', icon: <Scan size={14} />,            go: 'scans' },
    { label: 'New scan',           hint: 'Action',     icon: <Plus size={14} />,            go: 'scan' },
    { label: 'Open Estimates',     hint: 'Navigation', icon: <FileText size={14} />,        go: 'estimates' },
    { label: 'Open Rate library',  hint: 'Navigation', icon: <BookOpen size={14} />,        go: 'rates' },
    { label: 'Settings',           hint: 'Navigation', icon: <Settings size={14} />,        go: 'settings' },
  ];
  const filtered = actions.filter((a) => a.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(20, 20, 19, 0.35)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', paddingTop: '14vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '92vw', backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden', animation: 'slideDown 180ms ease-out', height: 'fit-content' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} color={C.textSubtle} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command, file, or rate code…" style={{ flex: 1, fontSize: 15, fontStyle: q ? 'normal' : 'italic', color: C.text }} />
          <span style={{ fontFamily: fontHeading, fontSize: 11, color: C.textSubtle, padding: '2px 6px', border: `1px solid ${C.border}`, borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ padding: 6, maxHeight: 360, overflowY: 'auto' }}>
          {filtered.map((a, i) => (
            <button key={i} onClick={() => go(a.go)} className="es-nav" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 6, textAlign: 'left', fontFamily: fontHeading, fontSize: 14 }}>
              <span style={{ color: C.textSubtle, display: 'flex' }}>{a.icon}</span>
              <span style={{ flex: 1 }}>{a.label}</span>
              <span style={{ fontSize: 11, color: C.textSubtle, fontStyle: 'italic' }}>{a.hint}</span>
            </button>
          ))}
          {filtered.length === 0 && (<div style={{ padding: 24, textAlign: 'center', color: C.textSubtle, fontStyle: 'italic' }}>No matches for "{q}"</div>)}
        </div>
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 14, fontSize: 11, color: C.textSubtle, backgroundColor: C.bg }}>
          <span><Keyboard size={11} style={{ display: 'inline', marginRight: 4 }} />↑↓ navigate</span>
          <span>⏎ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>{children}</div>;
}

function B({ children }) {
  return <span style={{ color: C.text, fontWeight: 500, fontStyle: 'normal' }}>{children}</span>;
}

function PageHeader({ title, sub, cta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
      <div>
        <h1 style={{ fontFamily: fontHeading, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px 0' }}>{title}</h1>
        {sub && <p style={{ color: C.textMuted, fontStyle: 'italic', margin: 0 }}>{sub}</p>}
      </div>
      {cta}
    </div>
  );
}

function StubView({ title }) {
  return <div className="anim-in"><PageHeader title={title} sub="Coming soon." /></div>;
}

function PrimaryButton({ children, icon, onClick }) {
  return (
    <button onClick={onClick} className="es-btn-primary" style={{ fontFamily: fontHeading, fontSize: 14, fontWeight: 500, backgroundColor: C.orange, color: '#fff', padding: '10px 18px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background-color 150ms' }}>
      {icon}{children}
    </button>
  );
}

function GhostButton({ children, icon, onClick }) {
  return (
    <button onClick={onClick} className="es-btn-ghost" style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 500, color: C.text, padding: '9px 14px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${C.border}`, backgroundColor: C.bgCard }}>
      {icon}{children}
    </button>
  );
}

function Kpi({ label, value, delta, sub, up }) {
  return (
    <div style={{ backgroundColor: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontFamily: fontHeading, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSubtle, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontFamily: fontHeading, fontSize: 26, fontWeight: 600, letterSpacing: '-0.015em' }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: up ? C.green : C.orange, fontWeight: 500 }}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{delta}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, v, tint }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: C.bgSoft, border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: fontHeading, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSubtle, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: fontHeading, fontSize: 17, fontWeight: 600, color: tint || C.text, letterSpacing: '-0.01em' }}>{v}</div>
    </div>
  );
}

function SectionHead({ title, cta, onCta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontFamily: fontHeading, fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
      {cta && (
        <button onClick={onCta} className="es-link" style={{ fontSize: 13, color: C.orange, fontFamily: fontHeading, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          {cta} <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

function ScanRow({ file, client, progress, stage, divider, onClick }) {
  return (
    <div className="es-row" onClick={onClick} style={{ padding: '16px 20px', borderTop: divider ? `1px solid ${C.border}` : 'none', transition: 'background-color 120ms', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: fontHeading, fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>{file}</div>
          <div style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>{client}</div>
        </div>
        <div style={{ fontFamily: fontHeading, fontSize: 13, fontWeight: 500, color: C.text, marginLeft: 12 }}>{progress}%</div>
      </div>
      <div style={{ height: 3, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', backgroundColor: C.orange, transition: 'width 400ms' }} />
      </div>
      <div style={{ fontSize: 12, color: C.textSubtle, marginTop: 8, fontFamily: fontHeading }}>{stage}</div>
    </div>
  );
}

function Th({ children, align = 'left', width }) {
  return (
    <th style={{ fontFamily: fontHeading, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSubtle, textAlign: align, padding: '12px 20px', width }}>{children}</th>
  );
}

function Td({ children, align = 'left', mono, muted }) {
  return (
    <td style={{ padding: '14px 20px', textAlign: align, fontFamily: mono ? fontMono : fontBody, color: muted ? C.textMuted : C.text, fontSize: 14 }}>{children}</td>
  );
}

function StatusPill({ status }) {
  const map = {
    approved: { bg: C.greenSoft,  fg: C.green,     icon: <CheckCircle2 size={11} />, label: 'Approved' },
    sent:     { bg: C.blueSoft,   fg: C.blue,      icon: <Send size={11} />,         label: 'Sent' },
    viewed:   { bg: C.borderSoft, fg: C.textMuted, icon: <Eye size={11} />,          label: 'Viewed' },
    draft:    { bg: C.bgSoft,     fg: C.textSubtle,icon: <FileEdit size={11} />,     label: 'Draft' },
  }[status] || { bg: C.bgSoft, fg: C.textSubtle, icon: null, label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: fontHeading, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 10, backgroundColor: map.bg, color: map.fg }}>
      {map.icon}{map.label}
    </span>
  );
}

function EstRow({ r, client, value, status, days }) {
  return (
    <tr className="es-row" style={{ borderTop: `1px solid ${C.border}`, transition: 'background-color 120ms', cursor: 'pointer' }}>
      <Td mono><span style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.01em' }}>{r}</span></Td>
      <Td>{client}</Td>
      <Td align="right" mono><span style={{ fontWeight: 500 }}>${value.toLocaleString()}</span></Td>
      <Td><StatusPill status={status} /></Td>
      <Td align="right" muted><span style={{ fontStyle: 'italic', fontSize: 13 }}>{days}d ago</span></Td>
      <Td align="right"><MoreHorizontal size={15} color={C.textSubtle} /></Td>
    </tr>
  );
}

function Row({ l, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: C.textMuted }}>
      <span>{l}</span><span style={{ fontFamily: fontMono, color: C.text }}>{v}</span>
    </div>
  );
}

function SymbolBadge({ symbol, small }) {
  const sz = small ? 24 : 32;
  const colors = { GPO: C.orange, LT: C.amber, SW: C.blue, DB: C.green, SA: C.orange, FN: C.blue, DC: C.green };
  return (
    <div style={{ width: sz, height: sz, borderRadius: 6, backgroundColor: (colors[symbol] || C.textSubtle) + '22', color: colors[symbol] || C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fontHeading, fontSize: small ? 10 : 11, fontWeight: 600 }}>
      {symbol}
    </div>
  );
}

function ConfPill({ c, withBar }) {
  const pct = Math.round(c * 100);
  const tone = c >= 0.9 ? C.green : c >= 0.8 ? C.amber : C.orange;
  if (withBar) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: tone }} />
        </div>
        <span style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted, width: 30 }}>{pct}%</span>
      </div>
    );
  }
  return (
    <span style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 10, backgroundColor: tone + '22', color: tone }}>{pct}%</span>
  );
}

function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 2, marginLeft: 3 }}>
      <span style={{ animation: 'dot 1.4s infinite', animationDelay: '0s' }}>·</span>
      <span style={{ animation: 'dot 1.4s infinite', animationDelay: '0.2s' }}>·</span>
      <span style={{ animation: 'dot 1.4s infinite', animationDelay: '0.4s' }}>·</span>
    </span>
  );
}
