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
 * PALETTE — restored to the original navy/blue scheme (2026-08-31).
 *
 * The warm-cream + orange reskin landed in d85ecbf (2026-04-21). This file
 * returns the values to the dark navy and electric blue of the original
 * ElectraScan look while keeping every token NAME unchanged, so all screens
 * pick it up without edits. Do not rename these keys — roughly 250 call sites
 * across screens/ and components/ reference them.
 *
 * The `orange*` keys are retained as aliases mapped onto the blue brand ramp.
 * They are referenced widely; renaming them would be a large, risky diff while
 * the product is in front of a client. Treat them as "brand accent".
 *
 * Design rules:
 *   - Body bg is #0A1628 (deep navy). Cards sit on #132240.
 *   - Blue (#1D6EFD) is EARNED — primary CTAs, active nav, progress bars,
 *     AI sparkle icons only. Not decoration.
 *   - bgPaper stays light: it backs the printed quote preview, which must
 *     read as paper. Text on it uses `paperText`, never `text`.
 */

export const C = {
  // Surface
  bg:         "#0A1628", // App body — deep navy
  bgSoft:     "#0F1E35", // Sidebar + zebra row hover
  bgCard:     "#132240", // Cards, tables, inputs
  bgPaper:    "#ffffff", // Document preview paper — stays light, it is paper
  border:     "#1A3358", // Card + divider borders
  borderSoft: "#172A4D", // Ghost hover, nav hover

  // Text
  text:       "#EDF2FF", // Primary text on dark
  textMuted:  "#8BA4C4", // Secondary (labels, table muted)
  textSubtle: "#5C7A9E", // Tertiary (hints, deep de-emphasis)

  // Text for the light paper surface (quote/PDF preview only)
  paperText:      "#0A1628",
  paperTextMuted: "#4A5B72",

  // Brand — earned, never decorative. Named orange* for call-site
  // compatibility; the values are the blue brand ramp.
  orange:     "#1D6EFD", // Primary accent
  orangeDark: "#4B8FFF", // Hover — lighter on dark, not darker
  orangeSoft: "#16294a", // Tinted chip / pill background on navy

  // Semantic — tuned for contrast on the navy surface
  blue:       "#4B8FFF", blueSoft:  "#16294a",  // Sent / informational
  green:      "#00C48C", greenSoft: "#0d3a30",  // Approved / Aries online / materials
  amber:      "#FFB020", amberSoft: "#3a2c10",  // Needs review / warning
} as const;

// Font stacks — loaded via Google Fonts <link> in index.html (no npm dep).
export const FONT = {
  heading: "'Poppins', Arial, sans-serif",     // Headings, numbers, labels, buttons
  body:    "'Lora', Georgia, serif",           // Prose, italic accents
  mono:    "'JetBrains Mono', ui-monospace, monospace", // Rate codes, monetary values
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
// — subtle fractal noise at 3.5% opacity. Keeps the warm-paper feel without
// being distracting.
export const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")";
