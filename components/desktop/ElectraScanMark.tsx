/**
 * ElectraScanMark — brand lockup.
 *
 * Anthropic version: solid-orange rounded-square tile containing a white
 * lightning bolt, followed by "ElectraScan" in Poppins 600. No gradient,
 * no split-colour wordmark (those were the dark-theme mobile treatment).
 *
 * Used in the sidebar header. Also rendered in PDF headers via
 * logo-placeholder.svg for tenants without their own logo.
 */

import React from "react";
import { Zap } from "lucide-react";
import { C, FONT, RADIUS } from "./tokens";

interface ElectraScanMarkProps {
  /** Width/height of the square tile in px. Wordmark scales proportionally. */
  size?: number;
  /** Render just the tile (no text). */
  iconOnly?: boolean;
}

export default function ElectraScanMark({ size = 32, iconOnly = false }: ElectraScanMarkProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: RADIUS.md + 2,
          backgroundColor: C.orange,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Zap size={size * 0.5} color="#fff" strokeWidth={2.5} />
      </div>

      {!iconOnly && (
        <span
          style={{
            fontFamily: FONT.heading,
            fontWeight: 600,
            fontSize: size * 0.53,
            letterSpacing: "-0.01em",
            color: C.text,
          }}
        >
          ElectraScan
        </span>
      )}
    </div>
  );
}
