/**
 * SymbolReviewCard
 * ================
 * 
 * Displays a detected symbol with:
 * - Symbol visual + description
 * - Confidence score (HIGH/MEDIUM/LOW)
 * - Quantity editor
 * - Accept / Reject / Edit buttons
 * - Learned suggestion badge (if available)
 */

import React, { useState } from "react";
import { Check, X, Edit2, Lightbulb, TrendingUp } from "lucide-react";
import { DetectedComponent } from "../analyze_pdf";
import { C, FONT, RADIUS } from "./desktop/tokens";
import { ConfPill } from "./ui/anthropic";

export interface SymbolReviewCardProps {
  component: DetectedComponent;
  onAccept: (component: DetectedComponent) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
  learnedSuggestion?: {
    type: string;
    confidence: number;
  };
}

export const SymbolReviewCard: React.FC<SymbolReviewCardProps> = ({
  component,
  onAccept,
  onReject,
  onEdit,
  learnedSuggestion,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [qty, setQty] = useState(component.quantity);

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
        : C.red;

  const handleAccept = () => {
    const updated = { ...component, quantity: qty };
    onAccept(updated);
  };

  return (
    <div
      style={{
        borderRadius: RADIUS.md,
        border: `1px solid ${C.border}`,
        padding: 16,
        marginBottom: 12,
        backgroundColor: C.bg,
      }}
    >
      {/* Header: Symbol + Description + Confidence */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: C.text,
              }}
            >
              {component.symbol_visual || "?"}
            </span>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: FONT.sizes.sm,
                  fontWeight: 600,
                  color: C.text,
                }}
              >
                {component.type}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: FONT.sizes.xs,
                  color: C.textSecondary,
                }}
              >
                {component.room || "Unknown location"}
              </p>
            </div>
          </div>
        </div>

        {/* Confidence Pill */}
        <ConfPill conf={component.confidence} label={confLevel} />
      </div>

      {/* Learned Suggestion Badge */}
      {learnedSuggestion && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            border: `1px solid ${C.green}`,
            borderRadius: RADIUS.sm,
            padding: "8px 12px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: FONT.sizes.xs,
          }}
        >
          <Lightbulb size={14} color={C.green} />
          <span style={{ color: C.green, fontWeight: 500 }}>
            Last time you corrected this to <strong>{learnedSuggestion.type}</strong>
          </span>
          <TrendingUp size={12} color={C.green} style={{ marginLeft: "auto" }} />
        </div>
      )}

      {/* Quantity Editor */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <label
          style={{
            fontSize: FONT.sizes.sm,
            fontWeight: 500,
            color: C.text,
            minWidth: 80,
          }}
        >
          Quantity:
        </label>
        {isEditing ? (
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            style={{
              width: 60,
              padding: "6px 8px",
              border: `1px solid ${C.orange}`,
              borderRadius: RADIUS.sm,
              fontSize: FONT.sizes.sm,
              fontWeight: 600,
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: FONT.sizes.md,
                fontWeight: 600,
                color: C.text,
                minWidth: 30,
              }}
            >
              {qty}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                color: C.textSecondary,
              }}
              title="Edit quantity"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Notes / Flags */}
      {component.flags && component.flags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: FONT.sizes.xs,
              fontWeight: 600,
              color: C.textSecondary,
              marginBottom: 4,
            }}
          >
            Flags:
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {component.flags.map((flag) => (
              <span
                key={flag}
                style={{
                  backgroundColor: C.amberLight,
                  color: C.amber,
                  padding: "4px 8px",
                  borderRadius: RADIUS.sm,
                  fontSize: FONT.sizes.xs,
                  fontWeight: 500,
                }}
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <button
          onClick={() => onReject(component.type)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: RADIUS.sm,
            border: `1px solid ${C.red}`,
            backgroundColor: "transparent",
            color: C.red,
            cursor: "pointer",
            fontSize: FONT.sizes.sm,
            fontWeight: 500,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#fef2f2";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
          }}
        >
          <X size={16} />
          Reject
        </button>

        <button
          onClick={() => onEdit(component.type)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: RADIUS.sm,
            border: `1px solid ${C.textSecondary}`,
            backgroundColor: "transparent",
            color: C.textSecondary,
            cursor: "pointer",
            fontSize: FONT.sizes.sm,
            fontWeight: 500,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              C.bgSecondary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
          }}
        >
          <Edit2 size={16} />
          Edit
        </button>

        <button
          onClick={handleAccept}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: RADIUS.sm,
            border: "none",
            backgroundColor: C.green,
            color: "white",
            cursor: "pointer",
            fontSize: FONT.sizes.sm,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
        >
          <Check size={16} />
          Accept
        </button>
      </div>
    </div>
  );
};

export default SymbolReviewCard;
