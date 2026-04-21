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
}

export default function PageHeader({ title, sub, cta }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginBottom: 28,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: FONT.heading,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "0 0 6px 0",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        {sub && (
          <p style={{ color: C.textMuted, fontStyle: "italic", margin: 0 }}>
            {sub}
          </p>
        )}
      </div>
      {cta}
    </div>
  );
}
