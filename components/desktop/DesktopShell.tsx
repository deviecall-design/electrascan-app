/**
 * DesktopShell — navy sidebar, light workspace.
 *
 * Workflow / Projects / Setup. New scan is the primary action.
 * Search opens the real command palette. The bell has no fake unread dot.
 * Below 1024px the sidebar becomes a drawer.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { authIsDisabled } from "../../lib/authMode";
import {
  LayoutDashboard,
  Scan,
  FileText,
  BookOpen,
  Settings as SettingsIcon,
  GitCompare,
  CheckCircle2,
  FolderKanban,
  Bell,
  Plus,
  Search,
  Menu,
  X,
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

const NAV: { grp: string; items: NavEntry[] }[] = [
  {
    grp: "Workflow",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, end: true },
      { path: "/detection", label: "Scans", icon: <Scan size={18} /> },
      { path: "/estimate", label: "Estimates", icon: <FileText size={18} /> },
      { path: "/approvals", label: "Approvals", icon: <CheckCircle2 size={18} /> },
    ],
  },
  {
    grp: "Projects",
    items: [
      { path: "/variation-report", label: "Variations", icon: <GitCompare size={18} /> },
      { path: "/projects", label: "Project reports", icon: <FolderKanban size={18} /> },
    ],
  },
  {
    grp: "Setup",
    items: [
      { path: "/pricing-schedule", label: "Rates", icon: <BookOpen size={18} /> },
      { path: "/settings", label: "Settings", icon: <SettingsIcon size={18} /> },
    ],
  },
];

export default function DesktopShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", color: C.text, fontFamily: FONT.body, backgroundColor: C.bg }}>
      <aside
        className="es-sidebar-desktop"
        style={{
          width: 256,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          backgroundColor: C.sidebar,
        }}
      >
        <SidebarBody onNavigate={() => setDrawerOpen(false)} />
      </aside>

      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }}>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ position: "relative", height: "100%", width: 288, backgroundColor: C.sidebar }}>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", backgroundColor: C.bg, overflow: "auto" }}>
        <TopBar onMenu={() => setDrawerOpen(open => !open)} menuOpen={drawerOpen} />
        <div style={{ padding: "32px 32px 36px", maxWidth: 1200, width: "100%", margin: "0 auto", flex: 1, boxSizing: "border-box" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const company = getActiveCompanyProfile();
  const brand = tenantBrandName(company);
  const user = useOptionalAuthUser();
  const authName = nameFromAuthUser(user);
  const chipName = authName || brand;
  const initials = tenantInitials({ ...company, name: chipName });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px 16px", color: C.sidebarText }}>
      <div style={{ padding: "0 8px" }}>
        <ElectraScanMark size={36} onDark />
      </div>

      <button
        type="button"
        className="es-btn-primary"
        onClick={() => {
          onNavigate();
          navigate("/detection/new");
        }}
        style={{
          marginTop: 24,
          width: "100%",
          minHeight: 44,
          fontFamily: FONT.heading,
          fontSize: 14,
          fontWeight: 600,
          backgroundColor: C.orange,
          color: "#fff",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Plus size={18} strokeWidth={2.5} /> New scan
      </button>

      {NAV.map(group => (
        <div key={group.grp} style={{ marginTop: 24 }}>
          <div style={{ padding: "0 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.sidebarMuted }}>
            {group.grp}
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }} aria-label={group.grp}>
            {group.items.map(item => (
              <NavItem
                key={item.path}
                to={item.path}
                end={item.end}
                icon={item.icon}
                label={item.label}
                variant="sidebar"
                onClick={onNavigate}
              />
            ))}
          </nav>
        </div>
      ))}

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", padding: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: C.orange,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT.heading,
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT.heading, fontSize: 14, fontWeight: 600, color: "#fff" }}>
            {chipName}
          </div>
          {user?.email ? (
            <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          ) : authIsDisabled() ? (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Vesh Electrical</div>
          ) : (
            <Link to="/login" onClick={onNavigate} style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd" }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
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
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(255,255,255,0.9)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        minHeight: 64,
      }}
    >
      <button
        type="button"
        className="es-menu-btn"
        aria-label="Menu"
        onClick={onMenu}
        style={{
          width: 44,
          height: 44,
          placeItems: "center",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          backgroundColor: C.bgCard,
          color: C.text,
        }}
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
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
          padding: "0 14px",
          minHeight: 44,
          border: "none",
          borderRadius: 12,
          backgroundColor: "#f1f5f9",
          flex: 1,
          maxWidth: 480,
          textAlign: "left",
          fontFamily: FONT.body,
        }}
      >
        <Search size={18} />
        <span style={{ flex: 1 }}>Search scans, estimates, plans…</span>
        <span
          style={{
            fontFamily: FONT.heading,
            fontSize: 11,
            color: C.textSubtle,
            padding: "2px 6px",
            backgroundColor: "#fff",
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </button>

      <div ref={notesRef} style={{ position: "relative", marginLeft: "auto" }}>
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
            width: 44,
            height: 44,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            backgroundColor: C.bgCard,
            display: "grid",
            placeItems: "center",
            color: C.text,
          }}
        >
          <Bell size={18} />
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
              boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
              zIndex: 20,
            }}
          >
            <div style={{ fontFamily: FONT.heading, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
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
