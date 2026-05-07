import React, { useState, useMemo } from "react";
import { Search, Plus, Pencil } from "lucide-react";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  MiniStat,
  Footer,
  Th,
  Td,
  B,
} from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchRateLibrary, type RateRow } from "../services/supabaseData";

// ─── Rate library data ──────────────────────────────────────────────────
// TODO: Replace with Supabase fetch from `rate_library` table.
//
// Supabase schema — rate_library table:
//   id: uuid (PK)
//   code: text UNIQUE (e.g. "GPO-001")
//   category: text (e.g. "Power", "Lighting", "Switches", etc.)
//   description: text
//   unit: text (e.g. "ea", "m", "hr", "set")
//   rate: numeric (material cost per unit)
//   labour: numeric (labour cost per unit)
//   owner_id: uuid (FK to auth.users)
//   synced_at: timestamptz
//   is_custom: boolean DEFAULT false
// RLS: users read/write only their own rows. Seed from RATE_LIBRARY below
// on first sign-up.

const RATE_LIBRARY = [
  { code: "GPO-001", category: "Power",    description: "Double GPO install (flush)",        unit: "ea",  rate: 85,   labour: 45  },
  { code: "GPO-002", category: "Power",    description: "Double GPO with USB-C",             unit: "ea",  rate: 125,  labour: 45  },
  { code: "GPO-003", category: "Power",    description: "Weatherproof GPO IP56",             unit: "ea",  rate: 145,  labour: 60  },
  { code: "GPO-004", category: "Power",    description: "Single GPO install",                unit: "ea",  rate: 65,   labour: 35  },
  { code: "GPO-005", category: "Power",    description: "3-phase outlet 32A",                unit: "ea",  rate: 320,  labour: 120 },
  { code: "LT-001",  category: "Lighting", description: "LED downlight 10W dimmable",        unit: "ea",  rate: 65,   labour: 40  },
  { code: "LT-002",  category: "Lighting", description: "LED downlight 13W tri-colour",      unit: "ea",  rate: 85,   labour: 40  },
  { code: "LT-003",  category: "Lighting", description: "Oyster light LED 18W",              unit: "ea",  rate: 95,   labour: 35  },
  { code: "LT-004",  category: "Lighting", description: "LED strip 5m (incl. driver)",       unit: "set", rate: 180,  labour: 90  },
  { code: "LT-005",  category: "Lighting", description: "Pendant rough-in",                  unit: "ea",  rate: 120,  labour: 55  },
  { code: "SW-001",  category: "Switches", description: "Single switch 1-gang",              unit: "ea",  rate: 45,   labour: 25  },
  { code: "SW-002",  category: "Switches", description: "2-way switch 1-gang",               unit: "ea",  rate: 55,   labour: 30  },
  { code: "SW-003",  category: "Switches", description: "Dimmer switch LED-compatible",      unit: "ea",  rate: 95,   labour: 35  },
  { code: "SW-004",  category: "Switches", description: "4-gang switch plate",               unit: "ea",  rate: 110,  labour: 40  },
  { code: "CB-001",  category: "Cabling",  description: "TPS 2.5mm² per metre",         unit: "m",   rate: 8,    labour: 4   },
  { code: "CB-002",  category: "Cabling",  description: "TPS 4mm² per metre",           unit: "m",   rate: 12,   labour: 5   },
  { code: "CB-003",  category: "Cabling",  description: "TPS 6mm² per metre",           unit: "m",   rate: 18,   labour: 6   },
  { code: "CB-004",  category: "Cabling",  description: "Cat6A data cable per metre",        unit: "m",   rate: 6,    labour: 3   },
  { code: "CB-005",  category: "Cabling",  description: "Conduit 20mm orange per metre",     unit: "m",   rate: 4,    labour: 3   },
  { code: "SB-001",  category: "Boards",   description: "Meter box upgrade to 100A",         unit: "ea",  rate: 1450, labour: 480 },
  { code: "SB-002",  category: "Boards",   description: "Distribution board 12-way",         unit: "ea",  rate: 680,  labour: 320 },
  { code: "SB-003",  category: "Boards",   description: "RCBO install per pole",             unit: "ea",  rate: 145,  labour: 45  },
  { code: "SB-004",  category: "Boards",   description: "Main switch 63A",                   unit: "ea",  rate: 220,  labour: 85  },
  { code: "SA-001",  category: "Safety",   description: "Smoke alarm 240V interconnect",     unit: "ea",  rate: 140,  labour: 50  },
  { code: "SA-002",  category: "Safety",   description: "RCD safety switch install",         unit: "ea",  rate: 180,  labour: 60  },
  { code: "SA-003",  category: "Safety",   description: "Emergency exit light LED",          unit: "ea",  rate: 220,  labour: 85  },
  { code: "DC-001",  category: "Data",     description: "Cat6A data point + faceplate",      unit: "ea",  rate: 135,  labour: 55  },
  { code: "DC-002",  category: "Data",     description: "TV point + coax run",               unit: "ea",  rate: 110,  labour: 45  },
  { code: "DC-003",  category: "Data",     description: "Patch panel 24-port install",       unit: "ea",  rate: 280,  labour: 120 },
  { code: "FN-001",  category: "Fans",     description: "Bathroom exhaust fan + duct",       unit: "ea",  rate: 185,  labour: 75  },
  { code: "FN-002",  category: "Fans",     description: "Ceiling fan rough-in",              unit: "ea",  rate: 145,  labour: 55  },
  { code: "EX-001",  category: "Ext.",     description: "External sensor light LED",         unit: "ea",  rate: 155,  labour: 65  },
  { code: "EX-003",  category: "Ext.",     description: "EV charger 7kW single-phase",       unit: "ea",  rate: 1850, labour: 380 },
  { code: "TS-001",  category: "Testing",  description: "Pre-handover test & tag",           unit: "hr",  rate: 125,  labour: 125 },
  { code: "TS-002",  category: "Testing",  description: "Compliance certificate",            unit: "ea",  rate: 280,  labour: 0   },
];

