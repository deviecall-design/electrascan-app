/**
 * SymbolReviewCard
 * ================
 * 
 * Displays a detected symbol with:
 * - Symbol visual + description
 * - Confidence badge (HIGH/MEDIUM/LOW)
 * - Quantity editor
 * - Accept / Reject buttons
 * 
 * User can:
 * - Accept the detection as-is
 * - Adjust quantity before accepting
 * - Reject and remove from estimate
 */

import React, { useState } from "react";
import { DetectedComponent } from "../analyze_pdf";
import { C, FONT } from "./desktop/tokens";

export interface SymbolReviewCardProps {
  component: DetectedComponent;
  onAccept: (component: DetectedComponent) => void;
  onReject: (componentType: string) => void;
}

export const SymbolReviewCard: React.FC<SymbolReviewCardProps> = ({
  component,
  onAccept,
  onReject,
}) => {
  const [qty, setQty] = useState(component.quantity);
  const [isEditing, setIsEditing] = useState(false);

  const confLevel =
    component.confidence >= 0.85
      ? "HIGH"
      : component.confidence >= 0.7
        ? "MEDIUM"
        : "LOW";

  const confColor =
    confLevel === "HIGH"
      ? C.green
      : confLevel === "MEDIUM"
        ? C.amber
        : C.orange;

  const confBgColor =
    confLevel === "HIGH"
      ? C.greenSoft
      : confLevel === "MEDIUM"
        ? C.amberSoft
        : C.orangeSoft;

  const handleAccept = () => {
    const updated = { ...component, quantity: qty };
    onAccept(updated);
  };

  const handleReject = () => {
    onReject(component.type);
  };

  return (
    <div
      style={{
        borderRadius: "6px",
        border: `1px solid ${C.border}`,
        backgroundColor: C.bgCard,
        padding: "16px",
        marginBottom: "12px",
      }}
    >
      {/* Header: Symbol + Title */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: "12px",
        }}
      >
        <div>
          <div style={{ fontFamily: FONT.heading, fontSize: "16px", fontWeight: 600, color: C.text }}>
            {component.catalogue_item_name || component.type}
          </div>
          <div
            style={{
              fontSize: "14px",
              color: C.textMuted,
              marginTop: "4px",
            }}
          >
            {component.room} • {component.drawing_ref}
          </div>
        </div>

        {/* Confidence Badge */}
        <div
          style={{
            display: "inline-block",
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor: confBgColor,
            color: confColor,
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {confLevel} ({Math.round(component.confidence * 100)}%)
        </div>
      </div>

      {/* Quantity Editor */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontSize: "13px", color: C.textMuted, display: "block", marginBottom: "6px" }}>
          Quantity:
        </label>
        {!isEditing ? (
          <div
            onClick={() => setIsEditing(true)}
            style={{
              display: "inline-block",
              padding: "6px 12px",
              border: `1px solid ${C.border}`,
              borderRadius: "4px",
              cursor: "pointer",
              backgroundColor: C.bgSoft,
              fontFamily: FONT.heading,
              fontSize: "16px",
            }}
          >
            {qty} EA
          </div>
        ) : (
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            style={{
              padding: "6px 12px",
              border: `2px solid ${C.orange}`,
              borderRadius: "4px",
              fontSize: "16px",
              fontFamily: FONT.heading,
            }}
          />
        )}
      </div>

      {/* Details */}
      {component.notes && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "13px", color: C.textSubtle, fontStyle: "italic" }}>
            {component.notes}
          </div>
        </div>
      )}

      {/* Flags */}
      {component.flags && component.flags.length > 0 && (
        <div style={{ marginBottom: "12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {component.flags.map((flag) => (
            <span
              key={flag}
              style={{
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: "4px",
                backgroundColor: C.amberSoft,
                color: C.amber,
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {flag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleAccept}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "none",
            borderRadius: "4px",
            backgroundColor: C.green,
            color: "#fff",
            fontFamily: FONT.heading,
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✓ Accept
        </button>

        <button
          onClick={handleReject}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: `1px solid ${C.border}`,
            borderRadius: "4px",
            backgroundColor: C.bgCard,
            color: C.text,
            fontFamily: FONT.heading,
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
};
