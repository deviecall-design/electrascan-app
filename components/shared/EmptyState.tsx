import React from "react";

const C = {
  card: "#1e293b",
  border: "#334155",
  blue: "#3b82f6",
  blueDk: "#1d4ed8",
  text: "#f1f5f9",
  muted: "#94a3b8",
};

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  compact?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actions,
  compact,
}) => {
  return (
    <div
      className="es-empty-state"
      style={{
        background: C.card,
        border: `1px dashed ${C.border}`,
        borderRadius: 12,
        padding: compact ? "32px 20px" : "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
      }}
    >
      {icon && (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: `${C.blue}18`,
            color: C.blue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 420, lineHeight: 1.5, marginBottom: actions?.length ? 8 : 0 }}>
        {description}
      </div>
      {actions && actions.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {actions.map(a => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: a.primary === false ? "transparent" : C.blue,
                color: a.primary === false ? C.blue : "#fff",
                border: a.primary === false ? `1px solid ${C.blue}` : "none",
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
