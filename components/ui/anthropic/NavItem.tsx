/**
 * NavItem — single row in the left sidebar.
 *
 * When active, the label goes to --es-text (weight 500) and the leading
 * icon turns orange. When inactive, both are muted. An optional badge
 * (e.g. "3" for scans in progress) renders on the right in orange-soft.
 *
 * This is the NavLink-wrapper variant — pass `to` and it uses react-router's
 * active-link detection. If `to` is omitted and `active` is passed explicitly,
 * it renders as a plain button (useful inside the CommandPalette or for
 * synthetic nav items like "Sign out").
 */

import React from "react";
import { NavLink } from "react-router-dom";
import { C, FONT, RADIUS } from "../../desktop/tokens";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  to?: string;
  active?: boolean;   // only consulted when `to` is omitted
  onClick?: () => void;
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  active: boolean;
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: RADIUS.md,
    fontFamily: FONT.heading,
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    color: active ? C.text : C.textMuted,
    backgroundColor: active ? C.borderSoft : "transparent",
    textAlign: "left" as const,
    width: "100%",
    transition: "background-color 120ms, color 120ms",
    textDecoration: "none",
  };
}

function RowContent({ icon, label, badge, active }: RowProps) {
  return (
    <>
      <span style={{ color: active ? C.orange : C.textSubtle, display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && (
        <span
          style={{
            fontSize: 11,
            fontFamily: FONT.heading,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 10,
            backgroundColor: C.orangeSoft,
            color: C.orangeDark,
          }}
        >
          {badge}
        </span>
      )}
    </>
  );
}

export default function NavItem({ icon, label, badge, to, active, onClick }: NavItemProps) {
  if (to) {
    return (
      <NavLink to={to} onClick={onClick} className="es-nav" style={({ isActive }) => rowStyle(isActive)}>
        {({ isActive }) => <RowContent icon={icon} label={label} badge={badge} active={isActive} />}
      </NavLink>
    );
  }

  return (
    <button type="button" onClick={onClick} className="es-nav" style={rowStyle(active ?? false)}>
      <RowContent icon={icon} label={label} badge={badge} active={active ?? false} />
    </button>
  );
}
