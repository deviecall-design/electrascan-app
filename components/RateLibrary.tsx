import { useEffect, useMemo, useState } from "react";
import {
  fetchSyncLog,
  RATE_CATEGORIES,
  type RateCategory, type SyncLogEntry, type WholesalerProduct,
} from "../services/rateLibraryService";
import { useRateLibrary, type CustomLibraryItem } from "../contexts/RateLibraryContext";

type LibraryItem = CustomLibraryItem;

// ─── Design tokens (mirror App.tsx) ──────────────
const C = {
  bg:     "#0A1628", navy:   "#0F1E35", card:   "#132240",
  blue:   "#1D6EFD", blueLt: "#4B8FFF", green:  "#00C48C",
  amber:  "#FFB020", red:    "#FF4D4D", text:   "#EDF2FF",
  muted:  "#5C7A9E", border: "#1A3358", dim:    "#8BA4C4",
  purple: "#7C3AED", teal:   "#0EA5E9",
};

// ─── Props ────────────────────────────────────────
export interface RateLibraryProps {
  onBack: () => void;
}

// ─── Curated TLE wholesaler catalogue ────────────
// Mirrors the 5 categories called out in §4.8 of the requirements doc. Prices
// are representative trade/RRP figures for a B2B electrical wholesaler (AU, ex
// GST). In production this would be replaced by a nightly sync from the
// wholesaler's API (TLE in the prototype) — see fetchSyncLog/appendSyncLog in
// services/rateLibraryService.ts for the audit trail wiring.
const WHOLESALER_CATALOGUE: WholesalerProduct[] = [
  // Power Points
  { productId: "TLE-2025WE",   code: "2025WE",   name: "Iconic Single GPO — White",               brand: "Clipsal",  category: "Power Points",          trade: 14.20,  rrp: 28.50,  unit: "EA" },
  { productId: "TLE-2025-2WE", code: "2025-2WE", name: "Iconic Double GPO — White",               brand: "Clipsal",  category: "Power Points",          trade: 18.90,  rrp: 36.80,  unit: "EA" },
  { productId: "TLE-2025WEUSB",code: "2025WEUSB",name: "Iconic Double GPO + USB-A/C",             brand: "Clipsal",  category: "Power Points",          trade: 48.60,  rrp: 92.40,  unit: "EA" },
  { productId: "TLE-WHDBL-WP", code: "WHDBL-WP", name: "Weatherproof Double GPO IP56",            brand: "HPM",      category: "Power Points",          trade: 32.40,  rrp: 58.90,  unit: "EA" },
  { productId: "TLE-EV32A",    code: "EV32A",    name: "EV Charger Outlet 32A — Wallbox",         brand: "Wallbox",  category: "Power Points",          trade: 860.00, rrp: 1450.00,unit: "EA" },
  { productId: "TLE-WD-DIM",   code: "WD-DIM",   name: "Wiser Dimmer 350W — Dali",                brand: "Clipsal",  category: "Power Points",          trade: 64.80,  rrp: 128.00, unit: "EA" },

  // Lighting
  { productId: "TLE-LED9DL",   code: "LED9DL",   name: "9W LED Downlight 90mm — CCT Switchable",  brand: "Brightgreen",category: "Lighting",            trade: 11.40,  rrp: 22.90,  unit: "EA" },
  { productId: "TLE-LED13DL",  code: "LED13DL",  name: "13W LED Downlight 90mm — Dimmable",       brand: "Brightgreen",category: "Lighting",            trade: 17.80,  rrp: 35.60,  unit: "EA" },
  { productId: "TLE-LEDSTRIP", code: "LEDSTRIP", name: "24V LED Strip 5m — 4000K IP65",           brand: "Hafele",   category: "Lighting",              trade: 54.20,  rrp: 98.00,  unit: "EA" },
  { productId: "TLE-PDNT-E27", code: "PDNT-E27", name: "Pendant Cord Set E27 — Black",            brand: "Martec",   category: "Lighting",              trade: 18.60,  rrp: 42.00,  unit: "EA" },
  { productId: "TLE-EXTLED",   code: "EXTLED",   name: "Exterior Bollard LED 7W IP65",            brand: "Martec",   category: "Lighting",              trade: 86.40,  rrp: 148.00, unit: "EA" },
  { productId: "TLE-EMRGY",    code: "EMRGY",    name: "Emergency Exit Light LED — Ceiling",      brand: "Legrand",  category: "Lighting",              trade: 54.00,  rrp: 112.00, unit: "EA" },

  // Switchboard
  { productId: "TLE-MSBSS",    code: "MSBSS",    name: "Main Switchboard 3-Phase 63A Enclosure",  brand: "NHP",      category: "Switchboard",           trade: 1240.00,rrp: 1980.00,unit: "EA" },
  { productId: "TLE-DB12W",    code: "DB12W",    name: "Distribution Board 12-Way Flush",         brand: "Clipsal",  category: "Switchboard",           trade: 168.00, rrp: 298.00, unit: "EA" },
  { productId: "TLE-MCB-20A",  code: "MCB-20A",  name: "MCB Circuit Breaker 20A C-Curve",         brand: "Clipsal",  category: "Switchboard",           trade: 8.40,   rrp: 16.80,  unit: "EA" },
  { productId: "TLE-RCD-40A",  code: "RCD-40A",  name: "RCD 40A 30mA Type A",                     brand: "Clipsal",  category: "Switchboard",           trade: 98.00,  rrp: 172.00, unit: "EA" },
  { productId: "TLE-SURGE",    code: "SURGE",    name: "Surge Protection Device Type 2",          brand: "NHP",      category: "Switchboard",           trade: 148.00, rrp: 248.00, unit: "EA" },

  // Cabling
  { productId: "TLE-TPS-2.5",  code: "TPS-2.5",  name: "TPS 2.5mm² Twin + Earth — 100m Coil",     brand: "Olex",     category: "Cabling",               trade: 142.00, rrp: 238.00, unit: "COIL" },
  { productId: "TLE-TPS-1.5",  code: "TPS-1.5",  name: "TPS 1.5mm² Twin + Earth — 100m Coil",     brand: "Olex",     category: "Cabling",               trade: 96.00,  rrp: 164.00, unit: "COIL" },
  { productId: "TLE-TPS-6.0",  code: "TPS-6.0",  name: "TPS 6mm² Twin + Earth — 100m Coil",       brand: "Olex",     category: "Cabling",               trade: 348.00, rrp: 498.00, unit: "COIL" },
  { productId: "TLE-PVC-25",   code: "PVC-25",   name: "PVC Conduit 25mm Medium Duty",            brand: "Clipsal",  category: "Cabling",               trade: 2.80,   rrp: 5.20,   unit: "LM" },
  { productId: "TLE-PVC-20",   code: "PVC-20",   name: "PVC Conduit 20mm Medium Duty",            brand: "Clipsal",  category: "Cabling",               trade: 2.10,   rrp: 3.90,   unit: "LM" },
  { productId: "TLE-CAT6-305", code: "CAT6-305", name: "Cat6 UTP 305m Box — Blue",                brand: "Prysmian", category: "Cabling",               trade: 228.00, rrp: 398.00, unit: "COIL" },

  // Data & Communications
  { productId: "TLE-RJ45-CAT6",code: "RJ45-CAT6",name: "Cat6 Keystone Jack — White",              brand: "Clipsal",  category: "Data & Communications", trade: 6.80,   rrp: 14.20,  unit: "EA" },
  { productId: "TLE-WP-DATA",  code: "WP-DATA",  name: "Iconic Data Wall Plate — 2 Port",         brand: "Clipsal",  category: "Data & Communications", trade: 18.40,  rrp: 32.00,  unit: "EA" },
  { productId: "TLE-TV-COAX",  code: "TV-COAX",  name: "TV Coaxial Outlet F-Type",                brand: "Kingray",  category: "Data & Communications", trade: 12.60,  rrp: 24.00,  unit: "EA" },
  { productId: "TLE-CCTV-DOME",code: "CCTV-DOME",name: "Dome CCTV Camera 4K IP PoE",              brand: "Hikvision",category: "Data & Communications", trade: 186.00, rrp: 298.00, unit: "EA" },
  { productId: "TLE-INT-IP",   code: "INT-IP",   name: "IP Intercom Door Station + Indoor Unit",  brand: "Aiphone",  category: "Data & Communications", trade: 688.00, rrp: 1140.00,unit: "EA" },
];

