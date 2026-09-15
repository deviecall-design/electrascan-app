import React, { useEffect, useState } from "react";
import { C, FONT } from "./desktop/tokens";

/**
 * Shows the drawing the user actually uploaded.
 *
 * The desktop Detect step previously rendered a fake OFFICE A / BOARDROOM SVG
 * with synthetic marker positions. That is why the overlay did not match
 * Sirius (or any) plans. Until vision emits x/y (or BlueprintCanvas is
 * remounted), pins live in the item list — not on this preview.
 */
export default function SourcePlanPreview({
  file,
  fileName,
}: {
  file: File | null;
  fileName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  if (!file || !url) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          color: C.textMuted,
          fontStyle: "italic",
          fontSize: 13,
        }}
      >
        Upload a floor plan to preview the source drawing here. Detection
        counts are listed on the right — they are not pinned onto a mock office.
      </div>
    );
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  return (
    <div>
      {isPdf ? (
        <embed
          src={url}
          type="application/pdf"
          title={fileName ?? file.name}
          style={{ width: "100%", height: 520, border: "none", display: "block" }}
        />
      ) : (
        <img
          src={url}
          alt={fileName ?? file.name}
          style={{ width: "100%", display: "block" }}
        />
      )}
      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          color: C.textSubtle,
          fontFamily: FONT.heading,
          borderTop: `1px solid ${C.border}`,
          backgroundColor: C.bg,
        }}
      >
        Source drawing{fileName ? ` · ${fileName}` : ""}. Counts come from the
        legend/scan list — markers are not registered to drawing coordinates yet.
      </div>
    </div>
  );
}
