import React, { useEffect, useState } from "react";
import { useTenant } from "../contexts/TenantContext";
import type { AppRoute } from "./Router";

/**
 * AppShell — hybrid dark-sidebar + light-content layout matching the
 * ElectraScan prototype. Screens render their content into `children`;
 * the shell provides the sidebar, topbar, and (on mobile) bottom nav.
 */

export type ShellRoute =
  | "dashboard"
  | "projects"
  | "project-detail"
  | "approvals"
  | "reports"
  | "rate-library"
  | "email-inbox";

export interface AppShellProps {
  activeRoute: ShellRoute;
  pageTitle: string;
  pageSubtitle?: string;
  topbarActions?: React.ReactNode;
  onNavigate: (route: AppRoute) => void;
  onNewScan: () => void;
  onOpenSettings?: () => void;
  children: React.ReactNode;
}

const TOKENS = {
  bgDark:    "#0D1B2A",
  bgLight:   "#F0F4F8",
  navy:      "#1A3A5C",
  sidebarBorder: "#1e3a5c",
  blue:      "#1D6EFD",
  teal:      "#0EA5E9",
  darkText:  "#1E293B",
  grayLt:    "#94A3B8",
  grayMd:    "#64748B",
  grayNav:   "#4B5563",
  border:    "#E2E8F0",
  white:     "#FFFFFF",
};

interface NavLink {
  route: ShellRoute;
  label: string;
  icon: string;
  appRoute?: AppRoute; // destination — omitted if the nav item has a bespoke handler
}

