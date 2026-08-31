---
name: ElectraScan
description: Local-first electrical estimating — takeoff to bid to wholesaler order, in one loop.
colors:
  verdigris: "oklch(0.42 0.095 180)"
  verdigris-deep: "oklch(0.34 0.075 180)"
  amber-signal: "oklch(0.72 0.16 75)"
  paper: "oklch(1 0 0)"
  panel: "oklch(0.97 0.006 180)"
  panel-sunken: "oklch(0.945 0.009 180)"
  ink: "oklch(0.16 0.01 180)"
  ink-muted: "oklch(0.52 0.014 180)"
  hairline: "oklch(0.90 0.008 180)"
  success: "oklch(0.55 0.13 150)"
  error: "oklch(0.58 0.22 27)"
typography:
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.verdigris}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.verdigris-deep}"
  button-secondary:
    backgroundColor: "{colors.panel-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    height: "28px"
  badge-status:
    backgroundColor: "{colors.amber-signal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
  input-default:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
    height: "28px"
---

# Design System: ElectraScan

## 1. Overview

**Creative North Star: "The Quiet Multimeter"**

ElectraScan should feel like a well-made instrument, not a dashboard performing for an audience. A multimeter doesn't decorate its reading — it gives you the number, clearly, and gets out of the way. Every screen here carries that same restraint: dense, precise, calm, and built for someone who opens it fifty times a day and needs it to stay out of their head. The system is currently a stock shadcn gray scaffold with no committed identity; this spec introduces the first real brand pair — a deep verdigris teal and a warm amber-gold — used exactly as sparingly as a good instrument uses color: to mark a reading, not to decorate the case.

This system explicitly rejects the bloated legacy enterprise/construction-ERP look — dense toolbars, dated skeuomorphic chrome, menus that assume a full-time power user. It also rejects the obvious "electrician" trope: no safety yellow, no black hazard stripes, no bolt-icon literalism. And it rejects consumer-app playfulness — this is a professional's tool, approachable through clarity and plain language, not through cartoon warmth.

**Key Characteristics:**
- Dense, single-family typography — no display font, ever.
- One brand color used for action and selection; a second, warmer color used only for highlights and status.
- Flat by default; lift (shadow) is reserved for things that float above the canvas — modals, popovers, dragged items.
- Compact controls (28px buttons/inputs) tuned for someone working the interface all day, not glancing at it once.

## 2. Colors

> **Status (2026-08-31): this section is aspirational, not what ships.** The
> verdigris/teal scheme below was proposed but never implemented. The palette
> actually rendered by the app lives in `components/desktop/tokens.ts`, mirrored
> as `--es-*` variables in `index.css` — both must be edited together. It is
> currently the navy/blue scheme (`#0A1628` surface, `#1D6EFD` accent), restored
> from the original design after a period on warm cream + orange (`d85ecbf`).
> Note the brand keys are still named `orange*` for call-site compatibility;
> their values are blue. Reconcile this document with the tokens before treating
> it as a source of truth.

Restrained: two brand colors carry the whole identity, and both are used sparingly against a near-white, barely-tinted-teal neutral scaffold.

### Primary
- **Verdigris** (`oklch(0.42 0.095 180)`): the one color that means "act on this." Primary buttons, active tab/nav state, focus rings, current selection on the takeoff canvas. Not used for decoration or emphasis text.
- **Verdigris Deep** (`oklch(0.34 0.075 180)`): hover/pressed state for verdigris surfaces only.

