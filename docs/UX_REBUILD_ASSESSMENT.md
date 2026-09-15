# ElectraScan — UI/UX health and rebuild-vs-iterate assessment

**Audience:** Damien  
**Scope:** Live app at electrascan-app.vercel.app (production is GitHub `main`, which already contains `feat/electrascan-desktop-v2`).  
**Date:** 15 Sep 2026  

This is an engineering recommendation after auditing the live Quote + Detect path (Sirius scan screenshots), not a full rewrite spec.

---

## 1. Current architecture health

ElectraScan is **three products in one repo**, only one of which is mounted:

| Surface | Entry | Status |
|---|---|---|
| **Live desktop** | `index.tsx` → `DesktopApp.tsx` → `screens/*` | What Vercel serves |
| **AppShell / projects** | `components/AppShell.tsx` + `ProjectEstimateEditor` + `ProjectContext` (localStorage) | **Not mounted.** Richer estimate maths (category margins, cable BOM, TLE) never reach the live Quote step |
| **Legacy mobile App.tsx** | Original scan → room schedule → estimate editor | **Explicitly unmounted** (“reference archive”) |

**Detection pipeline** (`analyze_pdf.ts`): two Claude Vision passes (legend, then room count) × Vesh catalogue. It does **not** return symbol x/y on the drawing. Quantities and prices are list data.

**Estimate / pricing:** the live Quote step (`screens/ScanDetailScreen.tsx` StepQuote) is a **separate calculator** from `estimateTotals()` in `ProjectContext`. Dashboard KPIs read Supabase `estimates.value` when live, otherwise **Bondi Tower mock rows**. New scans live in React state for that tab session; they are not the same records as the dashboard mock list.

**Persistence:** mixed. Scans/estimates *can* hit Supabase; the 4-step wizard mostly does not persist a quote with a real sequential reference. `peekNextReference()` / `/api/estimates/create` (`EST-YYMM-XXXX`) exist but were not used on the Quote letterhead.

**Verdict:** architecture is iterable, but the live UX is a **desktop mockup that later had real detection piped into it**. That mismatch is the root of “it used to work” vs “Bondi / fake office plan / $71k GPOs”.

---

## 2. Detection overlay regression (May → now) — localized vs systemic

**What Damien saw:** Detect complete overlay labelled “Level 2 · Page 3/5”, rooms OFFICE A / WORKSTATIONS / BOARDROOM / BREAKOUT / KITCHEN, footer `analysed by Claude Vision · 0.4.2`. That is **not** the Sirius PDF.

**Evidence in git (not a pdf.js Y-flip):**

1. `984c68b` (23 Apr 2026) — *feat(desktop): Phase 5 — scan detail 4-step flow*  
   Introduced `ScanDetailScreen` with a **hand-drawn FloorPlan SVG** (grid, five named rooms, pulsing markers). Commit message says real drag-and-drop is a follow-up.

2. `30ce55a` (24 Apr 2026) — *wire Steps 2–4 to real detection output*  
   Explicitly: **“real detection has no x/y”** → `gridPosition()` scatters badges on that SVG (`x = 60 + (i * 73) % 420`). Markers were never registered to the PDF.

3. `9462e05` (9 May 2026) — *wire real upload + Claude Vision to ScanDetailScreen*  
   Real files flow into the **same mock plan**. May “working” behaviour on this screen was never plan-aligned overlay; the original takeoff canvas (`components/BlueprintCanvas.tsx`, Konva + PDF, initial commit 2 Apr) is unused by `DesktopApp`.

4. Hardcoded chrome still in Detect: `"Level 2 · Page 3/5"` — matches the screenshot exactly.

**Severity:** High for trust (the map **claims** to be the drawing).  
**Class:** **Systemic to the desktop rewrite**, not a broken matrix on an otherwise-correct overlay. Restoring May App.tsx/BlueprintCanvas would be a product choice (bring the real canvas back into the Detect step), not a one-line transform fix.

**This PR:** Detect step shows the **uploaded PDF/PNG** instead of the fake office plan, and states that counts live in the list (pins are not on-drawing). Full pin registration needs vision to emit coordinates **or** reuse BlueprintCanvas — that is a follow-up, not a weekend coordinate tweak.

---

## 3. UI/UX debt from the live audit

