import React, { useState } from "react";
import { type Timesheet } from "../contexts/ProjectContext";

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
};

interface TimesheetFormProps {
  projectName: string;
  estimatedHours: number;
  labourRate: number;
  weeks: string[];
  onSubmit: (timesheet: Omit<Timesheet, "id" | "labourCost">) => void;
  onCancel: () => void;
}

export default function TimesheetForm({
  projectName,
  estimatedHours,
  labourRate,
  weeks,
  onSubmit,
  onCancel,
}: TimesheetFormProps) {
  const [week, setWeek] = useState(weeks[0] ?? "W1");
  const [electrician, setElectrician] = useState("");
  const [plannedHours, setPlannedHours] = useState(estimatedHours / weeks.length);
  const [actualHours, setActualHours] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const actualNum = actualHours ? parseFloat(actualHours) : 0;
  const plannedNum = plannedHours;
  const isOvertime = actualNum > plannedNum * 1.5;
  const labourCost = actualNum * labourRate;

  const handleSubmit = () => {
    setError("");

    if (!electrician.trim()) {
      setError("Electrician name is required");
      return;
    }

    if (!actualHours || actualNum <= 0) {
      setError("Actual hours must be greater than 0");
      return;
    }

    onSubmit({
      week,
      electrician: electrician.trim(),
      plannedHours: plannedNum,
      actualHours: actualNum,
      labourCost,
      materialsUsed: materialsUsed ? parseFloat(materialsUsed) : 0,
      submitted: true,
      submittedAt: new Date().toISOString(),
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 100,
        padding: "20px",
        paddingBottom: "env(safe-area-inset-bottom, 20px)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.navy,
          border: `1px solid ${C.border}`,
          borderRadius: "16px 16px 0 0",
          padding: "20px",
          width: "100%",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Submit Timesheet</div>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 24,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
          <strong>{projectName}</strong> · Weekly timesheet entry
        </div>

        {error && (
          <div
            style={{
              background: `${C.red}22`,
              border: `1px solid ${C.red}44`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              color: C.red,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Week */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>
              Week
            </label>
            <select
              value={week}
              onChange={e => setWeek(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 13,
              }}
            >
              {weeks.map(w => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Electrician */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>
              Electrician Name
            </label>
            <input
              type="text"
              placeholder="e.g., John Smith"
              value={electrician}
              onChange={e => setElectrician(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Planned Hours (read-only) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>
              Planned Hours
            </label>
            <input
              type="number"
              disabled
              value={plannedNum.toFixed(1)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.muted,
                fontSize: 13,
                boxSizing: "border-box",
                opacity: 0.6,
              }}
            />
          </div>

          {/* Actual Hours */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>
              Actual Hours Logged
            </label>
            <input
              type="number"
              step="0.5"
              placeholder="0"
              value={actualHours}
              onChange={e => setActualHours(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.card,
                border: `1px solid ${isOvertime ? C.amber : C.border}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
            {isOvertime && (
              <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>
                ⚠️ Over 1.5× planned hours. Check for scope creep.
              </div>
            )}
          </div>

          {/* Labour Cost Display */}
          {actualHours && (
            <div
              style={{
                background: `${C.blue}15`,
                border: `1px solid ${C.blue}33`,
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Labour Cost</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>
                ${labourCost.toFixed(2)}
              </div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                {actualNum.toFixed(1)}h @ ${labourRate}/hr
              </div>
            </div>
          )}

          {/* Materials Used */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>
              Materials Used This Week ($) — Optional
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={materialsUsed}
              onChange={e => setMaterialsUsed(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Note */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>
              Notes — Optional
            </label>
            <textarea
              placeholder="e.g., Delayed due to site access issues"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.text,
                fontSize: 13,
                fontFamily: "inherit",
                boxSizing: "border-box",
                minHeight: "80px",
                resize: "vertical",
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px",
              background: C.card,
              border: `1px solid ${C.border}`,
              color: C.muted,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!electrician.trim() || !actualHours}
            style={{
              flex: 1,
              padding: "12px",
              background: C.blue,
              border: "none",
              color: "#fff",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: !electrician.trim() || !actualHours ? 0.5 : 1,
            }}
          >
            Submit Timesheet
          </button>
        </div>
      </div>
    </div>
  );
}