interface NavSection {
  heading: string;
  items: NavLink[];
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ES";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AppShell: React.FC<AppShellProps> = ({
  activeRoute,
  pageTitle,
  pageSubtitle,
  topbarActions,
  onNavigate,
  onNewScan,
  onOpenSettings,
  children,
}) => {
  const { tenant } = useTenant();
  const isMobile = useIsMobile();

  const sections: NavSection[] = [
    {
      heading: "Main",
      items: [
        { route: "dashboard", label: "Dashboard", icon: "🏠", appRoute: { name: "dashboard" } },
        { route: "projects",  label: "Projects",  icon: "📁", appRoute: { name: "projects" } },
      ],
    },
    {
      heading: "Workflow",
      items: [
        { route: "approvals", label: "Approvals", icon: "✅", appRoute: { name: "approvals" } },
        { route: "reports",   label: "Reports",   icon: "📈", appRoute: { name: "reports" } },
      ],
    },
    {
      heading: "Tools",
      items: [
        { route: "rate-library", label: "Rate Library", icon: "🏪", appRoute: { name: "rate-library" } },
        { route: "email-inbox",  label: "Email Upload", icon: "📧", appRoute: { name: "email-inbox" } },
      ],
    },
  ];

  const bottomNavItems: { route: ShellRoute | "scan"; label: string; icon: string }[] = [
    { route: "dashboard", label: "Home",     icon: "🏠" },
    { route: "projects",  label: "Projects", icon: "📁" },
    { route: "scan",      label: "Scan",     icon: "⚡" },
    { route: "rate-library", label: "Library", icon: "🏪" },
    { route: "reports",   label: "Reports",  icon: "📈" },
  ];

  const handleNav = (r: NavLink) => {
    if (r.appRoute) onNavigate(r.appRoute);
  };

  const tenantName = tenant?.name || "ElectraScan";

  return (
    <>
      <style>{SHELL_CSS}</style>
      <div className="es-app">
        {/* ─── Sidebar (desktop) ───────────────────────────── */}
        {!isMobile && (
          <aside className="es-sidebar">
            <div className="es-sidebar-logo">
              <div className="es-logo-icon">⚡</div>
              <div style={{ minWidth: 0 }}>
                <div className="es-logo-text">ElectraScan</div>
                <div className="es-logo-sub" title={tenantName}>{tenantName}</div>
              </div>
            </div>

            <nav className="es-sidebar-nav">
              {sections.map(section => (
                <div key={section.heading}>
                  <div className="es-nav-section">{section.heading}</div>
                  {section.items.map(item => {
                    const isActive =
                      activeRoute === item.route ||
                      // highlight "projects" when viewing a project detail
                      (item.route === "projects" && activeRoute === "project-detail");
                    return (
                      <div
                        key={item.route}
                        className={`es-nav-item${isActive ? " active" : ""}`}
                        onClick={() => handleNav(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") handleNav(item);
                        }}
                      >
                        <span className="es-nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="es-nav-section">Quick Actions</div>
              <div
                className="es-nav-item"
                onClick={onNewScan}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") onNewScan();
                }}
              >
                <span className="es-nav-icon">📤</span>
                <span>Upload Drawings</span>
              </div>
            </nav>

            <div className="es-sidebar-footer">
              {onOpenSettings && (
                <div
                  className="es-nav-item"
                  onClick={onOpenSettings}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenSettings(); }}
                  style={{ marginBottom: 6 }}
                >
                  <span className="es-nav-icon">⚙️</span>
                  <span>Settings</span>
                </div>
              )}
              <div className="es-user-chip">
                <div className="es-user-avatar">{initialsOf(tenantName)}</div>
                <div className="es-user-name" title={tenantName}>{tenantName}</div>
              </div>
            </div>
          </aside>
        )}

        {/* ─── Main column ─────────────────────────────────── */}
        <div className="es-main">
          <div className="es-topbar">
            <div style={{ minWidth: 0 }}>
              <div className="es-topbar-title">{pageTitle}</div>
              {pageSubtitle && <div className="es-topbar-sub">{pageSubtitle}</div>}
            </div>
            <div className="es-topbar-actions">
              {topbarActions}
              <div className="es-version-badge" title="ElectraScan version">⚡ ElectraScan v1.0</div>
            </div>
          </div>

          <div className="es-page-content">
            {children}
          </div>
        </div>

        {/* ─── Mobile bottom nav ──────────────────────────── */}
        {isMobile && (
          <nav className="es-bottom-nav">
            {bottomNavItems.map(item => {
              const isActive = item.route !== "scan" && activeRoute === item.route;
              return (
                <button
                  key={item.route}
                  className={`es-bottom-nav-item${isActive ? " active" : ""}`}
                  onClick={() => {
                    if (item.route === "scan") {
                      onNewScan();
                    } else {
                      onNavigate({ name: item.route } as AppRoute);
                    }
                  }}
                >
                  <div className="es-bottom-nav-icon">{item.icon}</div>
                  <div>{item.label}</div>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
};

export default AppShell;

// ─── Shell CSS (scoped with es- prefix) ──────────────────────────
const SHELL_CSS = `
.es-app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${TOKENS.bgLight};
  color: ${TOKENS.darkText};
  font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Sidebar */
.es-sidebar {
  width: 220px;
  background: ${TOKENS.bgDark};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 100;
}
.es-sidebar-logo {
  padding: 18px 16px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid ${TOKENS.sidebarBorder};
}
.es-logo-icon {
  width: 34px; height: 34px; border-radius: 8px;
  background: linear-gradient(135deg, ${TOKENS.blue}, ${TOKENS.teal});
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800; color: white;
  flex-shrink: 0;
}
.es-logo-text {
  font-size: 15px;
  font-weight: 700;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.es-logo-sub {
  font-size: 10px;
  color: ${TOKENS.grayLt};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.es-sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 12px;
}
.es-nav-section {
  padding: 16px 10px 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: ${TOKENS.grayNav};
}
.es-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  margin: 1px 6px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: ${TOKENS.grayLt};
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.es-nav-item:hover {
  background: #1e3a5c;
  color: white;
}
.es-nav-item.active {
  background: ${TOKENS.blue};
  color: white;
}
.es-nav-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
}
.es-sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid ${TOKENS.sidebarBorder};
}
.es-user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.es-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: ${TOKENS.blue};
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.es-user-name {
  font-size: 12px;
  color: ${TOKENS.grayLt};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Main column */
.es-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.es-topbar {
  height: 56px;
  background: ${TOKENS.white};
  border-bottom: 1px solid ${TOKENS.border};
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  flex-shrink: 0;
}
.es-topbar-title {
  font-size: 16px;
  font-weight: 700;
  color: ${TOKENS.darkText};
  line-height: 1.1;
}
.es-topbar-sub {
  font-size: 12px;
  color: ${TOKENS.grayMd};
  margin-top: 2px;
}
.es-topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.es-version-badge {
  font-size: 10px;
  font-weight: 600;
  color: ${TOKENS.grayMd};
  padding: 4px 9px;
  border: 1px solid ${TOKENS.border};
  border-radius: 20px;
  background: ${TOKENS.bgLight};
}
.es-page-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: ${TOKENS.bgLight};
}

/* Mobile bottom nav */
.es-bottom-nav {
  display: none;
}
@media (max-width: 767px) {
  .es-page-content {
    padding: 16px;
    padding-bottom: calc(60px + 16px + env(safe-area-inset-bottom, 0px));
  }
  .es-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 60px;
    background: ${TOKENS.bgDark};
    border-top: 1px solid ${TOKENS.sidebarBorder};
    z-index: 200;
    justify-content: space-around;
    align-items: center;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .es-bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    color: ${TOKENS.grayLt};
    font-size: 10px;
    font-weight: 600;
    transition: color 0.15s;
  }
  .es-bottom-nav-item.active {
    color: ${TOKENS.blue};
  }
  .es-bottom-nav-icon {
    font-size: 20px;
  }
  .es-topbar { padding: 0 16px; }
  .es-topbar-title { font-size: 14px; }
  .es-version-badge { display: none; }
}
`;
