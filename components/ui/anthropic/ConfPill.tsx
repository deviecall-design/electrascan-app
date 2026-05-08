/**
 * ConfPill — confidence indicator for detected symbols.
 *
 *   c >= 0.9 → green
 *   c >= 0.8 → amber
 *   c <  0.8 → orange (flag for review)
 *
 * `withBar` renders the horizontal track + % (used in the Review table
 * where columns are wider). Otherwise renders as a compact pill (used in
 * the live-detection sidebar during Step 2).
 */

import React from "react";
import { C, FONT } from "../../desktop/tokens";

interface ConfPillProps {
  c: number; // 0..1
  withBar?: boolean;
}

export default function ConfPill({ c, withBar }: ConfPillProps) {
  const pct = Math.round(c * 100);
  const tone = c >= 0.9 ? C.green : c >= 0.8 ? C.amber : C.orange;

  if (withBar) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: C.border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              backgroundColor: tone,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: C.textMuted,
            width: 30,
          }}
        >
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: 10,
        backgroundColor: tone + "22",
        color: tone,
      }}
    >
      {pct}%
    </span>
  );
}
