/**
 * NavItem — single row in the left sidebar.
 *
 * Active item is a filled brand-blue pill (V1 navy shell). Inactive rows
 * stay muted; hover is handled in index.css so it does not fight inline styles.
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
  end?: boolean;
  /** Navy sidebar: light text, 44px target, translucent active state. */
  variant?: "sidebar" | "default";
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  active: boolean;
}

function rowStyle(active: boolean, sidebar: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    minHeight: sidebar ? 44 : undefined,
    borderRadius: 12,
    fontFamily: FONT.heading,
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    color: sidebar ? (active ? "#fff" : C.sidebarText) : (active ? "#fff" : C.textMuted),
    backgroundColor: sidebar && active ? "rgba(255,255,255,0.10)" : undefined,
    textAlign: "left" as const,
    width: "100%",
    transition: "background-color 120ms, color 120ms",
    textDecoration: "none",
    cursor: "pointer",
  };
}

function RowContent({ icon, label, badge, active, sidebar }: RowProps & { sidebar?: boolean }) {
  return (
    <>
      <span style={{ color: active ? "#fff" : (sidebar ? C.sidebarText : C.textSubtle), display: "flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && (
        <span
          style={{
            fontSize: 11,
            fontFamily: FONT.heading,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 10,
            backgroundColor: active ? "rgba(255,255,255,0.18)" : C.orangeSoft,
            color: active ? "#fff" : C.orangeDark,
          }}
        >
          {badge}
        </span>
      )}
    </>
  );
}

export default function NavItem({ icon, label, badge, to, active, onClick, end, variant = "default" }: NavItemProps) {
  const sidebar = variant === "sidebar";
  const className = sidebar ? "es-nav es-nav-side" : "es-nav";
  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={className}
        style={({ isActive }) => rowStyle(isActive, sidebar)}
      >
        {({ isActive }) => <RowContent icon={icon} label={label} badge={badge} active={isActive} sidebar={sidebar} />}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-current={active ? "page" : undefined}
      style={rowStyle(active ?? false, sidebar)}
    >
      <RowContent icon={icon} label={label} badge={badge} active={active ?? false} sidebar={sidebar} />
    </button>
  );
}