// ─── Screen ─────────────────────────────────────────────────────────────
export default function PricingScheduleScreen() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const { data: liveRates, isLive } = useSupabaseQuery(
    fetchRateLibrary,
    RATE_LIBRARY.map(r => ({ ...r, id: r.code, is_custom: false, synced_at: new Date().toISOString() } as RateRow)),
  );

  const rateData = liveRates.map((r: any) => ({
    code: r.code,
    category: r.category,
    description: r.description,
    unit: r.unit,
    rate: r.rate,
    labour: r.labour,
  }));

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(rateData.map((r: any) => r.category)))],
    [rateData],
  );

  const filtered = useMemo(
    () =>
      rateData.filter(
        (r: any) =>
          (filter === "All" || r.category === filter) &&
          (query === "" ||
            (r.description + " " + r.code).toLowerCase().includes(query.toLowerCase())),
      ),
    [filter, query, rateData],
  );

  const totalItems = rateData.length;
  const avgRate = totalItems > 0
    ? Math.round(rateData.reduce((s: number, r: any) => s + r.rate + r.labour, 0) / totalItems)
    : 0;
  const maxRate = totalItems > 0
    ? Math.max(...rateData.map((r: any) => r.rate + r.labour))
    : 0;

  return (
    <div className="anim-in">
      {!isLive && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, backgroundColor: C.amberSoft, color: C.amber, fontFamily: FONT.heading, fontSize: 11, fontWeight: 500, marginBottom: 12 }}>
          Demo data — Supabase tables not yet created
        </div>
      )}
      <PageHeader
        title="Rate library"
        sub={`${totalItems} items · ${isLive ? "live from Supabase" : "imported from Vesh Electrical"} · last synced today`}
        cta={<PrimaryButton icon={<Plus size={14} />}>Add rate</PrimaryButton>}
      />

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <MiniStat label="Total items"  v={String(totalItems)} />
        <MiniStat label="Avg rate"     v={`$${avgRate}`}  tint={C.blue} />
        <MiniStat label="Highest item" v={`$${maxRate.toLocaleString()}`} tint={C.amber} />
        <MiniStat label="Categories"   v={String(categories.length - 1)} tint={C.green} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${C.border}`,
            borderRadius: RADIUS.md + 2,
            backgroundColor: C.bgCard,
            padding: "7px 12px",
            width: 280,
          }}
        >
          <Search size={14} color={C.textSubtle} />
          <input
            placeholder="Search rates…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: FONT.body,
              color: C.text,
              fontStyle: query ? "normal" : "italic",
            }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                fontFamily: FONT.heading,
                fontSize: 12,
                fontWeight: 500,
                backgroundColor: filter === cat ? C.text : "transparent",
                color: filter === cat ? C.bg : C.textMuted,
                border: `1px solid ${filter === cat ? C.text : C.border}`,
                transition: "all 120ms",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rate table */}
      <Card>
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>Code</Th>
              <Th>Description</Th>
              <Th>Category</Th>
              <Th>Unit</Th>
              <Th align="right">Material</Th>
              <Th align="right">Labour</Th>
              <Th align="right">Total</Th>
              <Th width={32} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.code}
                className="es-row"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <Td mono>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>{r.code}</span>
                </Td>
                <Td>{r.description}</Td>
                <Td>
                  <span
                    style={{
                      fontFamily: FONT.heading,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: C.borderSoft,
                      color: C.textMuted,
                    }}
                  >
                    {r.category}
                  </span>
                </Td>
                <Td muted>
                  <span style={{ fontFamily: FONT.mono, fontSize: 12 }}>{r.unit}</span>
                </Td>
                <Td align="right" mono>${r.rate}</Td>
                <Td align="right" mono>${r.labour}</Td>
                <Td align="right" mono><B>${r.rate + r.labour}</B></Td>
                <Td>
                  <button style={{ padding: 4, borderRadius: 4, color: C.textSubtle }}>
                    <Pencil size={13} />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          color: C.textSubtle,
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        {filtered.length} of {totalItems} shown
      </div>

      <Footer />
    </div>
  );
}
