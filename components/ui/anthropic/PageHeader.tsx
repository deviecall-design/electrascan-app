/**
 * PageHeader — the top of every content view.
 *
 * Title in Poppins 30px, optional Lora-italic subtitle, optional right-aligned
 * CTA. Used on Dashboard, Scans list, Estimates, Rate library. Not used on
 * sub-views like scan detail (those use inline `<h1>` + breadcrumb).
 */

import React from "react";
import { C, FONT } from "../../desktop/tokens";

interface PageHeaderProps {
  title: string;
  sub?: string;
  cta?: React.ReactNode;
  crumb?: React.ReactNode;
}

export default function PageHeader({ title, sub, cta, crumb }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 28,
        flexWrap: "wrap",
      }}
    >
      <div>
        {crumb && (
          <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: C.textMuted }}>
            {crumb}
          </div>
        )}
        <h1
          style={{
            fontFamily: FONT.heading,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        {sub && (
          <p style={{ color: C.textMuted, margin: "6px 0 0 0", maxWidth: 640 }}>
            {sub}
          </p>
        )}
      </div>
      {cta && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{cta}</div>}
    </div>
  );
}
