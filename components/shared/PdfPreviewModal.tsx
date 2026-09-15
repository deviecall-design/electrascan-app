import React, { useEffect, useMemo } from "react";
import { triggerDownload } from "../../utils/quoteExport";

const C = {
  navy: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  blue: "#3b82f6",
  text: "#f1f5f9",
  muted: "#94a3b8",
};

interface PdfPreviewModalProps {
  open: boolean;
  title: string;
  blob: Blob | null;
  filename: string;
  error?: string | null;
  loading?: boolean;
  onClose: () => void;
}

const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  open,
  title,
  blob,
  filename,
  error,
  loading,
  onClose,
}) => {
  const url = useMemo(() => {
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(2, 6, 23, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(920px, 100%)",
          height: "min(88vh, 960px)",
          background: C.navy,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `1px solid ${C.border}`,
            background: C.card,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
            <div style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {filename}
            </div>
          </div>
          <button
            type="button"
            disabled={!blob}
            onClick={() => blob && triggerDownload(blob, filename)}
            style={{
              background: blob ? C.blue : C.border,
              color: "#fff",
              border: "none",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: blob ? "pointer" : "not-allowed",
            }}
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              color: C.muted,
              border: `1px solid ${C.border}`,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
        <div style={{ flex: 1, background: "#0b1220", minHeight: 0 }}>
          {loading && (
            <div style={{ color: C.muted, padding: 40, textAlign: "center" }}>Generating PDF…</div>
          )}
          {!loading && error && (
            <div style={{ color: "#ef4444", padding: 40, textAlign: "center", fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && url && (
            <iframe
              title={title}
              src={url}
              style={{ width: "100%", height: "100%", border: "none", background: "#525659" }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfPreviewModal;
