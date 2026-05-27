import React from "react";
import { type ProjectEstimate } from "../contexts/ProjectContext";

const C = {
  bg: "#0A1628",
  navy: "#0F1E35",
  card: "#132240",
  blue: "#1D6EFD",
  green: "#00C48C",
  amber: "#FFB020",
  red: "#FF4D4D",
  text: "#EDF2FF",
  muted: "#5C7A9E",
  border: "#1A3358",
  dim: "#8BA4C4",
  purple: "#7C3AED",
};

const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

interface LabourEstimationSectionProps {
  estimate: ProjectEstimate;
  readOnly?: boolean;
  onChange?: (patch: Partial<ProjectEstimate>) => void;
}

export default function LabourEstimationSection({
  estimate,
  readOnly = false,
  onChange,
}: LabourEstimationSectionProps) {
  const hours = estimate.estimatedLabourHours ?? 0;
  const rate = estimate.labourRatePerHour ?? 85;
  const cost = hours * rate;

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    onChange?.({
      estimatedLabourHours: val,
      estimatedLabourCost: val * rate,
    });
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 85;
    onChange?.({
      labourRatePerHour: val,
      estimatedLabourCost: hours * val,
    });
  };

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 12 }}>
        Labour Estimation
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Estimated Hours */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            Estimated Hours
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={hours}
            onChange={handleHoursChange}
            disabled={readOnly}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: readOnly ? `${C.border}44` : C.navy,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.text,
              fontSize: 13,
              fontWeight: 600,
              boxSizing: "border-box",
              opacity: readOnly ? 0.6 : 1,
            }}
          />
        </div>

        {/* Hourly Rate */}
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            Labour Rate ($/hr)
          </label>
          <input
            type="number"
            step="5"
            min="0"
            value={rate}
            onChange={handleRateChange}
            disabled={readOnly}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: readOnly ? `${C.border}44` : C.navy,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.text,
              fontSize: 13,
              fontWeight: 600,
              boxSizing: "border-box",
              opacity: readOnly ? 0.6 : 1,
            }}
          />
        </div>
      </div>

      {/* Labour Cost Display */}
      <div
        style={{
          background: `${C.blue}15`,
          border: `1px solid ${C.blue}33`,
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 12, color: C.muted }}>Labour Cost</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>
          {fmtMoney(cost)}
        </div>
      </div>

      {hours > 0 && (
        <div style={{ fontSize: 10, color: C.dim, marginTop: 8, textAlign: "right" }}>
          {hours}h × ${rate.toFixed(2)}/hr
        </div>
      )}
    </div>
  );
}
