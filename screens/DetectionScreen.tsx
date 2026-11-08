import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
  PageHeader,
  Card,
  Footer,
  EmptyState,
} from "../components/ui/anthropic";
import { scanListStatus } from "../lib/scanRecord";
import { publicScanFailure } from "../lib/scanFailure";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import { fetchScans } from "../services/supabaseData";
import QueryBanner from "../components/QueryBanner";
import ScanFailure from "../components/ScanFailure";
import { formatAuShortDateTime } from "../lib/dates";
import { displayClient } from "../lib/jobLink";

export default function DetectionScreen() {
  const navigate = useNavigate();

  const { data: liveScans, loading, error, errorMessage, reload } = useSupabaseQuery(fetchScans);

  return (
    <div className="anim-in">
      {!error && <QueryBanner loading={loading} error={false} noun="scans" />}
      <PageHeader
        title="Upload plans"
        sub="Upload a floor plan and ElectraScan AI will turn it into a costed estimate."
        cta={
          <PrimaryButton
            icon={<Plus size={15} strokeWidth={2.5} />}
            onClick={() => navigate("/detection/new")}
          >
            New scan
          </PrimaryButton>
        }
      />

      {loading ? (
        <Card>
          <div style={{ padding: 18, color: C.textMuted, fontStyle: "italic", fontSize: 14 }}>
            Loading scans…
          </div>
        </Card>
      ) : error ? (
        <ScanFailure
          title="Scans could not be loaded"
          body={publicScanFailure(
            errorMessage,
            "The scan list did not come back. Nothing on this page is sample data. Try again in a moment.",
          )}
          onRetry={reload}
          retryTone="ghost"
        />
      ) : liveScans.length === 0 ? (
        <EmptyState
          title="No scans yet"
          body="Upload your first plan to start a scan and generate an estimate."
          ctaLabel="Upload plan"
          onCta={() => navigate("/detection/new")}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {liveScans.map((s: any) => {
            const status = scanListStatus(s);
            return (
              <Card key={s.id ?? s.file_name}>
                <div style={{ height: 88, background: "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)", backgroundSize: "16px 16px", backgroundColor: "#f8fafc" }} />
                <div style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: FONT.heading, fontWeight: 600 }}>{s.file_name ?? "Untitled scan"}</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}>{displayClient({ client: s.client, fileName: s.file_name })}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: status === "Needs review" ? C.amber : C.green }}>{status}</span>
                  </div>
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textMuted }}>
                    <span>{s.items_detected ?? 0} items · {formatAuShortDateTime(s.started_at)}</span>
                    <button type="button" onClick={() => navigate(`/detection/${s.id}`)} style={{ color: C.orange, fontWeight: 600 }}>Open →</button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Footer />
    </div>
  );
}
