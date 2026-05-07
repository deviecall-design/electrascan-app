# Smoke Test — overnight run 2026-04-16

## 1. Vercel deploy — DONE

After an interactive `vercel login` from the user's shell, `vercel --prod
--yes` deployed the current main branch cleanly.

- Production URL (alias): https://electrascan-app.vercel.app
- Deployment URL: https://electrascan-2yknnyyph-damienc13-5532s-projects.vercel.app
- Deployment id: `dpl_CT9ouP2ZtJGcLNufZuu5dibuV2do`
- Response: `HTTP/2 200` on GET /
- Build: vite 6.4.1, 2050 modules transformed, no errors.

Initial blocker: CLI wasn't authed and there was no `VERCEL_TOKEN` in
env, so the device-code flow had to be completed from the user's
browser. Once authed, subsequent `vercel --prod` calls from this session
run without prompts (auth is cached under `~/.local/share/com.vercel.cli`
on macOS).

## 2. Build check — PASS (local vite build)

As a substitute for a live deploy, ran `npx vite build` locally:

```
vite v6.4.1 building for production...
✓ 2048 modules transformed.
✓ built in 1.86s
```

No TypeScript or bundling errors. Warnings are pre-existing chunk-size
advisories (main bundle 1.3 MB un-gzipped, 383 kB gzipped — dominated by
pdfjs + html2canvas + konva + three, none of which this task touched).

## 3. Flow walkthrough (code-trace, no live URL)

### 4-step estimate flow — PASS (by inspection)

Traced `App.tsx` `<App>` → `screen` state machine:

| Step | Screen | Entry point | Status |
|------|--------|-------------|--------|
| 1 | `upload` | `DashboardScreen.onNewScan` → `goToScan()` | renders (App.tsx:448) |
| 2 | `scanning` | `handleFile()` after file drop | renders (App.tsx:491) |
| 3 | `results` | `detectElectricalComponents()` resolve | renders (App.tsx:502) |
| 4 | `estimate` | `ResultsScreen.onBuildEstimate` → `handleNewEstimate()` | renders (App.tsx:633) |

All four transitions rely on already-shipped code paths that the build
successfully types and bundles.

**Not live-tested** — running the scan requires
`VITE_ANTHROPIC_API_KEY`, which isn't wired into this session. The
detection happy-path can't be exercised without that key.

### Variation Report — PASS (by inspection)

- Enters via `ProjectScreen.onOpenVariation(project)` → `openVariation()`
  in App.tsx:789 → `setScreen("variation")`.
- `<VariationReport>` renders at App.tsx:874 when `variationPair` is set.
- `openVariation()` correctly handles 2+ estimates, 1 estimate
  (synthesises baseline), and 0 estimates (demo fallback).
- Risk flags flow: when `result?.risk_flags` is non-empty, they're
  threaded in as `detectedRiskFlags`; otherwise the prototype mocks
  render with a "· sample (no scan data)" suffix.

### Supabase variations save — KNOWN FAILURE MODE (expected)

The `saveVariationReport()` call in `services/variationService.ts` will
currently surface **"Saved locally · cloud sync unavailable"** on every
export, because the `variations` Supabase table does not yet exist.

This is the deliberate graceful-degradation path — a TODO block in
`services/variationService.ts` documents the table DDL + RLS policy
needed to unblock it. Per the overnight-run constraints, I did not
create the table or RLS policy; the app continues to function, the PDF
and CSV still download locally, and the UI notifies the user that
cloud sync is unavailable.

**To unblock**: create a `variations` table in Supabase with the columns
listed in `services/variationService.ts`, plus an RLS policy permitting
the anon role to `INSERT`.

### Export Quote button — PASS (by inspection)

- Verified in App.tsx:751 (post-commit `e03fc33`): the primary "Export
  Quote" button renders in both draft and locked states, disabled only
  when `items.length === 0`.
- The secondary "🔒 Lock & Finalise" button shows only while
  `!locked`, and is similarly disabled when no items exist.
- `exportEst()` is unchanged — the text-snapshot export path is
  preserved.

## 4. Open items (non-blocking)

- **Vercel auth** needs a one-time human-driven `vercel login`.
- **Supabase `variations` table** needs DDL + RLS.
- **Anthropic API key** (`VITE_ANTHROPIC_API_KEY`) for live scan testing.
- **EstimatesView.tsx orphan**: `components/EstimatesView.tsx` is not
  imported anywhere; it's residual takeoff-app scaffolding. Safe to
  delete in a dedicated cleanup commit if desired.
- **Bundle size**: the main chunk is 1.3 MB (383 kB gz). Consider lazy
  loading pdfjs/konva/three when those features are wired up for real.
