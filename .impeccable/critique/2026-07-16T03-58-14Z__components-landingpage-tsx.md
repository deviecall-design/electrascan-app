---
target: landing page (components/LandingPage.tsx)
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-07-16T03-58-14Z
slug: components-landingpage-tsx
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/browser-evidence sub-agent), second pass after the P1/P2/P3 fixes from the first critique.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Still no loading/transition feedback on CTA click (low-stakes, unchanged) |
| 2 | Match System / Real World | 4 | Trade-accurate language throughout |
| 3 | User Control and Freedom | 4 | **Up from 2.** Nav wayfinding works and now stays reachable at every scroll depth (sticky-header bug found and fixed this pass) |
| 4 | Consistency and Standards | 4 | **Up from a dinged 3.** Nav-button focus rings now match the CTA treatment (fixed this pass) |
| 5 | Error Prevention | 4 | FAQ pre-empts the two most common hesitations (signup, install) before they become friction |
| 6 | Recognition Rather Than Recall | 4 | Numbered loop + icon language stays legible and consistent |
| 7 | Flexibility and Efficiency | 4 | Real `<button>`/`<a>` elements throughout, `prefers-reduced-motion` honored in two independent places |
| 8 | Aesthetic and Minimalist Design | 4 | Three genuinely distinct section compositions, no repeated template |
| 9 | Error Recovery | 3 | n/a — nothing to break yet |
| 10 | Help and Documentation | 3 | FAQ closes the biggest gap; no fallback contact channel remains a minor, deliberate omission |
| **Total** | | **37/40** | **Excellent** |

**Trend for `components-landingpage-tsx`: 32 → 37**

## Anti-Patterns Verdict

**LLM assessment**: Clean pass, and specifically checked whether the new FAQ section (added since last critique) breaks the page's established rhythm — it doesn't. Same heading treatment, same section spacing, same `Reveal` stagger as Loop/Features; the lack of icons on FAQ items reads as the correct convention for plain Q&A, not a different design system bolted on. Nav wayfinding (3 new links) doesn't clutter the header — generously spaced, and collapses entirely below `sm` rather than becoming a hamburger workaround.

**Deterministic scan** (4 findings, unchanged from last pass, all previously acknowledged as intentional): the mockup's micro-text sizes, the hero gradient's off-ramp color stop, and the hero's `3.25rem` display heading size (DESIGN.md's compact product-register scale has no brand-hero entry — noted last time as a scoped, legitimate extension).

## Overall Impression

This pass earns the jump from 32 to 37. Both sub-agents independently verified the previous fixes hold (honest CTA copy, documented DESIGN.md exception, working anchor-scroll routing), and Assessment A caught one real functional regression I'd missed: the sticky header wasn't actually sticking once scrolled — confirmed independently by direct measurement (`headerTop` moved 1:1 with `scrollY` instead of staying at 0). Root cause was a CSS layout issue (`min-h-screen` instead of `h-screen` on the page's scroll wrapper, which let the actual scrolling container become ambiguous and broke `position: sticky`'s containing-block calculation). Fixed and reverified live during this same review: the header now stays pinned at `top: 0` at any scroll depth, confirmed via direct DOM measurement and a viewport screenshot mid-scroll.

Two smaller items surfaced and were also fixed in the same pass: the hero's secondary CTA text ("Free to try — no signup required") measured ~3.3–3.9:1 contrast against the hero gradient — below WCAG AA — while the identical line in the closing CTA passed comfortably at 5.15:1; matched the opacity so both now pass. And the three new nav buttons had no custom focus-visible ring (falling back to a faint browser default) while every other interactive element on the page has a deliberate branded ring; added the same treatment for consistency.

## What's Working

1. **Editorial discipline shows up in the code, not just the copy.** Comments throughout explain *why* things were deliberately left out (no invented pricing FAQ, no fabricated footer nav) — that honesty carries through into what actually shipped.
2. **Real compositional variety.** Stepper, asymmetric feature layout, plain FAQ grid — three distinct treatments, not one card template stamped three times.
3. **Reduced-motion is handled correctly in two independent places** (the scroll-to-section jump and the `.ds-reveal` CSS), and the reveal system still can't ship a blank section on a cold/headless render — a genuine piece of engineering-for-design care that held up under a second, independent review.

## Priority Issues

All three concrete issues this pass surfaced were fixed and reverified live before this report:

- **[Fixed] Sticky header wasn't sticking.** `min-h-screen` → `h-screen` on the page wrapper so it's unambiguously the scroll container `position: sticky` resolves against. Verified: header stays at `top: 0` at `scrollTop: 800`.
- **[Fixed] Hero subtext contrast below AA.** `text-white/60` → `text-white/75` to match the closing CTA's already-passing treatment.
- **[Fixed] Nav button focus rings inconsistent with the rest of the page.** Added the same `focus-visible:outline-verdigris` treatment used on the CTA elements.

One item remains open, deliberately:

- **[P3] No fallback support channel if a visitor's question isn't one of the four FAQ items.** Minor, and arguably the correct honest choice for a pre-launch page rather than inventing a support contact that doesn't exist yet — left as a backlog note, not fixed.

## Persona Red Flags

- **Field/on-site user** (PRODUCT.md: "sometimes on-site with a laptop or tablet"): nav links survive at tablet width (confirmed at 768px); only true phone widths collapse them, a reasonable trade. The sticky-header bug would have hit this persona hardest — now fixed, the nav/CTA shortcut stays available at any scroll depth.
- **Time-pressed solo estimator**: the FAQ's "no install / no credit card" answers remove the two biggest hesitation points before they'd bother asking anyone — direct match for PRODUCT.md's "fast and unencumbered" principle.
- **Skeptical evaluator comparing tools**: the honest CTA copy and the FAQ's explicit refusal to invent a price read as trustworthy rather than evasive — matches the "approachable, not enterprise" personality goal.

## Minor Observations

- Nav label "How it works" doesn't lexically echo the Loop section's actual heading — cosmetic only, easy to infer on arrival.
- The favicon mark reused at two sizes (nav vs. footer) is a small, good consistency touch.
- The hero mockup's truncated "10× Downli…" label is intentional schematic chrome, not an overflow bug — flagged by neither assessment as a real issue, noted here only because a faster pass might misread it as one.

## Questions to Consider

1. Was the sticky-header regression the kind of thing that only shows up once you actually scroll and check — worth adding a lightweight visual regression check (a screenshot at a mid-scroll position) to the normal verification habit, not just at page-load?
2. Now that both structural gaps (wayfinding, documentation) are closed, is 37/40 "ship it" for this page, or is there a deliberate reason to hold for the still-open item (real signup flow, pricing) before wider distribution?
3. Given the FAQ's explicit refusal to invent pricing, is there a lightweight, honest thing to say about pricing model now (e.g. "free during beta") that would close Heuristic #10's remaining gap without overpromising?
