/**
 * ElectraScan desktop design tokens — Anthropic design system.
 *
 * Single source of truth for colours, typography, spacing and radius across
 * all desktop screens. Kept as plain TS constants (not CSS variables) so
 * they're strongly typed and tree-shakeable, and inline styles can consume
 * them directly without escaping into Tailwind.
 *
 * Sourced from the canonical mockup at app/mockup/page.jsx — do not diverge
 * without updating that reference. Mirror tokens also exist as `--es-*` CSS
 * variables in index.css for Tailwind / CSS-only consumers.
 *
 * PALETTE — light workspace, navy sidebar, electric blue.
 *
 * Token NAMES are unchanged so existing call sites pick up the light theme.
 * The `orange*` keys stay as the brand-blue aliases.
 *
 * Design rules:
 *   - Page background is slate-50. Cards are white.
 *   - The sidebar is navy (`sidebar` / `ink`). Do not paint page text with it.
 *   - Blue (#1F56E6) is the primary action. One sans (Inter) everywhere;
 *     JetBrains Mono for codes and amounts.
 *   - bgPaper stays white for the printed quote preview.
 */

export const C = {
  // Surface — light workspace
  bg:         "#f8fafc",
  bgSoft:     "#f1f5f9",
  bgCard:     "#ffffff",
  bgPaper:    "#ffffff",
  border:     "#e2e8f0",
  borderSoft: "#f1f5f9",

  // Text on light
  text:       "#0f172a",
  textMuted:  "#475569",
  textSubtle: "#64748b",

  paperText:      "#0f172a",
  paperTextMuted: "#475569",

  // Brand blue. Named orange* so existing call sites keep working.
  orange:     "#1f56e6",
  orangeDark: "#1a45b8",
  orangeSoft: "#eef4ff",

  blue:       "#1f56e6", blueSoft:  "#eef4ff",
  green:      "#059669", greenSoft: "#ecfdf5",
  amber:      "#b45309", amberSoft: "#fffbeb",
  red:        "#e11d48", redSoft:   "#fff1f2",

  // Navy chrome — sidebar and the Aries card only
  sidebar:    "#0a1628",
  ink:        "#0a1628",
  ink2:       "#132240",
  sidebarText:"#cbd5e1",
  sidebarMuted:"#64748b",
} as const;

// Inter for every UI string. Mono for rate codes and money.
export const FONT = {
  heading: "Inter, system-ui, sans-serif",
  body:    "Inter, system-ui, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const RADIUS = {
  sm: 4,   // Inline pill
  md: 6,   // Buttons, nav items
  lg: 10,  // Cards, panels
  xl: 12,  // Large cards, dropzone
  pill: 20,
} as const;

// Grain texture applied to body background. Reproduced as-is from the mockup
// — subtle fractal noise at 3.5% opacity. Keeps the navy surface from
// reading as a flat fill without being distracting.
export const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")";
