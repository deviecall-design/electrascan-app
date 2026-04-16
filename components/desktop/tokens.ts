/**
 * ElectraScan desktop design tokens.
 *
 * Single source of truth for colours, spacing, and typography across all
 * desktop screens. Kept as plain TS constants rather than CSS variables so
 * they're strongly typed and tree-shakeable.
 *
 * NOTE: the mobile App.tsx has its own `C` token object which is *mostly*
 * identical. The legacy mobile tokens can be deprecated when that file is
 * removed.
 */

export const C = {
  // Backgrounds
  bg: "#0A1628",          // App background (deep navy)
  navy: "#0F1E35",        // Slightly lighter navy for cards/nav
  card: "#132240",        // Surface cards
  cardHover: "#172A4D",   // Card hover state

  // Brand
  blue: "#1D6EFD",        // Primary accent
  blueLt: "#4B8FFF",      // Lighter accent (gradients, hover)
  electric: "#00D4FF",    // Electric cyan (used in the hero/wordmark)

  // Semantic
  green: "#00C48C",
  amber: "#FFB020",
  red: "#FF4D4D",
  purple: "#7C3AED",      // Variation-specific accent

  // Neutrals
  text: "#EDF2FF",        // Primary text on dark bg
  dim: "#8BA4C4",         // Secondary text
  muted: "#5C7A9E",       // Tertiary text / labels
  border: "#1A3358",      // Card/divider border

  // Live-data badge
  liveGreen: "#10B981",
  liveGreenBg: "rgba(16, 185, 129, 0.12)",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const FONT = {
  stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
  mono: "'SF Mono', ui-monospace, Menlo, monospace",
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
};
