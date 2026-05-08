import React, { useState, useMemo, useRef } from "react";
import { Search, Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
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
import { PrimaryButton, GhostButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchRateLibrary, upsertRate, deleteRate, type RateRow } from "../services/supabaseData";
import { useToast } from "../contexts/ToastContext";

// ─── Rate library data ──────────────────────────────────────────────────
const RATE_LIBRARY_SEED = [
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

const RATE_LIBRARY_FALLBACK: RateRow[] = RATE_LIBRARY_SEED.map(r => ({
  ...r,
  id: r.code,
  is_custom: false,
  synced_at: new Date().toISOString(),
}));

const CATEGORIES = ["Power", "Lighting", "Switches", "Cabling", "Boards", "Safety", "Data", "Fans", "Ext.", "Testing"] as const;
const UNITS = ["ea", "m", "set", "hr"] as const;

interface RateFormValues {
  code: string;
  category: string;
  description: string;
  unit: string;
  rate: number;
  labour: number;
}

const EMPTY_FORM: RateFormValues = {
  code: "",
  category: "Power",
  description: "",
  unit: "ea",
  rate: 0,
  labour: 0,
};

// ─── Screen ─────────────────────────────────────────────────────────────
export default function PricingScheduleScreen() {
  const { addToast } = useToast();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  // Local rates state — driven by Supabase, falls back to seed data
  const { data: fetchedRates, isLive } = useSupabaseQuery(
    fetchRateLibrary,
    RATE_LIBRARY_FALLBACK,
  );
  const [rates, setRates] = useState<RateRow[] | null>(null);
  // Merge: once live data arrives, use it. Otherwise use the seed fallback.
  const effectiveRates: RateRow[] = rates ?? fetchedRates as RateRow[];

  // Keep local rates in sync when fetchedRates resolves (only on first load)
  const fetchedOnce = useRef(false);
  React.useEffect(() => {
    if (!fetchedOnce.current) {
      fetchedOnce.current = true;
      setRates(fetchedRates as RateRow[]);
    }
  }, [fetchedRates]);

  // ─── Modal state ────────────────────────────────────────────────────
  type ModalMode = "add" | "edit" | null;
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<RateFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openAdd = () => {
    setFormValues(EMPTY_FORM);
    setEditingId(null);
    setModalMode("add");
  };

  const openEdit = (r: RateRow) => {
    setFormValues({
      code: r.code,
      category: r.category,
      description: r.description,
      unit: r.unit,
      rate: r.rate,
      labour: r.labour,
    });
    setEditingId(r.id);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setFormValues(EMPTY_FORM);
  };

  const updateField = (key: keyof RateFormValues, value: string | number) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  // ─── Save (add or edit) ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!formValues.code.trim() || !formValues.description.trim()) {
      addToast("Code and description are required.", "error");
      return;
    }

    setSaving(true);

    const payload: Omit<RateRow, "id" | "synced_at"> = {
      code: formValues.code.trim(),
      category: formValues.category,
      description: formValues.description.trim(),
      unit: formValues.unit,
      rate: Number(formValues.rate) || 0,
      labour: Number(formValues.labour) || 0,
      is_custom: true,
    };

    // Optimistic update
    if (modalMode === "edit" && editingId) {
      const previous = effectiveRates;
      setRates(prev =>
        (prev ?? []).map(r =>
          r.id === editingId ? { ...r, ...payload } : r,
        ),
      );

      const { error } = await upsertRate(payload);
      if (error) {
        setRates(previous as RateRow[]);
        addToast(`Could not save rate: ${error.message ?? "unknown error"}`, "error");
      } else {
        addToast("Rate updated.", "success");
        closeModal();
      }
    } else {
      // Add: optimistic insert with a temp id
      const tempId = `tmp-${Date.now()}`;
      const optimisticRow: RateRow = { ...payload, id: tempId, synced_at: new Date().toISOString() };
      const previous = effectiveRates;
      setRates(prev => [...(prev ?? []), optimisticRow]);

      const { data, error } = await upsertRate(payload);
      if (error) {
        setRates(previous as RateRow[]);
        addToast(`Could not add rate: ${error.message ?? "unknown error"}`, "error");
      } else {
        // Replace temp row with real DB row
        const realId = (data as RateRow | null)?.id ?? tempId;
        setRates(prev =>
          (prev ?? []).map(r => (r.id === tempId ? { ...optimisticRow, id: realId } : r)),
        );
        addToast("Rate added.", "success");
        closeModal();
      }
    }

    setSaving(false);
  };

  // ─── Delete ─────────────────────────────────────────────────────────
  const handleDelete = async (r: RateRow) => {
    if (deletingId) return; // guard concurrent deletes
    setDeletingId(r.id);

    const previous = effectiveRates;
    setRates(prev => (prev ?? []).filter(row => row.id !== r.id));

    const { error } = await deleteRate(r.id);
    if (error) {
      setRates(previous as RateRow[]);
      addToast(`Could not delete rate: ${error.message ?? "unknown error"}`, "error");
    } else {
      addToast(`Rate "${r.code}" deleted.`, "success");
    }

    setDeletingId(null);
  };

  // ─── Derived display data ────────────────────────────────────────────
  const allCategories = useMemo(
    () => ["All", ...Array.from(new Set(effectiveRates.map(r => r.category)))],
    [effectiveRates],
  );

  const filtered = useMemo(
    () =>
      effectiveRates.filter(
        r =>
          (filter === "All" || r.category === filter) &&
          (query === "" ||
            (r.description + " " + r.code).toLowerCase().includes(query.toLowerCase())),
      ),
    [filter, query, effectiveRates],
  );

  const totalItems = effectiveRates.length;
  const avgRate =
    totalItems > 0
      ? Math.round(effectiveRates.reduce((s, r) => s + r.rate + r.labour, 0) / totalItems)
      : 0;
  const maxRate =
    totalItems > 0 ? Math.max(...effectiveRates.map(r => r.rate + r.labour)) : 0;

  // ─── Input style helper ──────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    border: `1px solid ${C.border}`,
    borderRadius: RADIUS.md,
    backgroundColor: C.bgCard,
    fontFamily: FONT.body,
    fontSize: 13,
    color: C.text,
    boxSizing: "border-box",
  };

  return (
    <div className="anim-in">
      {!isLive && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 20,
            backgroundColor: C.amberSoft,
            color: C.amber,
            fontFamily: FONT.heading,
            fontSize: 11,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          Demo data — Supabase tables not yet created
        </div>
      )}
      <PageHeader
        title="Rate library"
        sub={`${totalItems} items · ${isLive ? "live from Supabase" : "imported from Vesh Electrical"} · last synced today`}
        cta={
          <PrimaryButton icon={<Plus size={14} />} onClick={openAdd}>
            Add rate
          </PrimaryButton>
        }
      />

      {/* Quick stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <MiniStat label="Total items" v={String(totalItems)} />
        <MiniStat label="Avg rate" v={`$${avgRate}`} tint={C.blue} />
        <MiniStat label="Highest item" v={`$${maxRate.toLocaleString()}`} tint={C.amber} />
        <MiniStat label="Categories" v={String(allCategories.length - 1)} tint={C.green} />
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
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
          {allCategories.map(cat => (
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
              <Th width={64} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.id}
                className="es-row"
                style={{
                  borderTop: `1px solid ${C.border}`,
                  opacity: deletingId === r.id ? 0.4 : 1,
                  transition: "opacity 150ms",
                }}
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
                <Td align="right" mono>
                  ${r.rate}
                </Td>
                <Td align="right" mono>
                  ${r.labour}
                </Td>
                <Td align="right" mono>
                  <B>${r.rate + r.labour}</B>
                </Td>
                <Td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button
                      title="Edit rate"
                      onClick={() => openEdit(r)}
                      style={{ padding: 4, borderRadius: 4, color: C.textSubtle }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      title="Delete rate"
                      onClick={() => handleDelete(r)}
                      disabled={deletingId === r.id}
                      style={{
                        padding: 4,
                        borderRadius: 4,
                        color: C.amber,
                        opacity: deletingId === r.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === r.id ? (
                        <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
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

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      {modalMode !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
          onClick={e => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            style={{
              backgroundColor: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.xl,
              padding: "28px 32px",
              width: 480,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontFamily: FONT.heading,
                  fontSize: 18,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {modalMode === "add" ? "Add custom rate" : "Edit rate"}
              </h2>
              <button
                onClick={closeModal}
                style={{ color: C.textSubtle, padding: 4, borderRadius: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Fields */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {/* Code */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Code *
                </label>
                <input
                  value={formValues.code}
                  onChange={e => updateField("code", e.target.value)}
                  placeholder="GPO-006"
                  style={inputStyle}
                  disabled={modalMode === "edit"}
                />
              </div>

              {/* Category */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Category
                </label>
                <select
                  value={formValues.category}
                  onChange={e => updateField("category", e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description — full width */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Description *
                </label>
                <input
                  value={formValues.description}
                  onChange={e => updateField("description", e.target.value)}
                  placeholder="Double GPO install (surface)"
                  style={inputStyle}
                />
              </div>

              {/* Unit */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Unit
                </label>
                <select
                  value={formValues.unit}
                  onChange={e => updateField("unit", e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material rate */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Material ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formValues.rate}
                  onChange={e => updateField("rate", parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle, fontFamily: FONT.mono }}
                />
              </div>

              {/* Labour rate */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    display: "block",
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.textSubtle,
                    marginBottom: 5,
                  }}
                >
                  Labour ($)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formValues.labour}
                  onChange={e => updateField("labour", parseFloat(e.target.value) || 0)}
                  style={{ ...inputStyle, fontFamily: FONT.mono }}
                />
              </div>
            </div>

            {/* Total preview */}
            <div
              style={{
                backgroundColor: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: RADIUS.md,
                padding: "10px 14px",
                fontFamily: FONT.mono,
                fontSize: 13,
                color: C.textMuted,
                marginBottom: 20,
              }}
            >
              Total:{" "}
              <span style={{ color: C.text, fontWeight: 600 }}>
                ${(Number(formValues.rate) || 0) + (Number(formValues.labour) || 0)}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <GhostButton onClick={closeModal} disabled={saving}>
                Cancel
              </GhostButton>
              <PrimaryButton
                icon={
                  saving ? (
                    <Loader2
                      size={14}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  ) : (
                    <Check size={14} />
                  )
                }
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : modalMode === "add" ? "Add rate" : "Save changes"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
