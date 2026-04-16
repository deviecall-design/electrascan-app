/**
 * Placeholder panel for screens that haven't been built yet.
 * Used during Phase 1 (foundation) to prove routing works before each
 * screen gets its real UI in later phases.
 */

import React from "react";
import { C, FONT } from "../components/desktop/tokens";

interface ScreenPlaceholderProps {
  title: string;
  phase: string;           // e.g. "Phase 2 — Foundation"
  description?: string;
}

export default function ScreenPlaceholder({ title, phase, description }: ScreenPlaceholderProps) {
  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: FONT.stack,
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
          Desktop workflow · {phase}
        </div>
      </div>

      {/* Empty-state card */}
      <div
        style={{
          background: C.card,
          border: `1px dashed ${C.border}`,
          borderRadius: 16,
          padding: "64px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>
          {title} screen — coming in {phase}
        </div>
        {description && (
          <div style={{ fontSize: 13, color: C.muted, maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
