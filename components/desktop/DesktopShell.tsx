/**
 * DesktopShell — persistent app chrome for the ElectraScan desktop workflow.
 *
 * Anthropic design-system layout:
 *   ┌───────────┬────────────────────────────────────────┐
 *   │           │ TopBar (search ⌘K, Aries pill, bell,   │
 *   │           │  New scan CTA)                         │
 *   │  Sidebar  ├────────────────────────────────────────┤
 *   │  (240)    │                                        │
 *   │           │  <Outlet /> — the routed screen        │
 *   │  Brand    │                                        │
 *   │  Nav      │                                        │
 *   │  Credits  │                                        │
 *   │  User     │                                        │
 *   └───────────┴────────────────────────────────────────┘
 *
 * Sidebar items map to the 6-screen workflow. "Settings" sits below the
 * stack as a secondary destination. The Vision credits card shows the
 * tenant's monthly Claude Vision usage — live data will arrive in Phase 2.
 */

import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Scan,
  FileText,
  BookOpen,
  Settings as SettingsIcon,
  FileEdit,
  CheckCircle2,
  Bell,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import ElectraScanMark from "./ElectraScanMark";
import { C, FONT, RADIUS } from "./tokens";
import { getActiveCompanyProfile } from "../../services/companyProfile";
import NavItem from "../ui/anthropic/NavItem";

// ─── Nav config ─────────────────────────────────────────────────────────
// Kept at module scope so adding a new route is a one-line change.
interface NavEntry {
  path: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

const PRIMARY_NAV: NavEntry[] = [
  { path: "/dashboard",         label: "Dashboard",        icon: <LayoutDashboard size={16} /> },
  { path: "/detection",         label: "Detection",        icon: <Scan size={16} />,      badge: 3 },
  { path: "/estimate",          label: "Estimate",         icon: <FileText size={16} /> },
  { path: "/pricing-schedule",  label: "Pricing Schedule", icon: <BookOpen size={16} /> },
  { path: "/variation-report",  label: "Variation Report", icon: <FileEdit size={16} /> },
  { path: "/approvals",         label: "Approvals",        icon: <CheckCircle2 size={16} /> },
];

const SECONDARY_NAV: NavEntry[] = [
  { path: "/settings", label: "Settings", icon: <SettingsIcon size={16} /> },
];

export default function DesktopShell() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", color: C.text, fontFamily: FONT.body }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar />
        <div style={{ padding: "36px 32px", maxWidth: 1400, width: "100%", flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────
function Sidebar() {
  const company = getActiveCompanyProfile();
  const initials = company.name
    .split(" ")
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // Shortened tenant name for the user-chip line 2 (drops "Pty Ltd", "Services")
  const shortName = company.name.replace(" Pty Ltd", "").replace(" Services", "");

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        borderRight: `1px solid ${C.border}`,
        backgroundColor: C.bgSoft,
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: "0 6px", marginBottom: 36 }}>
        <ElectraScanMark size={32} />
      </div>

      {/* Primary nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {PRIMARY_NAV.map(item => (
          <NavItem
            key={item.path}
            to={item.path}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
          />
        ))}
      </nav>

      {/* Vision credits card */}
      <div
        style={{
          marginTop: 28,
          padding: 14,
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.lg,
          backgroundColor: C.bgCard,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Sparkles size={13} color={C.orange} />
          <span
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: C.textMuted,
            }}
          >
            Vision credits
          </span>
        </div>
        <div style={{ fontFamily: FONT.heading, fontSize: 20, fontWeight: 600 }}>
          847{" "}
          <span style={{ color: C.textSubtle, fontWeight: 400, fontSize: 13 }}>
            / 1,000
          </span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: C.border,
            marginTop: 8,
            overflow: "hidden",
          }}
        >
          <div style={{ width: "84.7%", height: "100%", backgroundColor: C.orange }} />
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textMuted,
            marginTop: 8,
            fontStyle: "italic",
          }}
        >
          Resets 1 May
        </div>
      </div>

      {/* Secondary nav */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 2 }}>
        {SECONDARY_NAV.map(item => (
          <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} />
        ))}
      </div>

      {/* User chip — pinned to bottom */}
      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: C.green,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.heading,
              fontWeight: 500,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 500 }}>
              Damien C.
            </div>
            <div style={{ fontSize: 12, color: C.textSubtle }}>{shortName}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────
function TopBar() {
  const navigate = useNavigate();
  const [_paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K opens the command palette (placeholder until the full palette lands
  // in a later phase). Escape closes it. We keep the listener here because
  // TopBar is always mounted — no need to lift it into the app root.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "14px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: C.bg,
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Command search */}
      <button
        onClick={() => setPaletteOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: C.textSubtle,
          fontSize: 14,
          fontStyle: "italic",
          padding: "8px 14px",
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.md + 2,
          backgroundColor: C.bgCard,
          width: 380,
          textAlign: "left",
          fontFamily: FONT.body,
        }}
      >
        <Search size={15} />
        <span>Search estimates, scans, rates…</span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: FONT.heading,
            fontSize: 11,
            color: C.textSubtle,
            padding: "2px 6px",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            fontStyle: "normal",
          }}
        >
          ⌘K
        </span>
      </button>

      {/* Right-side cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Aries online pill — pulse animation signals live AI agent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 12px",
            borderRadius: 20,
            backgroundColor: C.greenSoft,
            color: C.green,
            fontFamily: FONT.heading,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span
            className="pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: C.green,
            }}
          />
          Aries online
        </div>

        {/* Notifications */}
        <button
          className="es-btn-ghost"
          style={{
            position: "relative",
            padding: 8,
            borderRadius: RADIUS.md,
          }}
        >
          <Bell size={16} />
          <span
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: C.orange,
            }}
          />
        </button>

        {/* Primary CTA — New scan */}
        <button
          className="es-btn-primary"
          onClick={() => navigate("/detection")}
          style={{
            fontFamily: FONT.heading,
            fontSize: 14,
            fontWeight: 500,
            backgroundColor: C.orange,
            color: "#fff",
            padding: "9px 16px",
            borderRadius: RADIUS.md,
            display: "flex",
            alignItems: "center",
            gap: 7,
            transition: "background-color 150ms",
          }}
        >
          <Plus size={15} strokeWidth={2.5} /> New scan
        </button>
      </div>
    </div>
  );
}
