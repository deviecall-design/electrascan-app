/**
 * ScanRow — list item summarising an in-progress scan.
 *
 * Structure:
 *   Row 1 — file name (Poppins 14/500) + italic client + right-aligned progress %
 *   Row 2 — thin progress bar (orange fill, 3px track)
 *   Row 3 — current stage label (e.g. "Detecting symbols", "Enriching rates")
 *
 * Used on the Dashboard "Active scans" card; reused on the Scans list.
 */

import React from "react";
import { C, FONT, RADIUS } from "../../desktop/tokens";

interface ScanRowProps {
  file: string;
  client: string;
  progress: number;   // 0..100
  stage: string;
  divider?: boolean;  // top border (use on all rows except the first in a Card)
  onClick?: () => void;
}

export default function ScanRow({ file, client, progress, stage, divider, onClick }: ScanRowProps) {
  const complete = progress >= 100;
  return (
    <div
      className="es-row"
      onClick={onClick}
      style={{
        padding: "16px 20px",
        borderTop: divider ? `1px solid ${C.border}` : "none",
        transition: "background-color 120ms",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.heading,
              fontSize: 14,
              fontWeight: 500,
              color: C.text,
              marginBottom: 2,
            }}
          >
            {file}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>
            {client}
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT.heading,
            fontSize: 13,
            fontWeight: 500,
            color: C.text,
            marginLeft: 12,
          }}
        >
          {progress}%
        </div>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: RADIUS.sm / 2,
          backgroundColor: C.border,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            backgroundColor: complete ? C.green : C.orange,
            transition: "width 400ms",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 12,
          color: C.textSubtle,
          marginTop: 8,
          fontFamily: FONT.heading,
        }}
      >
        {stage}
      </div>
    </div>
  );
}
