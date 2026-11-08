import React from "react";
import { C } from "./tokens";
import { formatAud } from "../../lib/quoteTotals";
import { remainingAt, type LedgerWeek } from "../../lib/jobLedger";

export interface ChartMilestone {
  label: string;
  amount: number;
  status: string;
  weekIndex: number;
}

/**
 * Remaining-budget chart from the April project reports:
 * planned remaining is a dashed line, actual remaining is solid through
 * the weeks already reached, and a dashed forecast continues to the end.
 */
export default function LedgerChart({
  weeks,
  milestones,
  format,
  axis,
  baseline,
  today,
  forecastRemaining,
}: {
  weeks: LedgerWeek[];
  milestones: ChartMilestone[];
  format: (value: number) => string;
  axis?: (value: number) => string;
  baseline: number;
  today: string;
  forecastRemaining: number;
}) {
  if (weeks.length < 2) {
    return <p style={{ color: C.textMuted, margin: 0 }}>Add job dates or a cost to draw the weeks.</p>;
  }
  const points = weeks.map(week => remainingAt(week, baseline, today));
  const max = Math.max(baseline, 1, ...points.flatMap(point => [point.planned, point.actual ?? 0]), ...weeks.map(week => week.cumulativeClaimed));
  const width = 700;
  const height = 240;
  const left = 78;
  const right = 16;
  const top = 16;
  const bottom = 36;
  const xAt = (index: number) => left + (index / (weeks.length - 1)) * (width - left - right);
  const yAt = (value: number) => top + (1 - Math.min(Math.max(value, 0), max) / max) * (height - top - bottom);
  const planLine = points.map((point, index) => `${xAt(index)},${yAt(point.planned)}`).join(" ");
  const actuals = points.map((point, index) => (point.actual == null ? null : index)).filter((index): index is number => index != null);
  const actualLine = actuals.map(index => `${xAt(index)},${yAt(points[index].actual ?? 0)}`).join(" ");
  const lastActual = actuals.length ? actuals[actuals.length - 1] : -1;
  const floor = yAt(0);
  const planArea = `M ${points.map((point, index) => `${xAt(index)} ${yAt(point.planned)}`).join(" L ")} L ${xAt(points.length - 1)} ${floor} L ${xAt(0)} ${floor} Z`;
  const actualArea = actuals.length
    ? `M ${actuals.map(index => `${xAt(index)} ${yAt(points[index].actual ?? 0)}`).join(" L ")} L ${xAt(actuals[actuals.length - 1])} ${floor} L ${xAt(actuals[0])} ${floor} Z`
    : "";
  const label = (value: number) => (axis || (amount => `$${formatAud(amount)}`))(value);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: 520 }} role="img" aria-label="Budget burndown">
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = yAt(frac * max);
          return (
            <g key={frac}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke={C.border} />
              <text x={left - 8} y={y + 4} fontSize="10" fill={C.textSubtle} textAnchor="end">{label(frac * max)}</text>
            </g>
          );
        })}
        {points.map((point, index) => point.ahead ? (
          <rect key={weeks[index].start} x={xAt(index) - 8} y={top} width="16" height={height - top - bottom} fill="#e11d48" opacity="0.12" />
        ) : null)}
        <path d={planArea} fill="#1D6EFD" fillOpacity="0.08" />
        {actualArea && <path d={actualArea} fill="#10B981" fillOpacity="0.12" />}
        <polyline points={planLine} fill="none" stroke="#1D6EFD" strokeDasharray="5 3" strokeWidth="2" />
        {actualLine && <polyline points={actualLine} fill="none" stroke="#10B981" strokeWidth="2.5" />}
        <polyline points={weeks.map((week, index) => `${xAt(index)},${yAt(week.cumulativeClaimed)}`).join(" ")} fill="none" stroke="#0f172a" strokeWidth="2" />
        {actuals.map(index => (
          <circle key={weeks[index].start} cx={xAt(index)} cy={yAt(points[index].actual ?? 0)} r="4" fill="#10B981" stroke="#fff" strokeWidth="1.5" />
        ))}
        {lastActual >= 0 && lastActual < weeks.length - 1 && (
          <line
            x1={xAt(lastActual)}
            y1={yAt(points[lastActual].actual ?? 0)}
            x2={xAt(weeks.length - 1)}
            y2={yAt(forecastRemaining)}
            stroke="#F59E0B"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
        {milestones.map(mark => (
          <g key={mark.label}>
            <line x1={xAt(mark.weekIndex)} y1={top} x2={xAt(mark.weekIndex)} y2={height - bottom} stroke={C.amber} strokeDasharray="2 3" />
            <circle cx={xAt(mark.weekIndex)} cy={yAt(points[mark.weekIndex]?.planned ?? baseline)} r="4" fill={C.amber}>
              <title>{`${mark.label}: ${format(mark.amount)} · ${mark.status}`}</title>
            </circle>
          </g>
        ))}
        {weeks.map((week, index) => (
          <text key={week.start} x={xAt(index)} y={height - 12} fontSize="10" fill={C.textSubtle} textAnchor="middle">{index === 0 ? "Start" : `W${index}`}</text>
        ))}
      </svg>
    </div>
  );
}