// Default myRate markup when an item is first added to the library: RRP + 15%.
const DEFAULT_MARKUP_OVER_RRP = 1.15;

// ─── Helpers ──────────────────────────────────────
const fmt2 = (n: number) => `$${n.toFixed(2)}`;
const fmtRel = (ts: string): string => {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
};
const marginPct = (myRate: number, trade: number) =>
  trade > 0 ? ((myRate - trade) / trade) * 100 : 0;

// ─── Component ────────────────────────────────────
export default function RateLibrary({ onBack }: RateLibraryProps) {
  const [tab, setTab] = useState<"browse" | "library" | "history">("browse");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<RateCategory | "All">("All");
  const { items: library, addItem: ctxAddItem, updateItem: ctxUpdateItem, removeItem: ctxRemoveItem } = useRateLibrary();
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "ok" | "local" | "toast">("idle");
  const [syncToastMsg, setSyncToastMsg] = useState<string>("");
  const [showCustom, setShowCustom] = useState(false);

  // Hydrate sync log from Supabase if available; always fall back to a seed entry.
  useEffect(() => {
    let alive = true;
    (async () => {
      const logRes = await fetchSyncLog();
      if (!alive) return;
      if (logRes.ok && logRes.entries.length > 0) {
        setHistory(logRes.entries);
        setLastSync(logRes.entries[0].ts);
      } else {
        const nowIso = new Date().toISOString();
        setHistory([{
          id: "seed-1", ts: nowIso, source: "Simpro",
          productsCount: WHOLESALER_CATALOGUE.length, status: "success",
          note: "Catalogue synced (seed data · Simpro connector pending).",
        }]);
        setLastSync(nowIso);
      }
    })();
    return () => { alive = false; };
  }, []);

  const inLibraryIds = useMemo(() => new Set(library.map(i => i.productId)), [library]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return WHOLESALER_CATALOGUE.filter(p => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    });
  }, [search, category]);

  const addItem = (p: WholesalerProduct) => {
    const item: LibraryItem = { ...p, myRate: Number((p.rrp * DEFAULT_MARKUP_OVER_RRP).toFixed(2)) };
    ctxAddItem(item);
    setSyncStatus("ok");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  const removeItem = (productId: string) => {
    ctxRemoveItem(productId);
    setSyncStatus("ok");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  const updateRate = (productId: string, myRate: number) => {
    const clean = Math.max(0, Number.isFinite(myRate) ? myRate : 0);
    ctxUpdateItem(productId, { myRate: clean });
    setSyncStatus("ok");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  // Simpro sync is a placeholder until the integration ships (§10). Surface a
  // toast so users know the button is wired but the connector isn't live yet.
  const triggerSync = () => {
    setSyncToastMsg("Simpro sync not yet connected — catalogue is up to date");
    setSyncStatus("toast");
    window.setTimeout(() => setSyncStatus("idle"), 2800);
  };

  const addCustomItem = (input: {
    name: string;
    category: RateCategory;
    unit: "EA" | "LM" | "COIL" | "HR" | "LS";
    trade: number;
    marginPct: number;
  }) => {
    const sell = Number((input.trade * (1 + input.marginPct / 100)).toFixed(2));
    const id = `CUSTOM-${Date.now().toString(36).toUpperCase()}`;
    const item: LibraryItem = {
      productId: id,
      code: id.replace("CUSTOM-", ""),
      name: input.name,
      brand: "Custom",
      category: input.category,
      trade: input.trade,
      rrp: sell,
      unit: (["EA", "LM", "COIL"].includes(input.unit) ? input.unit : "EA") as LibraryItem["unit"],
      myRate: sell,
      custom: true,
      marginPct: input.marginPct,
    };
    ctxAddItem(item);
    setShowCustom(false);
    setSyncStatus("ok");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.border}`, padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0 }}>
            ← Back
          </button>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>
            {lastSync ? `Last synced · ${fmtRel(lastSync)}` : "Never synced"}
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Rate Library</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Wholesaler catalogue · custom rates · Simpro integration pending</div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={triggerSync}
            style={{
              flex: 2, minWidth: 160,
              background: C.blue, border: `1px solid ${C.blue}`,
              color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10,
              cursor: "pointer",
            }}>
            🔄 Sync (Simpro)
          </button>
          <button onClick={() => setShowCustom(true)}
            style={{
              flex: 1, minWidth: 140,
              background: "none", border: `1px solid ${C.border}`,
              color: C.text, fontSize: 12, fontWeight: 700, padding: "10px", borderRadius: 10, cursor: "pointer",
            }}>
            ＋ Add Custom Rate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "12px 16px 0", background: C.bg, flexShrink: 0 }}>
        <div className="filter-tabs" style={{ gap: 8, paddingBottom: 0 }}>
          {([
            { id: "browse" as const,  label: "🏪 Browse",   count: WHOLESALER_CATALOGUE.length },
            { id: "library" as const, label: "📚 Library",  count: library.length },
            { id: "history" as const, label: "🕐 History",  count: history.length },
          ]).map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  flexShrink: 0, background: active ? `${C.blue}22` : C.card,
                  border: `1px solid ${active ? C.blue : C.border}`,
                  color: active ? C.blueLt : C.muted,
                  fontSize: 12, fontWeight: 700, padding: "7px 12px",
                  borderRadius: 20, cursor: "pointer",
                }}>
                {t.label} <span style={{ opacity: 0.6, fontWeight: 500 }}>{t.count}</span>
              </button>
            );
          })}
        </div>
        {syncStatus !== "idle" && (
          <div style={{
            fontSize: 11, marginTop: 8, textAlign: "center" as const,
            color: syncStatus === "ok" ? C.green : syncStatus === "toast" ? C.amber : C.amber,
          }}>
            {syncStatus === "ok"
              ? "Saved to rate library"
              : syncStatus === "toast"
                ? syncToastMsg
                : "Saved locally · cloud sync unavailable"}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 96px" }}>
        {tab === "browse" && (
          <BrowseTab
            search={search} onSearch={setSearch}
            category={category} onCategory={setCategory}
            products={filtered} inLibraryIds={inLibraryIds}
            onAdd={addItem}
          />
        )}
        {tab === "library" && (
          <LibraryTab items={library} onUpdate={updateRate} onRemove={removeItem} />
        )}
        {tab === "history" && (
          <HistoryTab entries={history} />
        )}
      </div>

      {/* Custom Rate modal */}
      {showCustom && (
        <CustomRateModal onClose={() => setShowCustom(false)} onSave={addCustomItem} />
      )}

      {/* Bottom nav */}
      <div style={{
        position: "fixed" as const, bottom: 0, left: 0, right: 0, background: C.navy,
        borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 12px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
      }}>
        <button onClick={onBack}
          style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20 }}>🏠</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Projects</div>
        </button>
        <button onClick={triggerSync}
          style={{ flex: 1, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginTop: -10, boxShadow: `0 4px 20px ${C.blue}66` }}>🔄</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Sync</div>
        </button>
        <button style={{ flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 20, opacity: 0.9 }}>📚</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>Library</div>
          <div style={{ width: 20, height: 2, background: C.blue, borderRadius: 1 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Browse tab ───────────────────────────────────
function BrowseTab({
  search, onSearch, category, onCategory, products, inLibraryIds, onAdd,
}: {
  search: string;
  onSearch: (v: string) => void;
  category: RateCategory | "All";
  onCategory: (c: RateCategory | "All") => void;
  products: WholesalerProduct[];
  inLibraryIds: Set<string>;
  onAdd: (p: WholesalerProduct) => void;
}) {
  return (
    <>
      <input
        value={search} onChange={e => onSearch(e.target.value)}
        placeholder="Search by product, code, or brand…"
        style={{
          width: "100%", background: C.card, border: `1px solid ${C.border}`,
          color: C.text, fontSize: 13, padding: "10px 14px", borderRadius: 10,
          outline: "none", marginBottom: 10, boxSizing: "border-box",
        }}
      />
      <div className="filter-tabs" style={{ marginBottom: 12 }}>
        {(["All", ...RATE_CATEGORIES] as const).map(c => {
          const active = category === c;
          return (
            <button key={c} onClick={() => onCategory(c)}
              style={{
                flexShrink: 0, background: active ? C.blue : C.card,
                border: `1px solid ${active ? C.blue : C.border}`,
                color: active ? "#fff" : C.muted,
                fontSize: 11, fontWeight: 700, padding: "6px 12px",
                borderRadius: 20, cursor: "pointer",
              }}>{c}</button>
          );
        })}
      </div>

      {products.length === 0 ? (
        <EmptyState text="No products match your filters." />
      ) : (
        products.map(p => (
          <ProductCard key={p.productId} product={p} inLibrary={inLibraryIds.has(p.productId)} onAdd={() => onAdd(p)} />
        ))
      )}
    </>
  );
}

function ProductCard({ product, inLibrary, onAdd }: {
  product: WholesalerProduct; inLibrary: boolean; onAdd: () => void;
}) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "12px 14px", marginBottom: 8, display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: C.dim }}>{product.code}</div>
          <CategoryTag category={product.category} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>{product.name}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{product.brand} · {product.unit}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{fmt2(product.trade)}</span>
          <span style={{ fontSize: 11, color: C.dim, textDecoration: "line-through" }}>{fmt2(product.rrp)}</span>
          <span style={{ fontSize: 10, color: C.muted }}>RRP</span>
        </div>
      </div>
      <button onClick={onAdd} disabled={inLibrary}
        style={{
          flexShrink: 0,
          background: inLibrary ? `${C.green}22` : C.blue,
          border: `1px solid ${inLibrary ? C.green : C.blue}`,
          color: inLibrary ? C.green : "#fff",
          fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 8,
          cursor: inLibrary ? "default" : "pointer", whiteSpace: "nowrap" as const,
          alignSelf: "center" as const,
        }}>
        {inLibrary ? "✓ In Library" : "＋ Add"}
      </button>
    </div>
  );
}

// ─── Library tab ──────────────────────────────────
function LibraryTab({
  items, onUpdate, onRemove,
}: {
  items: LibraryItem[];
  onUpdate: (id: string, v: number) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div style={{ paddingTop: 40 }}>
        <EmptyState
          text="Your rate library is empty."
          sub="Browse the TLE catalogue and tap ＋ Add to start building your priced catalogue."
          icon="📚"
        />
      </div>
    );
  }
  return (
    <>
      <div style={{
        fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 10,
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px",
      }}>
        {items.length} item{items.length === 1 ? "" : "s"} · Rates auto-populate estimates when components are detected.
      </div>
      {items.map(item => (
        <LibraryRow key={item.productId} item={item} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
      <div style={{
        marginTop: 10, padding: "10px 12px", borderRadius: 10,
        background: `${C.blue}14`, border: `1px solid ${C.blue}33`,
        fontSize: 11, color: C.blueLt, lineHeight: 1.55,
      }}>
        💡 Set <strong>My Rate</strong> above trade to apply your markup at the product level. When ElectraScan detects a component, it uses your rate — not the raw trade price.
      </div>
    </>
  );
}

function LibraryRow({
  item, onUpdate, onRemove,
}: {
  item: LibraryItem;
  onUpdate: (id: string, v: number) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState(item.myRate.toFixed(2));
  useEffect(() => setDraft(item.myRate.toFixed(2)), [item.myRate]);
  const margin = marginPct(item.myRate, item.trade);
  const marginColor = margin < 0 ? C.red : margin < 50 ? C.amber : C.green;

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n !== item.myRate) onUpdate(item.productId, n);
    else setDraft(item.myRate.toFixed(2));
  };

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const, marginBottom: 3 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: C.dim }}>{item.code}</div>
            <CategoryTag category={item.category} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.brand} · {item.unit}</div>
        </div>
        <button onClick={() => onRemove(item.productId)}
          style={{
            background: "none", border: "none", color: C.red, fontSize: 18,
            cursor: "pointer", padding: 2, lineHeight: 1, flexShrink: 0,
          }} title="Remove from library">×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 8, alignItems: "center", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted }}>Trade</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmt2(item.trade)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted }}>My Rate</div>
          <div style={{
            display: "flex", alignItems: "center", background: C.bg,
            border: `1px solid ${C.blue}55`, borderRadius: 6, padding: "2px 8px",
            marginTop: 2,
          }}>
            <span style={{ fontSize: 11, color: C.muted, marginRight: 2 }}>$</span>
            <input
              type="number" step="0.01" min={0} value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              style={{
                background: "none", border: "none", color: C.blueLt,
                fontSize: 13, fontWeight: 700, width: "100%", outline: "none",
              }}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.muted }}>Margin</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: marginColor }}>
            {margin >= 0 ? "+" : ""}{margin.toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── History tab ──────────────────────────────────
function HistoryTab({ entries }: { entries: SyncLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState text="No sync events yet." sub="Tap Sync TLE Prices to run your first import." icon="🕐" />;
  }
  return (
    <>
      {entries.map(e => {
        const color = e.status === "success" ? C.green : C.red;
        return (
          <div key={e.id}
            style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${color}`, borderRadius: 12,
              padding: "12px 14px", marginBottom: 8,
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.source}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                  background: `${color}22`, color, letterSpacing: "0.5px", textTransform: "uppercase" as const,
                }}>{e.status}</span>
              </div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>{fmtRel(e.ts)}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 4 }}>{e.note}</div>
            <div style={{ fontSize: 11, color: C.dim }}>{e.productsCount} product{e.productsCount === 1 ? "" : "s"}</div>
          </div>
        );
      })}
    </>
  );
}