| Issue | Evidence | Trust impact |
|---|---|---|
| **Bondi Towers on Sirius** | Aries copy hardcoded: “Bondi Tower's last 3 quotes…” | Looks like the wrong job’s estimate |
| **EST-2026-0143 on every new quote** | Hardcoded; sits next to mock Bondi `EST-2026-0142` | New job looks like Bondi’s next revision |
| **Power outlets $70,980** | Category rollup of GPO-typed lines × catalogue $ | Unbelievable vs ~6 GPO on one sheet; mix of (a) greedy catalogue match (Zetr $525 vs standard $260), (b) cooktops/towel rails typed as `GPO_STANDARD`, (c) Pass 2 repeating legend qty per room / legend+room double count |
| **18% margin invented** | Hardcoded to match Bondi Aries copy; Vesh profile default is **15%** | Quote ≠ company default |
| **Demo DETECTED_ITEMS fallback** | Empty/failed detection still quoted the 10-row mock | Wrong job, wrong qty |
| **Dashboard Bondi rows** | `useSupabaseQuery` fallback arrays | Empty accounts look like Bondi pipeline |
| **Dead Quote CTAs** | Download PDF / Send to client not wired on StepQuote | Preview is theatre |
| **Dual estimate maths** | Live Quote ≠ `estimateTotals` / PDF util | Totals will diverge if AppShell is remounted |
| **Empty / branding** | “Client not set”, mock scans, hardcoded licence line | Unfinished white-label |

Pricing sanity: Vesh **standard double GPO is $260 ex GST installed** (legitimate AU per-point). 6 GPOs × 5 pages × $260 ≈ **$7,800**, not $70k. $70,980 implies ~273 points at $260 or ~135 at Zetr $525 — detection qty and/or SKU selection, not “GST applied twice” on the screenshot (116,985 + 18% + 10% GST is internally consistent).

---

## 4. Recommendation: iterate, do not rebuild from scratch

**Do not greenfield-rebuild** while `analyze_pdf.ts`, `vesh_catalogue.ts`, `lib/symbol_map.ts`, TLE matching, and Supabase tenant/auth still encode the domain. A rewrite would re-litigate detection prompts and AU pricing from zero and would not ship faster than fixing the mockup-shaped shell.

**Iterate on this codebase**, with a hard rule: **one estimate brain, one shell.**

### Criteria that would justify a rebuild (none are fully true today)

- Detection engine is unsalvageable (it is not; overlay was never wired)
- Catalogue / GST model is wrong (GST path on Quote is consistent; SKU/qty/category are fixable)
- Auth/tenant/Supabase must be thrown away (they should stay)

### Pragmatic middle path (recommended)

1. **Keep:** Claude legend+count pipeline, Vesh catalogue, symbol map, `/api/detect`, EST-YYMM-XXXX allocator, TLE/Xero work already on `main`.
2. **Replace / finish the live shell’s Detect + Quote:** real drawing preview (this PR), sequential reference, Aries scoped to this job, category/SKU/qty guards, wire PDF export to `generateEstimatePDF` using the same totals helper.
3. **Collapse dual apps:** either mount AppShell’s editor as the estimate of record, or delete it from the mental model. Do not keep two GST/margin implementations.
4. **Optional later:** pin overlay = BlueprintCanvas (or vision x/y). That is a feature, not a precondition for quoting.

### What this PR already changes (small, proven)

- Aries never names Bondi on a non-Bondi job  
- Quote reference uses `EST-YYMM-XXXX`, not `EST-2026-0143`  
- Detect preview is the uploaded plan, not OFFICE A  
- Catalogue: cooktops/specials are not `GPO_STANDARD`; generic “double power point” stays $260  
- Room counts cannot exceed legend totals for the same type  
- Shared AU totals helper + tests  

### Needs Damien’s numbers before more pricing work

- Expected Sirius GPO count and whether rates are supply-and-install $260  
- Whether Zetr in the legend should auto-upgrade from standard GPO  
- Whether quote margin should be 15% (profile) or estimator-editable (18% was fake Bondi context)

---

**Bottom line:** The product did not “forget how to align to a PDF.” The desktop Detect step **never used the PDF**. Fix that honesty and the quote identity bugs first; rebuild only if you want a new UX on top of the same engine.