### Secondary
- **Amber Signal** (`oklch(0.72 0.16 75)`): the second brand color — warmer, lighter, unmistakably distinct from verdigris in both hue and lightness. In the product app, reserved for status highlights: quote-sent badges, "needs attention" markers, the one thing on a busy screen that should catch the eye first — not used for primary actions there. **Exception**: on a Committed/dark-verdigris band (the marketing landing page's hero and closing CTA), Amber Signal *is* the primary action fill, because a verdigris button on a verdigris background would vanish. See The Dark-Band Substitution Rule below.

### Neutral
- **Paper** (`oklch(1 0 0)`): the base canvas. Pure white, no hidden warmth — the brand color carries the mood, not the background.
- **Panel** (`oklch(0.97 0.006 180)`): card and container backgrounds, a hair off paper, barely tinted toward verdigris's hue.
- **Panel Sunken** (`oklch(0.945 0.009 180)`): the second neutral layer — sidebar, toolbar, and app-shell chrome sit here, one step recessed from the working canvas.
- **Ink** (`oklch(0.16 0.01 180)`): body text and headings. Near-black with a whisper of the brand hue, never pure gray.
- **Ink Muted** (`oklch(0.52 0.014 180)`): secondary/meta text — timestamps, helper copy, placeholder text. Still reaches AA contrast against paper and panel; this is not the place to drop to light gray.
- **Hairline** (`oklch(0.90 0.008 180)`): borders and dividers.

### Semantic (Status)
- **Success** (`oklch(0.55 0.13 150)`): completed/ordered/paid states.
- **Error** (`oklch(0.58 0.22 27)`): destructive actions, validation failures — this is the existing `--destructive` value, kept as-is for continuity.

### Named Rules
**The One Reading Rule.** Only one color speaks at a time. Verdigris marks the action; amber marks the thing needing attention. They never both fire on the same element — if a button is verdigris, its badge is never amber, and vice versa.

**The No-Stripe Rule.** No side-stripe borders, no black/yellow hazard patterns, no bolt iconography as a design motif. The trade is the subject matter, not the aesthetic.

**The Dark-Band Substitution Rule.** On any Committed-strategy dark-verdigris surface (a hero band, a closing-CTA card), Amber Signal substitutes for Verdigris as the primary action fill — verdigris-on-verdigris has no contrast. This is the one place Amber is a primary action, not a highlight. It does not extend to the product app's light surfaces, where Verdigris remains the only primary-action color and Amber stays reserved for status.

## 3. Typography

**Body Font:** Inter (with system-ui, sans-serif fallback)

**Character:** One family carries everything — headings, buttons, labels, dense table data. No display face; nothing here is trying to be read from across a room.

### Hierarchy
- **Headline** (600, 1.5rem/24px, line-height 1.3): page-level titles ("Project Estimates"). One per screen.
- **Title** (600, 1.25rem/20px, line-height 1.3): section and modal headers. Currently mixed between 600 and 700 across components — standardize on 600; reserve 700 for nothing, so weight stops being an accidental signal.
- **Body** (400, 0.875rem/14px, line-height 1.5): the default UI voice — form labels, descriptions, list rows, most of the interface.
- **Label** (700, 0.75rem/12px, line-height 1.4, uppercase, 0.04em tracking): dense meta text — section eyebrows in the sidebar, table headers, badge text. Reserved for genuinely secondary information, not for anything a user reads as content.

### Named Rules
**The One-Family Rule.** Inter does every job. If a screen needs more visual weight, reach for size or weight within Inter, never a second typeface.

## 4. Elevation

Flat by default. Structural depth comes from tonal layering (Panel Sunken beneath Panel beneath Paper), not shadows — the sidebar and toolbar read as "behind" the canvas because they're a shade darker, not because they float above it. Shadows are reserved for things that genuinely leave the document flow: modals, popovers, command palettes, and items being dragged on the takeoff canvas.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)`): modals, dropdowns, popovers — anything rendered above the page in its own layer.
- **Drag** (`box-shadow: 0 8px 16px -4px rgb(0 0 0 / 0.18)`): an item actively being dragged (a shape on the canvas, a card being reordered) — communicates "this is temporarily lifted," not a permanent resting state.

### Named Rules
**The Flat-Canvas Rule.** The takeoff canvas, sidebar, and estimate tables are always flat. If you're reaching for a shadow on a resting surface, use a tonal layer instead.

## 5. Components

### Buttons
- **Shape:** rounded corners (8px, `rounded-md`).
- **Primary:** Verdigris background, white text, 28px height (`h-7`), compact horizontal padding (8px). Hover deepens to Verdigris Deep.
- **Secondary/Ghost:** Panel Sunken or transparent background, ink text; hover lifts to Panel Sunken.
- **Destructive:** tinted error background (10% opacity) with error-colored text, not a filled error button — reserves full-saturation red for genuine confirmation moments only.
- **Sizing:** five sizes (xs/sm/default/lg/icon) already exist and should stay — density is a feature here, not a compromise.

### Badges (Status Pills)
- **Style:** fully rounded (`rounded-full`), 20px height, 12px uppercase label text.
- **Default/Secondary:** neutral (Panel Sunken background, ink text) for informational tags.
- **Signal:** Amber Signal background with ink text for "needs attention" states (quote sent, awaiting response).
- **Success/Error:** the semantic success/error tokens, used only for their literal meaning (ordered, paid, failed) — never repurposed as decoration.
- Replace ad-hoc `bg-blue-600`, `text-green-700`, `bg-red-50`-style one-off Tailwind colors currently scattered across status badges with these named tokens.

### Cards / Containers
- **Corner Style:** 8-10px radius (`rounded-lg`).
- **Background:** Panel, with a 1px `ring-foreground/10`-equivalent hairline border, never a shadow at rest.
- **Internal Padding:** 16px (12px in the compact `size="sm"` variant).

### Inputs / Fields
- **Style:** Panel background at low opacity, 1px hairline border, 8px radius, 28px height to match buttons.
- **Focus:** border shifts to Verdigris, 2px verdigris-tinted ring — no glow, no color change beyond the ring.
- **Error:** border and ring shift to Error; error text below the field, not a red background fill.

### Navigation
- **Style:** left sidebar on Panel Sunken, uppercase 12px Label-tier section headers (already the pattern in use), active item marked with Verdigris text/icon — not a filled background block.
- **States:** hover lifts to Panel; active/selected uses Verdigris for text and icon only, keeping the row itself flat.

## 6. Do's and Don'ts

### Do:
- **Do** keep one color per meaning: Verdigris = act on this, Amber Signal = look at this. Never mix them on the same element.
- **Do** keep controls compact (28px buttons/inputs, 12-14px body text) — density serves someone using this all day, per PRODUCT.md's "fast and unencumbered" principle.
- **Do** use tonal layering (Panel → Panel Sunken) for structural depth; reserve shadows for modals, popovers, and dragged items only.
- **Do** size touch targets and contrast generously enough to hold up in bright, uncontrolled jobsite light — this is a stated accessibility requirement, not a nice-to-have.

### Don't:
- **Don't** reach for the electrician clichés — no safety-yellow/black hazard striping, no bolt-icon motifs, no navy-and-hazard-orange combinations. PRODUCT.md's positioning is the bid-to-order workflow, not trade imagery.
- **Don't** build "bloated legacy enterprise software" — no dense toolbars, no skeuomorphic chrome, no menu structures that assume a trained power user. PRODUCT.md names this directly as the anti-reference.
- **Don't** leave ad-hoc Tailwind status colors (`bg-blue-600`, `text-green-700`, `bg-red-50`) scattered per-component — route every status color through the tokens above.
- **Don't** drop secondary text to light gray for "elegance" — Ink Muted already sits at the edge of comfortable contrast; anything lighter fails outdoors.
- **Don't** use a shadow on a resting card, sidebar, or table row. If it's not a modal, popover, or drag state, it stays flat.
- **Don't** mix 600 and 700 font-weight on headings of the same tier — pick 600 for both Headline and Title and stop treating weight as accidental.
