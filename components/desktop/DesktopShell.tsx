/**
 * DesktopShell — persistent app chrome for the desktop ElectraScan workflow.
 *
 * Renders the top nav bar (brand + 6 section links + live-data badge + tenant
 * chip) and slots the current route's screen into the body.
 *
 * Matches the Approvals-screen mockup exactly: full-width dark nav with
 * active link highlighted in blue, live-data badge (brand green) and
 * tenant name right-aligned.
 */

import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import ElectraScanMark from "./ElectraScanMark";
import { C, FONT } from "./tokens";
import { getActiveCompanyProfile } from "../../services/companyProfile";

interface NavItem {
  path: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard",         label: "Dashboard" },
  { path: "/detection",         label: "Detection" },
  { path: "/estimate",          label: "Estimate" },
  { path: "/pricing-schedule",  label: "Pricing Schedule" },
  { path: "/variation-report",  label: "Variation Report" },
  { path: "/approvals",         label: "Approvals" },
];

// The "live data as of" date shown in the top-right badge. In production this
// would come from the tenant's active rate-schedule version / pricing date.
const LIVE_DATA_DATE = "31.3.2026";

export default function DesktopShell() {
  const company = getActiveCompanyProfile();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: FONT.stack,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top nav ── */}
      <nav
        style={{
          height: 72,
          background: C.navy,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: 32,
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <NavLink to="/dashboard" style={{ textDecoration: "none" }}>
          <ElectraScanMark size={36} />
        </NavLink>

        {/* Section links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                padding: "10px 18px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                color: isActive ? "#ffffff" : C.dim,
                background: isActive ? C.blue : "transparent",
                transition: "all 0.15s",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Live-data badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid ${C.liveGreen}55`,
            background: C.liveGreenBg,
            fontSize: 11,
            fontWeight: 700,
            color: C.liveGreen,
            letterSpacing: "0.05em",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.liveGreen,
              boxShadow: `0 0 8px ${C.liveGreen}`,
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          LIVE DATA · {LIVE_DATA_DATE}
        </div>

        {/* Tenant chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 14px",
            borderRadius: 10,
            background: C.card,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            fontWeight: 600,
            color: C.dim,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: C.blue,
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {company.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          {company.name.replace(" Pty Ltd", "").replace(" Services", "")}
        </div>
      </nav>

      {/* ── Body (routed screen) ── */}
      <main style={{ flex: 1, overflow: "auto", padding: "32px 40px" }}>
        <Outlet />
      </main>

      {/* Inline keyframes for the live-data pulse dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
