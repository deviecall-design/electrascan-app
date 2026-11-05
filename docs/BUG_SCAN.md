# ElectraScan bug scan — 16 Sep 2026

**Audience:** Damien (Vesh Electrical)  
**Repo:** `deviecall-design/electrascan-app`  
**Scanned:** `main` @ `ec7233c` (includes merged #9 Detect MuPDF, #10 Review UX, #11 Aries online pill)  
**Method:** code grep + flow trace + `npx vitest run`. No signed-in production walk in this run.

This is a pick-list, not a fix batch. Suggested direction only.

---

## Closed — do not re-open unless they regress

| Was | Evidence it stayed fixed |
|---|---|
| Fake Level 2 SVG Detect | `SourcePlanPreview` renders MuPDF pages of the uploaded file; `planPage.test.ts` asserts no “Level 2” |
| Quote qty×rate / EST-YYMM-XXXX / Aries Bondi leak / Bondi flash | `scanQuote.ts`, `estimateReferenceService.ts`, `ariesSuggestion.ts`, `useSupabaseQuery` starts on `[]` |
| Review EDB≠GPO, confidence bands, grouped queue | `lib/reviewClassification.ts` + tests |
| Dead Aries “online” pill | removed in #11 |

`DETECTED_ITEMS` (14 mock GPOs/lights) still **exists** in `ScanDetailScreen.tsx` but is **unused**. Mockup `app/mockup/page.jsx` still uses it; that file is not mounted.

---

## Tests

```
npx vitest run
  Test Files  12 passed (12)
  Tests       98 passed (98)
```

All green. Coverage is **helpers already fixed in #9/#10**, not the live shell:

| Covered | Not covered (so these bugs would not fail CI) |
|---|---|
| GST / EST-YYMM-XXXX / GPO $260 vs Zetr | Review resolutions → Quote totals |
| Confidence bands, EDB≠GPO mapping | Auth gate, scan persist, PDF company profile |
| `useSupabaseQuery` empty-while-loading | DesktopShell dead controls, Approvals DocuSign auth |
| Aries Bondi leak | Project Reports mock identity |

---

## Flow traces (live `DesktopApp` path)

Production mounts `index.tsx` → `DesktopApp` → `screens/*`. `App.tsx` / `AppShell` / `ProjectEstimateEditor` are **unmounted**.

### Upload → Detect → Review → Quote → PDF

1. **Upload** (`/detection/new` → `StepUpload`)  
   Calls `detectElectricalComponents`. Accepts PDF/PNG only. Copy still says “PDF, PNG, or **DWG**”. Never asks for client. Never calls `insertScan`. Result lives only in React state.

2. **Detect** (`StepDetecting` + `SourcePlanPreview`)  
   Real PDF via MuPDF. **No symbol pins** (vision still has no x/y; `gridPosition()` is display-only). Opening a saved `/detection/:id` does **not** hydrate `detected_items` or the PDF. Empty item list still shows **Review detected items** (`0 >= 0` → ready).

3. **Review** (`StepReview`)  
   Queue classify / not-in-scope / rate edits are **local state**. Parent `detectedItems` is never updated. **Generate quote** is lockable, but the **step bar can jump to Quote** anyway.

4. **Quote / PDF** (`StepQuote`)  
   Totals from original detection, not Review. Letterhead uses `getActiveCompanyProfile()` → hardcoded `VESH_PROFILE`, not Settings. **Send to client** persists to `/api/estimates/create` (needs JWT); it does not email. **Download PDF** can fire before Send and stamp a peeked `EST-YYMM-XXXX` that is not allocated.

### New estimate

`/estimate/new` → `/detection/new`. CTA is honest. There is still **no estimate editor route**.

### Dashboard / Estimates

Empty live lists stay empty (no Bondi flash). Estimate **rows look clickable** but do not open a quote. Dashboard row click goes to `/estimate` (the list).

---

## P0 — wrong money, wrong classification, or data/trust leak

### 1. Review edits never reach the Quote (or the PDF)

- **Severity:** P0  
- **Where:** `screens/ScanDetailScreen.tsx` — `StepReview` vs `StepQuote`  
- **Why it matters:** Classify & Add, Adjust rate/qty, and Not In Scope update `reviewQueue` only. Quote still sums the raw Detect list. Damien can “fix” an EDB/GPO/rate in Review and still send the uncorrected number.  
- **Fix direction:** Lift line items to the screen root. On classify, write qty/rate/category/desc back; on not-in-scope, drop or zero the line. Pass that array into Quote/PDF/persist. Add a test: classify a $0/wrong line → quote total changes.

### 2. Desktop app has no sign-in (or sign-out)

- **Severity:** P0  
- **Where:** `index.tsx` / `DesktopApp.tsx` vs unmounted `App.tsx` + `components/LoginScreen.tsx` + `contexts/AuthContext.tsx`  
- **Why it matters:** Detect (`/api/detect`) and Save quote (`/api/estimates/create`) require a Supabase JWT. `LicenseProvider` is mounted but never consulted. Catch-all `path="*"` would swallow `/login` if someone added it without a route. A new device or expired session sees “sign in to run a scan / save this quote” with **no login UI**. Existing localStorage sessions may still work for Damien — that hides the hole.  
- **Fix direction:** Mount `AuthProvider` + `LoginScreen` in `DesktopApp`. Gate detect/save. Add sign-out on the user chip. Honour `isLicensed`.

### 3. Quote PDF / letterhead ignore Settings; seed ABN/licence look fictional

- **Severity:** P0  
- **Where:** `services/companyProfile.ts` (`VESH_PROFILE`, `getActiveCompanyProfile`); `screens/ScanDetailScreen.tsx` StepQuote; `utils/estimatePdf.ts`; `screens/SettingsScreen.tsx`  
- **Why it matters:** Settings copy says the profile “sits behind every branded estimate”. Quote and PDF always use tenant #0 seed: name Vesh, ABN `51 234 567 891`, licence `EC-204857`, Brookvale address, `/logo-placeholder.svg` (ElectraScan mark). A saved `company_profile` row is unused. Sending a PDF to a builder with a placeholder ABN is a legal/trust failure.  
- **Fix direction:** `getActiveCompanyProfile` should read the Settings/Supabase row (with an explicit “not set” state, not a fake ABN). Do not print licence/ABN until they are real. Wire logo from `logo_url`.

### 4. Project Reports presents Mark Arnesen as the live job

- **Severity:** P0  
- **Where:** `screens/ProjectReportsScreen.tsx` — `PROJECT` / `BUDGET` / `MILESTONES` / `OVERRUNS`  
- **Why it matters:** Header is **Mark Arnesen · 8/110 North Steyne · Linda Habak Design · EST-2026-497 · $56,463** with no “sample” banner (Variation/Approvals have one). Fetches `EST-2026-497`; on miss, mock numbers stay. Looks like Vesh’s current contract. Export Report is a no-op (`onClick={() => {}}`).  
- **Fix direction:** Empty state when there is no live estimate. If a sample is required, label it like Variation. Stop using the retired `EST-2026-497` ref.

### 5. Approvals can send a live DocuSign envelope for a fake job, with no API auth

- **Severity:** P0  
- **Where:** `screens/ApprovalsScreen.tsx`; `api/docusign/envelope.ts`  
- **Why it matters:** Banner says sample, but **Send** POSTs to an unauthenticated endpoint (`Access-Control-Allow-Origin: *`, no JWT). Signer defaults to James Caldwell’s email. Document is a placeholder PDF titled as `EST-2609-0001`. Integration/account/user IDs are hardcoded in source. A mis-click (or anyone who finds the URL) can email a real person.  
- **Fix direction:** Require the same Bearer JWT as `/api/detect`. Disable Send until a real estimate PDF is attached. Do not pre-fill third-party emails. Move DocuSign identifiers to env.

---

## P1 — broken UX / dead controls that look live

### 6. Scans are not persisted; reopening a scan is empty

- **Where:** `StepUpload` never calls `insertScan`; `ScanDetailScreen` `useEffect` sets `liveScan` but not `detectedItems` / `sourceFile`  
- **Why:** Refresh after a 2–4 min Vision run loses the takeoff. Dashboard/Detection lists only DB rows. `/detection/:id` has no PDF and no lines.  
- **Fix:** Insert scan on upload; save `detected_items` + file (storage) on complete; hydrate on load.

### 7. “Send to client” does not send; client is never captured

- **Where:** `persistQuoteFromScan`; `StepUpload`; Quote “Prepared for”  
- **Why:** Button implies email. It only inserts `status: "sent"` with `client: "Client not set"` if no `liveScan.client`. Upload has no client field. PDF and Dashboard then show a blank/placeholder recipient.  
- **Fix:** Collect client before Quote. Rename to **Save quote** until mail exists, or wire a real send.

### 8. Estimate editor is unreachable; list rows are fake-clickable

- **Where:** `DesktopApp.tsx` routes; `screens/EstimateScreen.tsx` (cursor pointer, **no `onClick`**); `screens/DashboardScreen.tsx` → `/estimate`; `components/ProjectEstimateEditor.tsx` only used from unmounted `ProjectDetail`  
- **Why:** Damien cannot open a saved quote to edit lines, margin, or status. MoreHorizontal is decorative.  
- **Fix:** `/estimate/:id` that loads `line_items` (read-only v1 is enough) or route into Quote with persisted data. Do not use pointer cursor until it navigates.

### 9. Hardcoded Vision credits, ⌘K palette, bell

- **Where:** `components/desktop/DesktopShell.tsx`  
- **Why:** Sidebar **847 / 1,000 · Resets 1 May** looks metered (May 2026 is stale). ⌘K / search toggles `_paletteOpen` and renders nothing. Bell has an unread dot and no handler. User chip is always **Damien C.**  
- **Fix:** Hide until live, or wire real usage / palette / notifications. User chip from `auth.user`.

### 10. Step bar bypasses Review lock; empty Detect still continues

- **Where:** `StepBar` `onClick={() => onStep(s.n)}`; `StepDetecting` `ready = revealed >= source.length`  
- **Why:** Unrecognised items can be skipped. A failed/empty detect still offers Review → empty Quote.  
- **Fix:** Disable future steps until the previous step has data; keep lock on Quote.

### 11. Quote preview values can vanish on navy (paper vs `C.text`)

- **Where:** `StepQuote` `LetterRow` — totals use `color: C.text` (`#EDF2FF`) on `C.bgPaper` white; letterhead border `C.text`; muted labels `C.textMuted`  
- **Why:** Parent comment already warns near-white text on paper. Subtotal/GST/Total figures are the ones that matter.  
- **Fix:** Use `C.paperText` / `C.paperTextMuted` for every letterhead node (including `LetterRow`).

### 12. Variation Send / Download are dead; sample still looks like a product surface

- **Where:** `screens/VariationReportScreen.tsx` — PrimaryButton/GhostButton with **no onClick**; Mark Arnesen Rev FG→B; Zetr $525 lines  
- **Why:** Banner says sample, but the primary CTA looks live.  
- **Fix:** Disable + “Coming soon”, or generate a real variation from two scans.

### 13. Detection list timestamps always “just now”; DWG promised

- **Where:** `screens/DetectionScreen.tsx` `s.t ?? "just now"` (`ScanRow` has `started_at`, not `t`); `StepUpload` copy  
- **Why:** Every live scan looks brand new. DWG upload errors.  
- **Fix:** Format `started_at`. Drop DWG from copy until supported.

### 14. Browser Anthropic key fallback still in the client

- **Where:** `analyze_pdf.ts` `callDetect` — `VITE_ANTHROPIC_API_KEY` + `dangerouslyAllowBrowser`  
- **Why:** #9 routed keys through `/api/detect`. This branch still inlines a key if the proxy 500s or there is no JWT. `.env.example` still documents `VITE_ANTHROPIC_API_KEY`.  
- **Fix:** Delete the browser path once Vercel `ANTHROPIC_API_KEY` is confirmed. Never ship `VITE_` Anthropic keys.

### 15. PDF Download can print an unallocated estimate number

- **Where:** `StepQuote.handleDownloadPdf` uses `peekNextReference()` until Send succeeds  
- **Why:** Two quotes can PDF as the same `EST-YYMM-0001`.  
- **Fix:** Allocate on first persist (draft), then download; or watermark `DRAFT` until Send.

### 16. Rate library subtitle always “last synced today”

- **Where:** `screens/PricingScheduleScreen.tsx`  
- **Why:** Looks like a live Simpro/TLE sync.  
- **Fix:** Show real `synced_at` or drop the clause.

---

## P2 — polish / dual product / known deferrals

### 17. Symbol pin overlay still missing on the real PDF

- **Where:** `SourcePlanPreview.tsx`; `lib/scanQuote.ts` `gridPosition()`; vision output has no x/y (`analyze_pdf.ts` components)  
- **Why:** Detect shows the drawing (good) but still implies a map without marks. Deferred in #9 on purpose.  
- **Fix:** Do not draw fake pins. Later: vision boxes or manual Konva pins. Until then, a one-line “pins not on drawing yet” in the pane chrome.

### 18. Theme split (navy app vs cream HTML / Review chips)

- **Where:** `index.html` `body { background-color: #faf9f5; color-scheme: light }`; `index.css` comments still say “warm cream”; `tokens.ts` navy; Review queue / Detect error use `#FEF2F2` / `#FFFBEB` light RAG  
- **Why:** Cream flash before React; mixed warm chips on navy. Dual brand with ElectraScan mark + Groundplan footer tagline.  
- **Fix:** Match `index.html` to `--es-bg`. One comment pass. Footer tagline without Groundplan unless that product is in play.

### 19. Leftover demo rate table and unused `DETECTED_ITEMS`

- **Where:** `ScanDetailScreen.tsx` `RATE_LOOKUP` (GPO-001 = $85+$45 = **$130**, not Vesh $260); unused `DETECTED_ITEMS`  
- **Why:** Live mapping sets `rateCode: ""` so this usually does not price a job. Re-wiring the constant would resurrect demo money.  
- **Fix:** Delete both; price only from catalogue `unit_price`.

### 20. Cooktop Detect badge can still read as GPO before Review mapping

- **Where:** `lib/scanQuote.ts` `SYMBOL_MAP` COOKTOP_* → `"GPO"` (category is already “Appliance circuits”)  
- **Why:** `mapDetectionToItems` overwrites symbol via `mapComponentToReviewFields`, so Review is OK. Detect list might flash GPO if that overwrite is skipped.  
- **Fix:** Map cooktops to a non-GPO badge in `SYMBOL_MAP`.

### 21. `getCurrentTenantId()` falls back to Vesh UUID

- **Where:** `lib/tenants.ts`  
- **Why:** RPC miss stamps another user’s quote onto the Vesh tenant. Fine for single-tenant beta; dangerous the moment a second tenant exists.  
- **Fix:** Fail closed when unauthenticated or RPC null.

### 22. Hardcoded “Good morning, Damien.” / Aries always “Vesh electrical quotes”

- **Where:** `DashboardScreen.tsx`; `lib/ariesSuggestion.ts`  
- **Why:** Identity theatre next to an empty pipeline.  
- **Fix:** First name from auth; drop firm name or read it from profile.

### 23. Dual estimate brains still in repo

- **Where:** unmounted `App.tsx` `incrementEstimateNumber` (`EST-2026-497-001`); `components/ApprovalsScreen.tsx`; `utils/estimatePdf.ts` comment examples  
- **Why:** Next person to mount AppShell will resurrect the old reference format.  
- **Fix:** Do not remount AppShell. Optionally quarantine or delete.

### 24. Xero / MYOB still theatre

- **Where:** Project Reports Accounting tab “Ready” / “Phase 8”; `api/xero/*`  
- **Why:** Sprint 2 roadmap. Buttons/status look further along than the code.  
- **Fix:** Label “Not connected”. Do not say Ready until OAuth completes.

---

## Suggested pick order

1. **Review → Quote data flow** (P0-1) — highest dollar risk on the path Damien actually uses.  
2. **Auth gate on DesktopApp** (P0-2) — unblocks save/scan on a clean browser.  
3. **Company profile on PDF** (P0-3) — stop shipping placeholder ABN.  
4. **Kill or cage mock screens** (P0-4, P0-5, P1-12) — Project Reports identity; Approvals DocuSign.  
5. **Persist scan + open estimate** (P1-6, P1-8) — so a quote can be found again.  
6. **Dead chrome** (P1-9, P1-11) — credits / ⌘K / bell / paper text.  
7. **Pin overlay** (P2-17) — after honesty; needs vision coordinates or a manual pin tool.

---

## Out of scope / not claimed as bugs

- Empty Dashboard after a successful `[]` fetch — correct for a tenant with no saved quotes.  
- Pin-accurate overlay — feature, not a regression of #9.  
- Filling historical Vesh jobs into the estimates table.  
- Collapsing AppShell (keep it unmounted).
