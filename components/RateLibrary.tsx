import { useEffect, useMemo, useState } from "react";
import {
  fetchLibrary, fetchSyncLog, upsertLibraryItem, removeLibraryItem, appendSyncLog,
  RATE_CATEGORIES,
  type LibraryItem, type RateCategory, type SyncLogEntry, type WholesalerProduct,
} from "../services/rateLibraryService";

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
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [history, setHistory] = useState<SyncLogEntry[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncPct, setSyncPct] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"idle" | "ok" | "local">("idle");

  // Hydrate from Supabase on mount; fall back to local defaults if unavailable.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [libRes, logRes] = await Promise.all([fetchLibrary(), fetchSyncLog()]);
      if (!alive) return;
      if (libRes.ok) setLibrary(libRes.items);
      if (logRes.ok) {
        setHistory(logRes.entries);
        if (logRes.entries.length > 0) setLastSync(logRes.entries[0].ts);
      } else {
        // Seed a single "last synced today" entry so the header shows plausible UX.
        const nowIso = new Date().toISOString();
        setHistory([{
          id: "seed-1", ts: nowIso, source: "TLE Electrical",
          productsCount: WHOLESALER_CATALOGUE.length, status: "success",
          note: "Scheduled nightly trade-price sync (seed data · no cloud sync).",
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

  const addItem = async (p: WholesalerProduct) => {
    const item: LibraryItem = { ...p, myRate: Number((p.rrp * DEFAULT_MARKUP_OVER_RRP).toFixed(2)) };
    setLibrary(prev => [...prev.filter(x => x.productId !== p.productId), item]);
    const res = await upsertLibraryItem(item);
    setSyncStatus(res.ok ? "ok" : "local");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  const removeItem = async (productId: string) => {
    setLibrary(prev => prev.filter(x => x.productId !== productId));
    const res = await removeLibraryItem(productId);
    setSyncStatus(res.ok ? "ok" : "local");
    window.setTimeout(() => setSyncStatus("idle"), 1600);
  };

  const updateRate = async (productId: string, myRate: number) => {
    const clean = Math.max(0, Number.isFinite(myRate) ? myRate : 0);
    setLibrary(prev => prev.map(x => x.productId === productId ? { ...x, myRate: clean } : x));
    const target = library.find(x => x.productId === productId);
    if (target) {
      const res = await upsertLibraryItem({ ...target, myRate: clean });
      setSyncStatus(res.ok ? "ok" : "local");
      window.setTimeout(() => setSyncStatus("idle"), 1600);
    }
  };

  const triggerSync = () => {
    if (syncing) return;
    setSyncing(true);
    setSyncPct(0);
    const iv = window.setInterval(() => {
      setSyncPct(p => {
        if (p >= 100) {
          window.clearInterval(iv);
          finishSync();
          return 100;
        }
        return Math.min(100, p + 4);
      });
    }, 60);
  };

  const finishSync = async () => {
    const nowIso = new Date().toISOString();
    const entry: Omit<SyncLogEntry, "id"> = {
      ts: nowIso,
      source: "TLE Electrical",
      productsCount: WHOLESALER_CATALOGUE.length,
      status: "success",
      note: `Synced ${WHOLESALER_CATALOGUE.length} trade prices. User rates preserved.`,
    };
    setHistory(prev => [{ ...entry, id: `local-${Date.now()}` }, ...prev]);
    setLastSync(nowIso);
    setSyncing(false);
    setSyncPct(0);
    const res = await appendSyncLog({ source: entry.source, productsCount: entry.productsCount, status: entry.status, note: entry.note });
    setSyncStatus(res.ok ? "ok" : "local");
    window.setTimeout(() => setSyncStatus("idle"), 2200);
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
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>TLE Electrical Wholesaler · B2B trade pricing</div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={triggerSync} disabled={syncing}
            style={{
              flex: 2, background: syncing ? C.card : C.blue, border: `1px solid ${C.blue}`,
              color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 10,
              cursor: syncing ? "progress" : "pointer", opacity: syncing ? 0.8 : 1,
            }}>
            {syncing ? `Syncing… ${syncPct}%` : "🔄 Sync TLE Prices"}
          </button>
          <button
            style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, padding: "10px", borderRadius: 10, cursor: "pointer" }}
            title="Multi-wholesaler support coming soon">
            ＋ Wholesaler
          </button>
        </div>
        {syncing && (
          <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${syncPct}%`, height: "100%", background: C.blue, transition: "width 0.06s linear" }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: "12px 16px 0", background: C.bg, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
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
            color: syncStatus === "ok" ? C.green : C.amber,
          }}>
            {syncStatus === "ok" ? "Saved to rate library" : "Saved locally · cloud sync unavailable"}
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
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
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

function EmptyState({ text, sub, icon = "📭" }: { text: string; sub?: string; icon?: string }) {
  return (
    <div style={{ textAlign: "center" as const, padding: "48px 20px", color: C.muted }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{text}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

