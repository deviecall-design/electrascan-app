import React from "react";
import { C } from "./tokens";
import { formatAud } from "../../lib/quoteTotals";
import type { LedgerWeek } from "../../lib/jobLedger";

export interface ChartMilestone {
  label: string;
  amount: number;
  status: string;
  weekIndex: number;
}

const SERIES = [
  { key: "remaining", label: "Remaining budget", color: "#1f56e6" },
  { key: "planned", label: "Planned burn", color: "#64748b" },
  { key: "cost", label: "Cumulative cost", color: "#0f172a" },
  { key: "claimed", label: "Claimed / invoiced", color: "#059669" },
] as const;

export default function LedgerChart({
  weeks,
  milestones,
  format,
  axis,
}: {
  weeks: LedgerWeek[];
  milestones: ChartMilestone[];
  format: (value: number) => string;
  axis?: (value: number) => string;
}) {
  if (weeks.length < 2) {
    return <p style={{ color: C.textMuted, margin: 0 }}>Add job dates or a cost to draw the weeks.</p>;
  }
  const values = weeks.flatMap(week => [week.remaining, week.plannedCumulative, week.cumulativeCost, week.cumulativeClaimed]);
  const max = Math.max(1, ...values);
  const width = 700;
  const height = 240;
  const left = 78;
  const right = 16;
  const top = 16;
  const bottom = 36;
  const xAt = (index: number) => left + (index / (weeks.length - 1)) * (width - left - right);
  const yAt = (value: number) => top + (1 - Math.min(Math.max(value, 0), max) / max) * (height - top - bottom);
  const line = (pick: (week: LedgerWeek) => number) => weeks.map((week, index) => `${xAt(index)},${yAt(pick(week))}`).join(" ");
  const ahead = weeks.map((week, index) => ({ index, week })).filter(point => point.week.ahead);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: 520 }} role="img" aria-label="Job ledger">
        {[0, 0.5, 1].map(frac => {
          const y = yAt(frac * max);
          return (
            <g key={frac}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke={C.border} />
              <text x={left - 8} y={y + 4} fontSize="10" fill={C.textSubtle} textAnchor="end">{(axis || (value => `$${formatAud(value)}`))(frac * max)}</text>
            </g>
          );
        })}
        {ahead.map(point => (
          <rect key={point.week.start} x={xAt(point.index) - 8} y={top} width="16" height={height - top - bottom} fill="#e11d48" opacity="0.12" />
        ))}
        <polyline points={line(week => week.plannedCumulative)} fill="none" stroke="#64748b" strokeDasharray="5 4" strokeWidth="2" />
        <polyline points={line(week => week.remaining)} fill="none" stroke="#1f56e6" strokeWidth="2.5" />
        <polyline points={line(week => week.cumulativeCost)} fill="none" stroke="#0f172a" strokeWidth="2.5" />
        <polyline points={line(week => week.cumulativeClaimed)} fill="none" stroke="#059669" strokeWidth="2" />
        {milestones.map(mark => (
          <g key={mark.label}>
            <line x1={xAt(mark.weekIndex)} y1={top} x2={xAt(mark.weekIndex)} y2={height - bottom} stroke={C.amber} strokeDasharray="2 3" />
            <circle cx={xAt(mark.weekIndex)} cy={top + 6} r="4" fill={C.amber}>
              <title>{`${mark.label}: ${format(mark.amount)} · ${mark.status}`}</title>
            </circle>
          </g>
        ))}
        {weeks.map((week, index) => (
          <text key={week.start} x={xAt(index)} y={height - 12} fontSize="10" fill={C.textSubtle} textAnchor="middle">{week.label}</text>
        ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: C.textMuted }}>
        {SERIES.map(item => (
          <span key={item.key}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: item.color, marginRight: 6 }} />{item.label}</span>
        ))}
        <span>Red band: cost is ahead of the plan</span>
      </div>
    </div>
  );
}
