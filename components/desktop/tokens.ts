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
 * Design rules (non-negotiable — see the reskin brief):
 *   - Body bg stays #faf9f5 (warm cream). Never pure white.
 *   - Cards are #ffffff with 1px #e8e6dc border — no drop shadows.
 *   - Orange (#d97757) is EARNED — primary CTAs, active nav, progress bars,
 *     AI sparkle icons only. Not decoration.
 *   - Poppins for numbers and headings, Lora for prose. Italic Lora is the
 *     accent (secondary copy, timestamps, subtitles).
 */

export const C = {
  // Surface
  bg:         "#faf9f5", // App body — warm cream
  bgSoft:     "#f4f2ea", // Sidebar + zebra row hover
  bgCard:     "#ffffff", // Cards, tables, inputs
  bgPaper:    "#fcfbf7", // Document preview paper (PDF letterhead container)
  border:     "#e8e6dc", // Card + divider borders
  borderSoft: "#efede4", // Ghost hover, nav hover

  // Text
  text:       "#141413", // Primary text
  textMuted:  "#6b6a63", // Secondary (labels, table muted)
  textSubtle: "#8a887f", // Tertiary (hints, deep de-emphasis)

  // Brand — earned, never decorative
  orange:     "#d97757",
  orangeDark: "#c46a4b", // Hover state
  orangeSoft: "#f5e4da", // Tinted chip / pill background

  // Semantic
  blue:       "#6a9bcc", blueSoft:  "#e2ecf5",  // Sent / informational
  green:      "#788c5d", greenSoft: "#e4ead9",  // Approved / Aries online / materials
  amber:      "#c89450", amberSoft: "#f3e6cf",  // Needs review / warning
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
