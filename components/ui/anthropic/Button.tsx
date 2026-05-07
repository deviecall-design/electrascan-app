/**
 * Button primitives — PrimaryButton + GhostButton.
 *
 * PrimaryButton is orange-filled; used for the single primary action on a
 * screen (Send to client, Generate quote, New scan). Never two primary
 * buttons in the same viewport.
 *
 * GhostButton is white on 1px border; used for secondary actions alongside
 * a primary (Back, Download PDF, Duplicate as template).
 */

import React from "react";
import { C, FONT, RADIUS } from "../../desktop/tokens";

interface ButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function PrimaryButton({ children, icon, onClick, disabled, type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="es-btn-primary"
      style={{
        fontFamily: FONT.heading,
        fontSize: 14,
        fontWeight: 500,
        backgroundColor: disabled ? C.textSubtle : C.orange,
        color: "#fff",
        padding: "10px 18px",
        borderRadius: RADIUS.md,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        transition: "background-color 150ms",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function GhostButton({ children, icon, onClick, disabled, type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="es-btn-ghost"
      style={{
        fontFamily: FONT.heading,
        fontSize: 13,
        fontWeight: 500,
        color: C.text,
        padding: "9px 14px",
        borderRadius: RADIUS.md,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: `1px solid ${C.border}`,
        backgroundColor: C.bgCard,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
