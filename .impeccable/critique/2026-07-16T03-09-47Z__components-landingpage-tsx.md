---
target: landing page (components/LandingPage.tsx)
total_score: 32
p0_count: 0
p1_count: 2
timestamp: 2026-07-16T03-09-47Z
slug: components-landingpage-tsx
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No loading/transition feedback on CTA click (low-stakes for a static page) |
| 2 | Match System / Real World | 4 | Trade-accurate language throughout ("bill of materials," "wholesaler," "takeoff") |
| 3 | User Control and Freedom | 2 | No in-page anchor nav (Features / How it works) — only path is linear scroll or the CTA |
| 4 | Consistency and Standards | 4 | Identical button treatment, icon system, spacing rhythm |
| 5 | Error Prevention | 3 | n/a — no forms yet |
| 6 | Recognition Rather Than Recall | 4 | Numbered loop + icon + connecting line makes sequence self-evident |
| 7 | Flexibility and Efficiency | 3 | 44px touch targets meet the jobsite requirement; nothing keyboard-specific needed here |
| 8 | Aesthetic and Minimalist Design | 4 | Asymmetric feature layout, restrained footer, no filler |
| 9 | Error Recovery | 3 | n/a — nothing to break yet |
| 10 | Help and Documentation | 2 | No FAQ, no pricing, no "what happens after trial" |
| **Total** | | **32/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment**: Clears the AI-slop bar convincingly. No side-stripe borders, gradient text, hero-metric template, identical card grids, or per-section eyebrows. The one numbered sequence (the 5-step bid-to-order loop) is earned — a genuine chronological dependency traceable almost verbatim to PRODUCT.md's positioning, not scaffolding-by-reflex. The feature section deliberately breaks the card-grid reflex (one featured item at a different visual weight + three divider-separated rows). The hero mockup is a legitimate code-built illustration, not "colored blocks where a photo belongs" — it uses the app's own real tokens and tells a specific story.

**Deterministic scan** (`detect.mjs --json`, exit 2, 4 findings — all against `LandingPage.tsx`):
- L84, L107: font sizes `0.65rem`/`0.6rem` off the DESIGN.md ramp — **intentional**, these are the hero mockup's own miniature "zoomed-out app chrome" text, documented inline in the code as such.
- L123: color `oklch(0.48 0.09 178)` outside DESIGN.md's palette — **intentional**, a same-hue gradient stop for the hero's atmospheric background, documented inline.
- L128: font size `3.25rem` off the ramp — **new, legitimate observation**: DESIGN.md's type scale (Headline 1.5rem / Title 1.25rem / Body / Label) is scoped to the product register's compact UI and has no entry for a brand-register hero display size. Not a bug, but worth formalizing (see Priority Issues).

**Live browser overlay** (bundled detector injected into the running page) reported 8-9 anti-patterns, two of which I verified directly against the live page and found to be **false positives** from tool limitations, not real defects:
- `low-contrast: 1.0:1 — text #ffffff on #ffffff` (hero heading, ×5-6): I queried the actual computed styles myself — the heading's `color` is `rgb(255,255,255)` but the hero section's `background-color` is `oklch(0.42 0.095 180)` (deep teal), not white. The detector can't resolve the CSS `radial-gradient()` background-image and appears to default to assuming white. Real contrast (white on deep teal) is very high, comfortably AAA. **False positive, confirmed.**
- `cramped-padding: 0px vertical padding for 14px text` (CTA buttons): I checked computed styles directly — all three CTA buttons use `display: flex; align-items: center` with a fixed height (`36px`/`44px`) and `padding: 0`, which centers text via flexbox rather than padding. This is a valid, common technique the detector's heuristic doesn't recognize as equivalent to padding. **False positive, confirmed.**
- `overused-font` / `single-font: only font used is inter`: expected and intentional — DESIGN.md's "One-Family Rule" for the product register, correctly carried onto this brand surface.

Network/console evidence: no console errors, no failed requests (both `/favicon.svg` loads returned 200), no horizontal overflow at 375px, and all three CTA buttons get a real, visible `focus-visible` outline confirmed via computed style (not just class presence) — a genuine strength, easy to get wrong.

## Overall Impression

This is a strong first landing page — it doesn't look AI-generated, the copy is specific and trade-accurate, the one-action-per-page discipline is unusually good, and the reveal-animation engineering is defensively built against exactly the failure mode (headless/JS-off renders shipping blank) that's easy to get wrong. The single biggest opportunity isn't visual — it's that the page over-promises against what's actually behind the button: "Start your free trial, no credit card required" currently just navigates into the live, unfinished app dashboard with no signup, no account, and no bridge between the spacious marketing register and the dense in-app UI.

## What's Working

1. **The 5-step loop is earned, not decorative.** The only numbered sequence on the page maps directly to a real chronological dependency from PRODUCT.md's own positioning language — exactly the distinction the numbered-scaffolding ban exists to enforce, held correctly.
2. **The asymmetric feature layout actively resists the card-grid reflex** — one featured item at a different visual weight plus three divider rows, considered rather than templated.
3. **`useReveal` is defensively engineered for real failure modes.** Base state is always fully visible; the intersection observer only ever adds motion; even mid-animation opacity never drops below 40%. Verified live: this is the fix for a bug caught during the original build (sections were shipping invisible in a headless render), and the fix holds up under a second, independent review.

