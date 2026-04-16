/**
 * ElectraScan brand mark — lightning bolt icon + wordmark.
 *
 * Used in the top nav of the desktop shell, as well as PDF headers
 * (via the logo-placeholder.svg asset for tenants without their own).
 *
 * The mark is SVG-based so it scales crisply at any size.
 */

import React from "react";

interface ElectraScanMarkProps {
  size?: number;           // Icon size in px (wordmark scales proportionally)
  showWordmark?: boolean;  // Set false to render just the bolt
  accentColor?: string;    // Default: ElectraScan blue
}

export default function ElectraScanMark({
  size = 32,
  showWordmark = true,
  accentColor = "#1D6EFD",
}: ElectraScanMarkProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      {/* Bolt icon in rounded-square tile */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          background: `linear-gradient(135deg, ${accentColor}, #4B8FFF)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6}>
          <path
            d="M 13 2 L 4 14 L 11 14 L 9 22 L 20 10 L 13 10 Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeLinejoin="round"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <div
          style={{
            fontSize: size * 0.62,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            display: "flex",
            gap: size * 0.04,
          }}
        >
          <span style={{ color: accentColor }}>Electra</span>
          <span style={{ color: "#EDF2FF" }}>Scan</span>
        </div>
      )}
    </div>
  );
}
