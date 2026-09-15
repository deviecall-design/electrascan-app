import React from "react";

export type DataStatusKind = "loading" | "demo" | "local" | "error" | "empty";

interface DataStatusBannerProps {
  kind: DataStatusKind;
  message: string;
  onRetry?: () => void;
}

const STYLES: Record<DataStatusKind, { bg: string; fg: string; border: string }> = {
  loading: { bg: "#1e3a5c22", fg: "#94a3b8", border: "#334155" },
  demo: { bg: "#f59e0b18", fg: "#f59e0b", border: "#f59e0b55" },
  local: { bg: "#3b82f618", fg: "#93c5fd", border: "#3b82f655" },
  error: { bg: "#ef44440f", fg: "#ef4444", border: "#ef444433" },
  empty: { bg: "#1e293b", fg: "#94a3b8", border: "#334155" },
};

const DataStatusBanner: React.FC<DataStatusBannerProps> = ({ kind, message, onRetry }) => {
  const s = STYLES[kind];
  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 20,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 12,
      }}
    >
      {kind === "loading" && (
        <span
          style={{
            width: 10,
            height: 10,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "es-spin 0.8s linear infinite",
          }}
        />
      )}
      {message}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
            fontSize: 12,
          }}
        >
          Retry
        </button>
      )}
      <style>{`@keyframes es-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DataStatusBanner;