// ─── Shared primitives ───────────────────────────
function CategoryTag({ category }: { category: RateCategory }) {
  const color: Record<RateCategory, string> = {
    "Power Points":          C.blue,
    "Lighting":              C.amber,
    "Switchboard":           C.purple,
    "Cabling":               C.teal,
    "Data & Communications": C.green,
  };
  const c = color[category];
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
      background: `${c}22`, color: c, letterSpacing: "0.3px", textTransform: "uppercase" as const,
    }}>{category}</span>
  );
}

// ─── Custom Rate Modal ──────────────────────────
function CustomRateModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: {
    name: string;
    category: RateCategory;
    unit: "EA" | "LM" | "COIL" | "HR" | "LS";
    trade: number;
    marginPct: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<RateCategory>("Power Points");
  const [unit, setUnit] = useState<"EA" | "LM" | "COIL" | "HR" | "LS">("EA");
  const [trade, setTrade] = useState<number>(0);
  const [marginPct, setMarginPct] = useState<number>(25);

  const sell = Number((Math.max(0, trade) * (1 + Math.max(0, marginPct) / 100)).toFixed(2));
  const valid = name.trim().length > 0 && trade > 0;

  const inputStyle: React.CSSProperties = {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed" as const, inset: 0, zIndex: 300, background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: C.navy, border: `1px solid ${C.border}`, borderRadius: 20,
          padding: 22, maxWidth: 420, width: "100%",
        }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 14 }}>
          Add Custom Rate
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>
          Enter a line item you supply directly (e.g. a bespoke fitting or sub-contractor
          day rate). It will be added to your library and available as a line item
          in any estimate.
        </div>

        <Field label="NAME">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Architectural pendant — imported"
            style={inputStyle} />
        </Field>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label="CATEGORY">
            <select value={category} onChange={e => setCategory(e.target.value as RateCategory)} style={inputStyle}>
              {RATE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="UNIT">
            <select value={unit} onChange={e => setUnit(e.target.value as typeof unit)} style={inputStyle}>
              <option value="EA">EA</option>
              <option value="LM">LM</option>
              <option value="COIL">COIL</option>
              <option value="HR">HR</option>
              <option value="LS">LS</option>
            </select>
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Field label="TRADE PRICE ($)">
            <input type="number" min={0} step={0.01} value={trade}
              onChange={e => setTrade(Number(e.target.value) || 0)}
              style={inputStyle} />
          </Field>
          <Field label="MARGIN (%)">
            <input type="number" min={0} step={1} value={marginPct}
              onChange={e => setMarginPct(Number(e.target.value) || 0)}
              style={inputStyle} />
          </Field>
        </div>

        <div style={{
          background: `${C.green}14`, border: `1px solid ${C.green}44`,
          borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.green, fontWeight: 700,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>Sell price</span>
          <span>${sell.toFixed(2)}</span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted,
              fontSize: 13, padding: "10px", borderRadius: 10, cursor: "pointer" }}>
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => valid && onSave({ name: name.trim(), category, unit, trade, marginPct })}
            style={{
              flex: 2, background: valid ? C.blue : C.card,
              color: valid ? "#fff" : C.muted, border: "none",
              fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10,
              cursor: valid ? "pointer" : "not-allowed",
            }}>
            Add to Library
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.6,
        marginBottom: 4, textTransform: "uppercase" as const,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text, sub, icon = "📭" }: { text: string; sub?: string; icon?: string }) {
  return (
    <div style={{ textAlign: "center" as const, padding: "48px 20px", color: C.muted }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{text}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

