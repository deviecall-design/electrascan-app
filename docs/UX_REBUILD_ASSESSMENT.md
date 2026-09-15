# ElectraScan — UI/UX revision plan (rebuild vs iterate)

**Audience:** Damien (Vesh Electrical)  
**Live production:** https://electrascan-app.vercel.app — GitHub `main` @ `c3f1664` (7 Sep 2026). `feat/electrascan-desktop-v2` is an ancestor, not what Vercel Production tracks.  
**Date:** 15 Sep 2026  

This is the product/engineering recommendation after the live signed-in walk plus the Sirius Quote/Detect screenshots. It is not a greenfield rewrite spec.

---

## 0. Live production walk (signed in as Damien C. / Vesh Electrical)

| Observation | What it actually is |
|---|---|
| Dashboard/Estimates flash Bondi (`EST-2026-0142` · $28,450 · Sent) and scan `Switchboard_LV2_rev3.pdf` at 72%, then clear to **zero** | `useSupabaseQuery` **starts on mock arrays**, then a successful empty fetch replaces them. Empty is the real Vesh pipeline. |
| Chip: “Demo data — Supabase tables not yet created” | **Wrong diagnosis.** Damien is authenticated. Tables exist. The chip fired because `isLive` is false **during the mock flash** (and on fetch error). Empty ≠ missing schema. |
| `/estimate/new` dumps you on Dashboard | Catch-all `path="*"` → `/dashboard`. There is no new-estimate route. Creating a quote is `/detection/new`. |
| Variation arithmetic consistent; Approvals GST consistent | Those screens are **self-contained mocks**. Maths can be right while identity is still theatre. |
| Three reference formats: `EST-2026-0142`, `EST-2026-497-001`, `EST-26-001-v3` | Three leftover generators. Canonical allocator is **`EST-YYMM-XXXX`** (`EST-2609-0001`) via `/api/estimates/create`. |

### Prior Sirius evidence (still the Quote/Detect trust problem)

- Quote Aries named **Bondi Towers** on the Sirius job; letterhead **EST-2026-0143** (next to mock Bondi `EST-2026-0142`).
- Power outlets **$70,980** vs ~6 GPO visible on one sheet. Vesh standard double GPO is **$260 ex GST**. 6 × 5 pages × $260 ≈ **$7,800**. $71k is qty × SKU (Zetr/specials typed as GPO, legend qty repeated per room), **not GST twice**. Screenshot totals were internally consistent at 18% then 10% GST.
- Detect overlay “Level 2 · Page 3/5 / OFFICE A / BOARDROOM” is the **April mock SVG**. Bisect: 13 May prod `fc11733` still mounted `App.tsx`; 27 May `576d75e` switched to DesktopApp. Vision never returns x/y.

---

## 1. UI/UX revision plan (Detection overlay + Quote trust first)

Work the live `DesktopApp` → `screens/*` shell. Do not start a fourth app.

### P0 — Stop lying about the job (this sprint)

1. **Detect overlay (P0-1)**  
   MuPDF page view of the **uploaded PDF** (same engine as May/BlueprintCanvas). Page chrome from the file. No OFFICE A SVG. Pins are still list-only until vision emits x/y.

2. **Quote identity**  
   - Reference from `EST-YYMM-XXXX`, never `EST-2026-0143`.  
   - Aries never names another project unless that is the client on screen.  
   - Margin = company default **15%** (18% was Bondi copy).  
   - Category totals = summed lines, not fake 12/22/30% splits.

3. **Quote pricing sanity**  
   Generic “double power point” → **$260**, not Zetr $525. Cooktops / towel rails / heaters are not `GPO_STANDARD`. Room counts cannot exceed legend totals.

4. **Dashboard / Estimates empty state**  
   Signed-in empty must stay empty. **No Bondi flash.** No “tables not created” when the fetch succeeded with `[]`. `/estimate/new` must not 404 into Dashboard.

5. **Persist the quote**  
   Send writes `value` = GST-inclusive total so a Sirius (or any) quote can appear on Dashboard.

### P1 — One number, one reference, one route

6. **One estimate brain on the live path:** `computeQuoteTotals` (margin on ex-GST, then 10% GST) for Quote, PDF, Dashboard `value`, Approvals GST. Variation/Approvals already matched GST; keep them on the helper when those screens leave mock data.

7. **One reference format:** `EST-YYMM-XXXX`. Retire UI copy of `EST-2026-0142`, `EST-2026-497-001`, `EST-26-001-v3`. Legacy `incrementEstimateNumber` (AppShell) stays unmounted.

