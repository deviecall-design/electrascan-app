/**
 * Table primitives — `Th` and `Td` with ElectraScan defaults baked in.
 *
 *   <Th>           → Poppins 11px uppercase 0.08em label in --es-text-subtle
 *   <Th align="right"> → right-aligned variant for numeric columns
 *   <Th width={32}>   → tight column for action icons
 *
 *   <Td>           → Lora 14px text
 *   <Td mono>      → JetBrains Mono — use for rate codes, prices, dates
 *   <Td muted>     → text in --es-text-muted (secondary columns)
 *   <Td align="right"> → right-aligned numeric cell
 */

import React from "react";
import { C, FONT } from "../../desktop/tokens";

type Align = "left" | "right" | "center";

interface ThProps {
  children?: React.ReactNode;
  align?: Align;
  width?: number | string;
}

export function Th({ children, align = "left", width }: ThProps) {
  return (
    <th
      style={{
        fontFamily: FONT.heading,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: C.textSubtle,
        textAlign: align,
        padding: "12px 20px",
        width,
      }}
    >
      {children}
    </th>
  );
}

interface TdProps {
  children?: React.ReactNode;
  align?: Align;
  mono?: boolean;
  muted?: boolean;
}

export function Td({ children, align = "left", mono, muted }: TdProps) {
  return (
    <td
      style={{
        padding: "14px 20px",
        textAlign: align,
        fontFamily: mono ? FONT.mono : FONT.body,
        color: muted ? C.textMuted : C.text,
        fontSize: 14,
      }}
    >
      {children}
    </td>
  );
}
