/**
 * MiniStat — smaller KPI variant on a soft beige background. Used for
 * secondary metric strips (Estimates screen, Scan quote sidebar totals).
 * Pass `tint` to swap the value colour for semantic emphasis (green for
 * positive, orange for warnings).
 */

import React from "react";
import { C, FONT, RADIUS } from "../../desktop/tokens";

interface MiniStatProps {
  label: string;
  v: string;
  tint?: string;
}

export default function MiniStat({ label, v, tint }: MiniStatProps) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: RADIUS.md + 2,
        backgroundColor: C.bgSoft,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.heading,
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: C.textSubtle,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT.heading,
          fontSize: 17,
          fontWeight: 600,
          color: tint || C.text,
          letterSpacing: "-0.01em",
        }}
      >
        {v}
      </div>
    </div>
  );
}
