import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { C, FONT, RADIUS } from "./desktop/tokens";
import { GhostButton, PrimaryButton } from "./ui/anthropic/Button";

interface ScanFailureProps {
  title: string;
  body: string;
  onRetry?: () => void;
  retryLabel?: string;
  retryTone?: "primary" | "ghost";
}

/** Full-panel failure for a scan list, open, or save. One next action. */
export default function ScanFailure({
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  retryTone = "primary",
}: ScanFailureProps) {
  const Button = retryTone === "ghost" ? GhostButton : PrimaryButton;
  return (
    <div
      role="alert"
      className="anim-in"
      style={{
        backgroundColor: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: RADIUS.xl,
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: C.redSoft,
          color: C.red,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <AlertCircle size={26} strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: FONT.heading, fontSize: 16, fontWeight: 600, color: C.text }}>
        {title}
      </div>
      <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 10px", maxWidth: 440, lineHeight: 1.55 }}>
        {body}
      </p>
      {onRetry ? (
        <Button onClick={onRetry} icon={<RefreshCw size={15} />}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
