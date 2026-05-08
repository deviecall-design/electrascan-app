/**
 * StatusPill — estimate status indicator. Ported from the mockup with the
 * same four states used on the Dashboard and Estimates table.
 *
 *   approved → green
 *   sent     → blue
 *   viewed   → neutral muted
 *   draft    → subtle grey
 *
 * If a status string doesn't match one of these, it falls back to the
 * "draft" treatment with the raw label — callers can extend the map by
 * passing extra states if needed (but prefer adding them here).
 */

import React from "react";
import { CheckCircle2, Send, Eye, FileEdit } from "lucide-react";
import { C, FONT } from "../../desktop/tokens";

export type EstimateStatus = "approved" | "sent" | "viewed" | "draft";

interface StatusPillProps {
  status: EstimateStatus | string;
}

const MAP: Record<EstimateStatus, { bg: string; fg: string; icon: React.ReactNode; label: string }> = {
  approved: { bg: C.greenSoft,  fg: C.green,     icon: <CheckCircle2 size={11} />, label: "Approved" },
  sent:     { bg: C.blueSoft,   fg: C.blue,      icon: <Send size={11} />,         label: "Sent" },
  viewed:   { bg: C.borderSoft, fg: C.textMuted, icon: <Eye size={11} />,          label: "Viewed" },
  draft:    { bg: C.bgSoft,     fg: C.textSubtle, icon: <FileEdit size={11} />,    label: "Draft" },
};

export default function StatusPill({ status }: StatusPillProps) {
  const conf =
    (MAP as Record<string, typeof MAP.approved>)[status] ??
    { bg: C.bgSoft, fg: C.textSubtle, icon: null, label: status };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: FONT.heading,
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 9px",
        borderRadius: 10,
        backgroundColor: conf.bg,
        color: conf.fg,
      }}
    >
      {conf.icon}
      {conf.label}
    </span>
  );
}
