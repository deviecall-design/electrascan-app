/**
 * DesktopShell — persistent navy chrome for the ElectraScan desktop workflow.
 *
 * V1 refined navy AppShell:
 *   ┌───────────┬────────────────────────────────────────┐
 *   │           │ TopBar (New scan, search ⌘K, bell)     │
 *   │  Sidebar  ├────────────────────────────────────────┤
 *   │  (240)    │                                        │
 *   │           │  <Outlet /> — the routed screen        │
 *   │  Brand    │                                        │
 *   │  Nav      │                                        │
 *   │  User     │                                        │
 *   └───────────┴────────────────────────────────────────┘
 *
 * Search opens a real palette. The bell has no fake unread badge.
 * The old Vision-credits card (hardcoded 847/1,000) is gone — it lied.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Scan,
  FileText,
  BookOpen,
  Settings as SettingsIcon,
  FileEdit,
  CheckCircle2,
  FolderOpen,
  Bell,
  Plus,
  Search,
} from "lucide-react";
import ElectraScanMark from "./ElectraScanMark";
import CommandPalette from "./CommandPalette";
import { C, FONT, RADIUS } from "./tokens";
import {
  getActiveCompanyProfile,
  tenantBrandName,
  tenantInitials,
} from "../../services/companyProfile";
import NavItem from "../ui/anthropic/NavItem";
import useSupabaseQuery from "../../hooks/useSupabaseQuery";
import useOptionalAuthUser, { nameFromAuthUser } from "../../hooks/useOptionalAuthUser";
import { fetchEstimates, fetchScans } from "../../services/supabaseData";
import { buildPaletteItems } from "../../lib/commandPalette";

interface NavEntry {
  path: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const PRIMARY_NAV: NavEntry[] = [
  { path: "/dashboard",        label: "Dashboard",        icon: <LayoutDashboard size={16} />, end: true },
  { path: "/detection",        label: "Scans",            icon: <Scan size={16} /> },
  { path: "/estimate",         label: "Estimates",        icon: <FileText size={16} /> },
  { path: "/pricing-schedule", label: "Rates",            icon: <BookOpen size={16} /> },
  { path: "/approvals",        label: "Approvals",        icon: <CheckCircle2 size={16} /> },
  { path: "/variation-report", label: "Variation Report", icon: <FileEdit size={16} /> },
  { path: "/projects",         label: "Project Reports",  icon: <FolderOpen size={16} /> },
];

const SECONDARY_NAV: NavEntry[] = [
  { path: "/settings", label: "Settings", icon: <SettingsIcon size={16} /> },
];

export default function DesktopShell() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", color: C.text, fontFamily: FONT.body, backgroundColor: C.bg }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", backgroundColor: C.bg, overflow: "auto" }}>
        <TopBar />
        <div style={{ padding: "32px 32px 36px", maxWidth: 1400, width: "100%", flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  const company = getActiveCompanyProfile();
  const brand = tenantBrandName(company);
  const user = useOptionalAuthUser();
  const authName = nameFromAuthUser(user);
  const chipName = authName || brand;
  const chipSub = user?.email?.trim() || null;
  const initials = tenantInitials({ ...company, name: chipName });

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        borderRight: `1px solid ${C.border}`,
        backgroundColor: C.bgSoft,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "0 8px", marginBottom: 32 }}>
        <ElectraScanMark size={32} subtitle={brand} />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }} aria-label="Primary">
        {PRIMARY_NAV.map(item => (
          <NavItem
            key={item.path}
            to={item.path}
            end={item.end}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 2 }}>
        {SECONDARY_NAV.map(item => (
          <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} />
        ))}
      </div>

      <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: C.orange,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.heading,
              fontWeight: 600,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600 }}>
              {chipName}
            </div>
            {chipSub && (
              <div
                style={{
                  fontSize: 12,
                  color: C.textSubtle,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={chipSub}
              >
                {chipSub}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  const { data: liveScans } = useSupabaseQuery(fetchScans);
  const { data: liveEstimates } = useSupabaseQuery(fetchEstimates);
  const paletteItems = useMemo(
    () => buildPaletteItems(liveScans, liveEstimates),
    [liveScans, liveEstimates],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setNotesOpen(false);
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!notesOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (notesRef.current && !notesRef.current.contains(e.target as Node)) {
        setNotesOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [notesOpen]);

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.border}`,
        padding: "12px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
        backgroundColor: C.bg,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <button
        className="es-btn-primary"
        onClick={() => navigate("/detection/new")}
        style={{
          fontFamily: FONT.heading,
          fontSize: 14,
          fontWeight: 500,
          backgroundColor: C.orange,
          color: "#fff",
          padding: "9px 16px",
          borderRadius: RADIUS.md + 2,
          display: "flex",
          alignItems: "center",
          gap: 7,
          transition: "background-color 150ms",
        }}
      >
        <Plus size={15} strokeWidth={2.5} /> New scan
      </button>

      <button
        type="button"
        onClick={() => {
          setNotesOpen(false);
          setPaletteOpen(true);
        }}
        aria-label="Search scans, estimates, plans"
        aria-keyshortcuts="Meta+K Control+K"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: C.textSubtle,
          fontSize: 14,
          padding: "8px 14px",
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.md + 2,
          backgroundColor: C.bgCard,
          width: 320,
          textAlign: "left",
          fontFamily: FONT.body,
        }}
      >
        <Search size={15} />
        <span style={{ flex: 1 }}>Search scans, estimates, plans…</span>
        <span
          style={{
            fontFamily: FONT.heading,
            fontSize: 11,
            color: C.textSubtle,
            padding: "2px 6px",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </button>

      <div ref={notesRef} style={{ position: "relative" }}>
        <button
          type="button"
          className="es-btn-ghost"
          aria-label="Notifications"
          aria-expanded={notesOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setPaletteOpen(false);
            setNotesOpen(o => !o);
          }}
          style={{
            position: "relative",
            padding: 8,
            borderRadius: RADIUS.md,
            border: `1px solid ${C.border}`,
            backgroundColor: C.bgCard,
          }}
        >
          <Bell size={16} />
        </button>
        {notesOpen && (
          <div
            role="dialog"
            aria-label="Notifications"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 320,
              backgroundColor: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.lg,
              padding: 16,
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              zIndex: 20,
            }}
          >
            <div
              style={{
                fontFamily: FONT.heading,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Notifications
            </div>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>
              You&apos;re all caught up. Quote views and approvals will show up here when they happen — there is no unread count until then.
            </p>
          </div>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
    </div>
  );
}
