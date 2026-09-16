/**
 * EmptyState — dashed navy panel with one honest next action.
 *
 * Used on Dashboard / Scans / Estimates when the live list is empty.
 * Primary CTA language is AU estimating: Upload plan / New scan.
 */

import React from "react";
import { FilePlus } from "lucide-react";
import { C, FONT, RADIUS } from "../../desktop/tokens";
import { PrimaryButton } from "./Button";

interface EmptyStateProps {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title,
  body,
  ctaLabel = "Upload plan",
  onCta,
  icon,
}: EmptyStateProps) {
  return (
    <div
      style={{
        border: `1px dashed ${C.border}`,
        borderRadius: RADIUS.lg,
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
        backgroundColor: C.bgSoft,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: C.orangeSoft,
          color: C.orange,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        {icon ?? <FilePlus size={26} strokeWidth={1.5} />}
      </div>
      <div
        style={{
          fontFamily: FONT.heading,
          fontSize: 16,
          fontWeight: 600,
          color: C.text,
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 14,
          color: C.textMuted,
          margin: "0 0 10px",
          maxWidth: 420,
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
      <PrimaryButton onClick={onCta}>{ctaLabel}</PrimaryButton>
    </div>
  );
}