8. **Wire dead CTAs / routes:** `/estimate/new` → `/detection/new`. Download PDF. Detection nav badge must not be a fake `3`.

### P2 — Collapse the dual product

9. Either mount AppShell’s editor as the estimate of record **or** stop treating it as current. Do not keep `estimateTotals()` and Quote as peers.

10. White-label: client name, licence, Aries copy from this tenant/job only.

### P3 — Pin overlay (feature, not a rewrite gate)

11. Register symbols to the PDF (vision coordinates or Konva canvas). Until then, never imply the map is the drawing.

**Default pricing rules (do not block on a questionnaire):** $260 standard GPO unless the legend names Zetr; 15% margin unless the estimator edits it later; Quote persist is how Dashboard fills.

---

## 2. Overlay regression (bisect)

| SHA | Date | What production mounted | Drawing pane |
|---|---|---|---|
| `fc11733` | 13 May 2026 | `index.tsx` → **App.tsx** | Real filename + rooms from the scan. No fake office SVG. |
| `576d75e` | 27 May 2026 | merge desktop-v2 → **DesktopApp** | `ScanDetailScreen` FloorPlan SVG. Hardcoded “Level 2 · Page 3/5”. |
| `c3f1664` | 7 Sep 2026 | DesktopApp (current prod) | Same mock overlay until this PR. |

`gridPosition()` exists because **“real detection has no x/y”** (`30ce55a`). Pins were never on the PDF. May alignment was the **real file**, not a symbol map.

This PR restores MuPDF pages of the upload (BlueprintCanvas engine) with Page n/N from the PDF.

---

## 3. Rebuild vs iterate

**Iterate. Do not greenfield-rebuild.**

The live UX is a **desktop mockup that later had real detection piped in**. That is a shell problem. The domain (Claude legend+count, Vesh catalogue, symbol map, `/api/detect`, tenant/auth, TLE/Xero, EST-YYMM-XXXX) is salvageable and is what makes a rewrite slow.

### Criteria that would justify a rebuild

Rebuild only if **all three** are true:

| Criterion | Today |
|---|---|
| Detection engine cannot be made honest (overlay or list) | **False.** Overlay was never wired; list takeoff works. |
| Catalogue / GST model is the wrong product | **False.** GST path is consistent. SKU/qty/category are fixable. Variation + Approvals GST already checked out on the walk. |
| Auth/tenant/Supabase must be thrown away | **False.** Damien signed in as Vesh; empty pipeline is a real empty table, not a missing backend. |

A new UI on the same engine is allowed later. A new engine is not the faster path to “the map matches the PDF” or “Power outlets aren’t $71k”.

### What to keep vs replace

| Keep | Replace / finish |
|---|---|
| `analyze_pdf.ts`, `vesh_catalogue.ts`, `lib/symbol_map.ts` | Mock Detect SVG, Bondi Dashboard fallback, hardcoded Aries |
| `/api/detect`, `/api/estimates/create` | Catch-all swallowing `/estimate/new` |
| Vesh tenant + RLS | “Tables not created” copy |
| EST-YYMM-XXXX allocator | `EST-2026-*` / `EST-26-*-v3` chrome |

---

## 4. High-confidence small fixes (proven / in this PR)

Already landed or landing with this document:

- Aries scoped to the current job (no Bondi on Sirius).
- Quote letterhead `EST-YYMM-XXXX`; Send persists GST-inclusive `value`.
- Detect preview = **MuPDF pages of the uploaded PDF** (bisect: `fc11733` App.tsx → `576d75e` DesktopApp mock SVG). Quote letterhead shows **qty × rate** per line.
- GPO $260 default; specials out of Power outlets; legend qty cap.
- Shared `computeQuoteTotals` + Dashboard pending/win from the same helper.
- **No Bondi sample rows while loading**; empty live list stays empty.
- Banner copy: load / fetch error / empty — never “tables not created” for a signed-in empty account.
- `/estimate/new` → `/detection/new`.
- Canonical ref check `EST-YYMM-XXXX`; Approvals/Variation sample chrome uses that shape and is labelled sample.

**Not claimed as done:** pin-accurate overlay, collapsing AppShell, estimator-editable margin UI, filling Damien’s empty estimates table with historical jobs.

---

**Bottom line:** Production did not lose PDF alignment or invent GST twice. The desktop Detect step **never used the PDF**, and the Dashboard **dressed an empty Vesh account as Bondi Towers for one paint**. Fix honesty and Quote identity on this codebase. Rebuild only if you want a new shell on the same engine.
