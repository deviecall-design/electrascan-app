/**
 * SymbolBadge — small coloured tile identifying a detected symbol type
 * (GPO, LT, SW, DB, SA, FN, DC). Used in the live-detection list and the
 * Review table.
 *
 * Colour mapping sourced from the mockup. `small` renders a 24×24 tile for
 * table cells; the default 32×32 is used in the detection sidebar.
 *
 * The tile uses a tinted semi-transparent variant of the base colour —
 * `color + "22"` is the 13% alpha overlay, matching the mockup exactly.
 */

import React from "react";
import { C, FONT, RADIUS } from "../../desktop/tokens";

interface SymbolBadgeProps {
  symbol: string;
  small?: boolean;
}

const SYMBOL_COLOURS: Record<string, string> = {
  GPO: C.orange,
  LT:  C.amber,
  SW:  C.blue,
  DB:  C.green,
  SA:  C.orange,
  FN:  C.blue,
  DC:  C.green,
};

export default function SymbolBadge({ symbol, small }: SymbolBadgeProps) {
  const sz = small ? 24 : 32;
  const colour = SYMBOL_COLOURS[symbol] ?? C.textSubtle;

  return (
    <div
      style={{
        width: sz,
        height: sz,
        borderRadius: RADIUS.md,
        backgroundColor: colour + "22",
        color: colour,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT.heading,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
      }}
    >
      {symbol}
    </div>
  );
}
