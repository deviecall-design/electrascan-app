/**
 * Footer — thin trailing band under every content view.
 *
 * Left: italic tagline (Claude-style serif accent).
 * Right: mono-font version + region label — the small "under the hood"
 * signal that ElectraScan is live data, not a design mock.
 */

import React from "react";
import { C, FONT } from "../../desktop/tokens";

interface FooterProps {
  tagline?: string;
  version?: string;
  region?: string;
}

export default function Footer({
  tagline = "Groundplan measures your plans. ElectraScan reads them — and writes your quote.",
  version = "v0.4.2",
  region = "Sydney",
}: FooterProps) {
  return (
    <div
      style={{
        marginTop: 48,
        paddingTop: 18,
        borderTop: `1px solid ${C.border}`,
        display: "flex",
        justifyContent: "space-between",
        color: C.textSubtle,
        fontSize: 13,
      }}
    >
      <span style={{ fontStyle: "italic" }}>{tagline}</span>
      <span style={{ fontFamily: FONT.mono, fontSize: 12 }}>
        {version} · {region}
      </span>
    </div>
  );
}
