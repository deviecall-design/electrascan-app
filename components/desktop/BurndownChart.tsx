import React from "react";
import { C } from "./tokens";
import type { BurndownWeek } from "../../lib/burndown";

/**
 * The burndown polyline from the old project report.
 * Planned is dashed. Actual is solid. Values are cumulative.
 */
export default function BurndownChart({
  weeks,
  plannedKey,
  actualKey,
  max,
  format,
}: {
  weeks: BurndownWeek[];
  plannedKey: "plannedSpend" | "plannedHours";
  actualKey: "actualSpend" | "actualHours";
  max: number;
  format: (value: number) => string;
}) {
  if (weeks.length < 2 || !(max > 0)) {
    return <p style={{ color: C.textMuted, fontSize: 14 }}>Set a start and end date to draw the plan.</p>;
  }
  const xAt = (index: number) => 60 + (index / (weeks.length - 1)) * 620;
  const yAt = (value: number) => 20 + (1 - Math.min(value, max) / max) * 160;
  const planned = weeks.map((week, index) => `${xAt(index)},${yAt(week[plannedKey])}`).join(" ");
  const actuals = weeks
    .map((week, index) => ({ index, value: week[actualKey] }))
    .filter((point): point is { index: number; value: number } => point.value != null);
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" viewBox="0 0 700 220" style={{ minWidth: 520 }} role="img" aria-label="Planned and actual burndown">
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = 20 + (1 - frac) * 160;
          return (
            <g key={frac}>
              <line x1="60" y1={y} x2="680" y2={y} stroke={C.border} strokeWidth="1" />
              <text x="52" y={y + 4} fontSize="10" fill={C.textSubtle} textAnchor="end">{format(frac * max)}</text>
            </g>
          );
        })}
        {weeks.map((week, index) => (
          <text key={week.start} x={xAt(index)} y={200} fontSize="10" fill={C.textSubtle} textAnchor="middle">{week.label}</text>
        ))}
        <polyline points={planned} fill="none" stroke={C.textSubtle} strokeWidth="2" strokeDasharray="6 3" />
        {actuals.length >= 2 && (
          <polyline
            points={actuals.map(point => `${xAt(point.index)},${yAt(point.value)}`).join(" ")}
            fill="none"
            stroke={C.orange}
            strokeWidth="2.5"
          />
        )}
        {actuals.map(point => (
          <circle key={point.index} cx={xAt(point.index)} cy={yAt(point.value)} r="4" fill={C.orange} stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: C.textMuted }}>
        <span>Dashed line is planned</span>
        <span>Solid line is actual</span>
      </div>
    </div>
  );
}
