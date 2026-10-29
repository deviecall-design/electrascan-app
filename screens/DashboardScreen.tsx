import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  FileText,
  DollarSign,
  Target,
  Clock,
  AlertTriangle,
  Send,
  ChevronRight,
  ScanLine,
} from "lucide-react";
import { C, FONT } from "../components/desktop/tokens";
import {
  Card,
  Footer,
  EmptyState,
} from "../components/ui/anthropic";
import { PrimaryButton } from "../components/ui/anthropic/Button";
import useSupabaseQuery from "../hooks/useSupabaseQuery";
import {
  fetchEstimates,
  fetchScans,
  formatScanToQuote,
} from "../services/supabaseData";
import { tenantBrandName } from "../services/companyProfile";
import useOptionalAuthUser, {
  firstNameFromDisplay,
  nameFromAuthUser,
} from "../hooks/useOptionalAuthUser";
import {
  computeDashboardMoneyStats,
  formatQuotedValue,
  formatPipelineKpi,
} from "../lib/estimateMoney";
import { ariesPipelineInsight } from "../lib/ariesSuggestion";
import QueryBanner from "../components/QueryBanner";
import { timeGreeting } from "../lib/greeting";
import { scanListStatus } from "../lib/scanRecord";
import { attentionFromPipeline } from "../lib/pipelineAttention";
import { linesFromDetected, materialsExGst, reviewTakeoffIncGst } from "../lib/variationDiff";
import { formatAuShortDateTime } from "../lib/dates";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Reviewed: { bg: C.greenSoft, fg: C.green },
  "Needs review": { bg: C.amberSoft, fg: C.amber },
  Quoted: { bg: C.orangeSoft, fg: C.orange },
  "In progress": { bg: C.bgSoft, fg: C.textMuted },
};

