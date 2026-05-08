/**
 * SectionHead — h2-level header used inside a PageHeader'd view to separate
 * sections (e.g. "Active scans" / "Recent estimates" on the Dashboard).
 *
 * Left: Poppins 17px heading. Right (optional): orange text-link with an
 * up-right arrow — the canonical ElectraScan "jump to full view" affordance.
 */

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { C, FONT } from "../../desktop/tokens";

interface SectionHeadProps {
  title: string;
  cta?: string;
  onCta?: () => void;
}

export default function SectionHead({ title, cta, onCta }: SectionHeadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontFamily: FONT.heading,
          fontSize: 17,
          fontWeight: 600,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      {cta && (
        <button
          onClick={onCta}
          className="es-link"
          style={{
            fontSize: 13,
            color: C.orange,
            fontFamily: FONT.heading,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {cta} <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}
