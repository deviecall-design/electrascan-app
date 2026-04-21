import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileCheck2 } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  Footer,
  Th,
  Td,
} from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";

// ─── Mock data ──────────────────────────────────────────────────────────
// TODO: Replace with Supabase query on `scans` table.
const SCANS = [
  { f: "Switchboard_LV2_rev3.pdf",   c: "Bondi Tower Residences",   s: "Enriching rates",   n: 62, p: 72,  t: "14m ago" },
  { f: "Warehouse_ground_floor.pdf", c: "Parramatta Logistics Hub", s: "Detecting symbols", n: 18, p: 34,  t: "32m ago" },
  { f: "Office_fitout_L8.pdf",       c: "Martin Place Partners",    s: "Finalising",        n: 47, p: 96,  t: "1h ago"  },
  { f: "Shopfit_Chatswood.pdf",      c: "Chatswood Dental Group",   s: "Complete",          n: 28, p: 100, t: "3h ago"  },
  { f: "Mezzanine_rev2.pdf",         c: "Northern Beaches Council", s: "Complete",          n: 94, p: 100, t: "Yesterday" },
];

export default function DetectionScreen() {
  const navigate = useNavigate();

  return (
    <div className="anim-in">
      <PageHeader
        title="Scans"
        sub="Upload a floor plan and let Claude turn it into a costed estimate."
        cta={<PrimaryButton icon={<Plus size={15} strokeWidth={2.5} />}>New scan</PrimaryButton>}
      />

      <Card>
        <table style={{ width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <Th>File</Th>
              <Th>Client</Th>
              <Th>Stage</Th>
              <Th align="right">Items</Th>
              <Th>Progress</Th>
              <Th align="right">Started</Th>
            </tr>
          </thead>
          <tbody>
            {SCANS.map(s => (
              <tr
                key={s.f}
                className="es-row"
                style={{
                  borderTop: `1px solid ${C.border}`,
                  transition: "background-color 120ms",
                  cursor: "pointer",
                }}
              >
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileCheck2 size={16} color={s.p === 100 ? C.green : C.orange} />
                    <span style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 500 }}>{s.f}</span>
                  </div>
                </Td>
                <Td>{s.c}</Td>
                <Td>
                  <span style={{ fontFamily: FONT.heading, fontSize: 13, color: C.textMuted }}>{s.s}</span>
                </Td>
                <Td align="right" mono>
                  <span style={{ fontWeight: 500 }}>{s.n}</span>
                </Td>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: 160 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border, overflow: "hidden" }}>
                      <div style={{ width: `${s.p}%`, height: "100%", backgroundColor: s.p === 100 ? C.green : C.orange }} />
                    </div>
                    <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.textMuted, width: 34 }}>{s.p}%</span>
                  </div>
                </Td>
                <Td align="right" muted>
                  <span style={{ fontStyle: "italic", fontSize: 13 }}>{s.t}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Footer />
    </div>
  );
}