export default function DashboardScreen() {
  const navigate = useNavigate();
  const brand = tenantBrandName();
  const authName = nameFromAuthUser(useOptionalAuthUser());
  const greetName = firstNameFromDisplay(authName || brand);

  const {
    data: liveEstimates,
    isLive: estimatesLive,
    loading: estimatesLoading,
    error: estimatesError,
  } = useSupabaseQuery(fetchEstimates);
  const {
    data: liveScans,
    loading: scansLoading,
    error: scansError,
  } = useSupabaseQuery(fetchScans);

  const loading = estimatesLoading || scansLoading;
  const loadError = estimatesError || scansError;
  const recentScans = liveScans.slice(0, 5);

  const stats = useMemo(
    () => computeDashboardMoneyStats(liveEstimates, liveScans),
    [liveEstimates, liveScans],
  );
  const reviewValue = useMemo(() => reviewTakeoffIncGst(liveScans), [liveScans]);
  const showReviewTakeoff = !loading && stats.pendingValue <= 0 && reviewValue > 0;

  const attention = useMemo(
    () => attentionFromPipeline(liveScans, liveEstimates),
    [liveScans, liveEstimates],
  );

  const ariesCopy = loading
    ? "Loading pipeline figures."
    : estimatesError
      ? "Could not load estimates. Pending value stays at zero until a quote is saved from a scan."
      : showReviewTakeoff
        ? `Takeoff in review is ${formatQuotedValue(reviewValue)} inc GST. It stays off pending value until a quote is sent.`
        : ariesPipelineInsight({
            isLive: estimatesLive,
            pendingValue: stats.pendingValue,
            estimateCount: liveEstimates.length,
          });

  const fmtPct = (n: number | null) => (n == null ? "—" : `${n}%`);
  const emptyPipeline = !loading && liveEstimates.length === 0 && liveScans.length === 0;

  return (
    <div className="anim-in">
      <QueryBanner loading={loading} error={loadError} noun="estimates and scans" />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: FONT.heading, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            {timeGreeting(greetName)}
          </h1>
          <p style={{ color: C.textMuted, margin: "6px 0 0 0", maxWidth: 640 }}>
            {emptyPipeline
              ? "Your quoting pipeline is empty. Upload a plan to start the first scan."
              : "Your quoting pipeline at a glance. Pick up where you left off, or start a new scan."}
          </p>
        </div>
        <PrimaryButton icon={<ScanLine size={18} />} onClick={() => navigate("/detection/new")}>
          New scan
        </PrimaryButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Kpi label="Estimates this month" value={loading ? "—" : String(stats.estimatesThisMonth)} hint="This month" icon={<FileText size={18} />} />
        <Kpi
          label={showReviewTakeoff ? "Takeoff in review" : "Pending value"}
          value={loading ? "—" : formatPipelineKpi(showReviewTakeoff ? reviewValue : stats.pendingValue)}
          hint={showReviewTakeoff ? "Not sent for signature" : "Sent + viewed, inc GST"}
          icon={<DollarSign size={18} />}
        />
        <Kpi label="Win rate" value={loading ? "—" : fmtPct(stats.winRate)} hint="Closed, last 90 days" icon={<Target size={18} />} accent={C.green} />
        <Kpi label="Avg scan-to-quote" value={loading ? "—" : formatScanToQuote(stats.avgScanToQuoteMs)} hint="Across linked scans" icon={<Clock size={18} />} />
      </div>

      <div className="es-split">
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Continue where you left off</h2>
            <button type="button" onClick={() => navigate("/detection")} style={{ color: C.orange, fontWeight: 600, fontSize: 14 }}>
              All scans →
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 18, color: C.textMuted }}>Loading scans…</div>
          ) : liveScans.length === 0 ? (
            <div style={{ padding: 12 }}>
              <EmptyState
                title="No scans yet"
                body="Upload your first plan to start a scan and generate an estimate."
                ctaLabel="Upload plan"
                onCta={() => navigate("/detection/new")}
              />
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {recentScans.map((scan: any) => {
                const status = scanListStatus(scan);
                const tone = STATUS_TONE[status];
                const when = formatAuShortDateTime(scan.started_at);
                return (
                  <li key={scan.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/detection/${scan.id}`)}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 20px",
                        textAlign: "left",
                        minHeight: 64,
                      }}
                    >
                      <span style={{ width: 40, height: 40, borderRadius: 12, background: C.orangeSoft, color: C.orange, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <ScanLine size={18} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {scan.file_name || "Untitled scan"}
                        </span>
                        <span style={{ fontSize: 13, color: C.textMuted }}>
                          {[
                            scan.client,
                            scan.items_detected != null ? `${scan.items_detected} items` : null,
                            formatQuotedValue(materialsExGst(linesFromDetected(scan.detected_items))) + " materials",
                            when !== "—" ? when : null,
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span style={{ borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600, background: tone.bg, color: tone.fg }}>{status}</span>
                      <ChevronRight size={18} color={C.textSubtle} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderRadius: 16, padding: 22, background: `linear-gradient(135deg, ${C.ink}, ${C.ink2})`, color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#dbe6ff" }}>
              <Sparkles size={16} /> Aries insight
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.45 }}>{ariesCopy}</p>
            <button
              type="button"
              onClick={() => navigate(liveScans[0]?.id ? `/detection/${liveScans[0].id}` : liveEstimates.length === 0 ? "/detection/new" : "/pricing-schedule")}
              style={{
                marginTop: 16,
                minHeight: 44,
                padding: "0 14px",
                borderRadius: 12,
                background: "#eef4ff",
                color: C.orangeDark,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {liveScans[0]?.id ? "Open takeoff" : liveEstimates.length === 0 ? "Upload plan" : "Review rates"} <ArrowRight size={16} />
            </button>
          </div>

          <Card style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Needs your attention</h2>
            {loading ? (
              <p style={{ color: C.textMuted, fontSize: 14 }}>Loading…</p>
            ) : attention.length === 0 ? (
              liveEstimates.length === 0 ? (
                <div style={{ marginTop: 8 }}>
                  <EmptyState
                    title="No estimates yet"
                    body="Quotes land here after you send one from a scan."
                    ctaLabel="Upload plan"
                    onCta={() => navigate("/detection/new")}
                  />
                </div>
              ) : (
                <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 0 }}>Nothing is waiting on you.</p>
              )
            ) : (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {attention.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item.to)}
                      style={{ display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", fontSize: 14, minHeight: 44 }}
                    >
                      {item.tone === "warning"
                        ? <AlertTriangle size={18} color={C.amber} />
                        : <Send size={18} color={C.orange} />}
                      <span>{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Kpi({ label, value, hint, icon, accent }: { label: string; value: string; hint: string; icon: React.ReactNode; accent?: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>{label}</span>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: C.bgSoft, color: C.textMuted, display: "grid", placeItems: "center" }}>{icon}</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: accent || C.text, fontFamily: FONT.heading }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: C.textMuted }}>{hint}</div>
    </Card>
  );
}