## Priority Issues

- **[P1] Placeholder CTA overpromises what's behind it.** "Start your free trial" / "No credit card required" routes straight into the real app dashboard — no account, no onboarding, no signup at all. **Why it matters**: this reads as a functional misrepresentation the moment a real visitor clicks through; it's a trust cost, not just an unfinished feature. **Fix**: either gate general release on a real signup/auth flow, or soften the copy to match current reality (e.g. "Explore the app") until one exists. **Suggested command**: `/impeccable harden` (or `/impeccable clarify` for the copy-only interim fix).

- **[P1] Amber-as-primary-CTA contradicts DESIGN.md's own written rule.** DESIGN.md states Amber Signal is "reserved for status highlights... never used for primary actions," yet both landing-page CTAs use it as exactly that. The visual choice is correct (a verdigris button on a verdigris hero would vanish), but it's undocumented. **Why it matters**: the next person to touch this system has no written permission for the exception and may "fix" it into an invisible button, or worse, copy the wrong pattern into a context where it doesn't apply. **Fix**: add a named exception to DESIGN.md — something like "on Committed/dark-verdigris bands, Amber Signal substitutes for the primary action." **Suggested command**: `/impeccable document` (to amend DESIGN.md) or handle directly.

- **[P2] No wayfinding.** Nav has zero anchor links (no Features / How it works) — a scanning visitor who isn't ready to commit has only "scroll" or "click the one CTA" as options, which scores User Control and Freedom a 2/4. **Fix**: add 1-2 anchor links (e.g. "How it works," "Features") to the sticky nav. **Suggested command**: `/impeccable layout`.

- **[P2] No pricing or FAQ surface.** Zero information on cost or what the "trial" includes. For a busy tradesperson deciding whether new software is worth their time mid-bid-season, this is a real objection left unanswered. **Fix**: at minimum, a one-line pricing mention or a short FAQ before general release. **Suggested command**: `/impeccable onboard` (or a follow-up `/impeccable shape` for a dedicated pricing section).

- **[P3] No-JS dead end.** The CTA is a plain `onClick` handler with no `<a href>` fallback — a visitor with JavaScript disabled has no way to proceed at all. Low probability, but an absolute failure mode that conflicts with the "fast and unencumbered" principle. **Fix**: give the CTA a real `href` alongside the client-side navigation. **Suggested command**: `/impeccable harden`.

## Persona Red Flags

**Jordan (First-Timer)**: Clicking any CTA drops Jordan straight into the real, dense app dashboard with zero orientation — no tour, no empty-state guidance. Combined with no FAQ/pricing on the landing page itself, Jordan has no way to self-answer basic questions before committing to click through. High abandonment risk at the exact moment the page was trying to convert.

**Riley (Stress Tester)**: Slow network / JS-disabled is a mixed bag — the scroll-reveal mechanism actually **passes** this test cleanly (verified: content never depends on JS to become visible), a genuine strength. But full JS-disabled **fails** outright: the CTA has no fallback href, so a JS-off Riley is stuck with no way forward at all.

**Casey (Distracted Mobile User)**: The sticky nav keeps "Start free" reachable at every scroll depth on mobile, so Casey never has to scroll back up to act — a solid mitigation. Soft spot: the 5 loop steps stack to a long single column below 640px, meaning a fast, distracted scroller passes through a long stretch of content before reaching the features section — acceptable given the sticky CTA safety net, but worth watching if bounce data ever surfaces it as real.

## Minor Observations

- Copyright year uses `new Date().getFullYear()` — correctly dynamic.
- The hero mockup's `$18,240.00` estimate chip is a nice authentic touch tying into PRODUCT.md's "accuracy is the product" principle.
- The footer's refusal to fabricate Product/Pricing/Company nav columns it has no pages for (rather than shipping dead links) is unusually disciplined for a first landing page — worth preserving as a norm, not "fixing" later by padding it out.
- `alt=""` on both favicon `<img>` tags is the *correct* WCAG pattern here (the logo sits beside visible text spelling out "ElectraScan"), not an oversight — only becomes a real issue if that logo is later wrapped in a home-link `<a>` without its own accessible name.

## Questions to Consider

1. Is a lightweight bridging/onboarding layer actually required before the hand-off from this page's spacious marketing register into the dense in-app UI ships for real users — or is "the CTA merely navigates" being treated as done when it isn't?
2. With zero accumulated social proof (no testimonials, no logos — there's nothing to fabricate honestly yet), is "no credit card required" alone enough trust signal for a contractor deciding whether new software is worth their time mid-bid-season?
3. Should the amber-as-primary-button exception become a permanently documented DESIGN.md rule now, before someone reads the "never a primary action" line literally and quietly breaks the one button that actually needs it?
