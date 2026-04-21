/**
 * Kpi — dashboard headline metric card. Big Poppins number with up/down
 * delta and Lora-italic sub-line. Use `up` to pick green vs orange delta.
 */

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { C, FONT, RADIUS } from "../../desktop/tokens";

interface KpiProps {
  label: string;
  value: string;
  delta: string;
  sub: string;
  up?: boolean;
}

export default function Kpi({ label, value, delta, sub, up }: KpiProps) {
  return (
    <div
      style={{
        backgroundColor: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: RADIUS.lg,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          fontFamily: FONT.heading,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: C.textSubtle,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div
          style={{
            fontFamily: FONT.heading,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.015em",
          }}
        >
          {value}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 12,
            color: up ? C.green : C.orange,
            fontWeight: 500,
          }}
        >
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: C.textMuted,
          fontStyle: "italic",
          marginTop: 4,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
