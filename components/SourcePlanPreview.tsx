import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C, FONT } from "./desktop/tokens";
import { mupdfController } from "../utils/mupdfController";
import { isPdfFile, planPageLabel } from "../lib/planPage";

/**
 * Detect-step drawing: the uploaded PDF rendered with MuPDF (same engine as
 * BlueprintCanvas / the Apr 2026 takeoff canvas).
 *
 * Bisect: 13 May production (fc11733) mounted App.tsx against the real file.
 * 27 May merge 576d75e switched index.tsx to DesktopApp's fake OFFICE A SVG.
 * Pins still have no vision x/y — this restores the drawing, not a symbol map.
 */

export default function SourcePlanPreview({
  file,
  fileName,
}: {
  file: File | null;
  fileName?: string;
}) {
  if (!file) {
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
        Upload a floor plan to preview the source drawing here.
      </div>
    );
  }

  if (!isPdfFile(file)) {
    return <ImagePreview file={file} fileName={fileName} />;
  }

  return <MuPdfPreview file={file} fileName={fileName} />;
}

function ImagePreview({ file, fileName }: { file: File; fileName?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url) return null;
  return (
    <div>
      <img
        src={url}
        alt={fileName ?? file.name}
        style={{ width: "100%", display: "block" }}
      />
      <Footer label={planPageLabel(fileName ?? file.name, 0, 1)} />
    </div>
  );
}

function MuPdfPreview({ file, fileName }: { file: File; fileName?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPageIndex(0);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const count = await mupdfController.loadDocument(new Uint8Array(buf));
        if (cancelled) return;
        setPageCount(count);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not render PDF with MuPDF.");
        setEmbedUrl(URL.createObjectURL(file));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (embedUrl) URL.revokeObjectURL(embedUrl);
    };
  }, [embedUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pageCount <= 0 || error) return;
    let cancelled = false;
    mupdfController
      .renderPageToCanvas(pageIndex, canvas, 1.5)
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Render failed.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex, pageCount, error]);

  const label = planPageLabel(fileName ?? file.name, pageIndex, pageCount || 1);

  if (error && embedUrl) {
    return (
      <div>
        <embed
          src={embedUrl}
          type="application/pdf"
          title={fileName ?? file.name}
          style={{ width: "100%", height: 520, border: "none", display: "block" }}
        />
        <Footer label={`${label} · browser viewer (MuPDF unavailable)`} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflow: "auto", maxHeight: 520, backgroundColor: "#fff" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>
      <div
        style={{
          padding: "8px 14px",
          fontSize: 11,
          color: C.textSubtle,
          fontFamily: FONT.heading,
          borderTop: `1px solid ${C.border}`,
          backgroundColor: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{label}</span>
        {pageCount > 1 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className="es-link"
              disabled={pageIndex <= 0}
              onClick={() => setPageIndex(i => Math.max(0, i - 1))}
              style={{ display: "inline-flex", opacity: pageIndex <= 0 ? 0.4 : 1 }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="es-link"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => setPageIndex(i => Math.min(pageCount - 1, i + 1))}
              style={{ display: "inline-flex", opacity: pageIndex >= pageCount - 1 ? 0.4 : 1 }}
            >
              <ChevronRight size={14} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function Footer({ label }: { label: string }) {
  return (
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
      {label}
    </div>
  );
}
