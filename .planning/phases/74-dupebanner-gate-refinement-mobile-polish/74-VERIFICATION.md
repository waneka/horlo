---
phase: 74-dupebanner-gate-refinement-mobile-polish
verified: 2026-05-30T20:55:00Z
status: passed
score: 11/11 automatable must-haves verified
overrides_applied: 0
human_verification:
  - test: "MOB-01 SC#2 — Tap any input field (search box, comment composer, comment edit, add-watch search) on iPhone Safari"
    expected: "Page does NOT auto-zoom on focus (font-size floor + responsive text-base md:text-sm holds at runtime)"
    why_human: "iOS Safari runtime auto-zoom heuristic is not observable in jsdom (D-13 + feedback_mobile_ui_verify_on_prod); requires iPhone Safari on Vercel prod deploy"
  - test: "MOB-01 SC#3 — Two-finger pinch-zoom on any page after the iOS Safari fix"
    expected: "Pinch-zoom still works (viewport export untouched; maximum-scale=1 / user-scalable=no never set)"
    why_human: "Pinch-zoom is a Safari touch-runtime gesture; cannot be simulated in jsdom; verified on iPhone Safari on Vercel prod deploy"
  - test: "MOB-01 SC#4 — Visual confirmation in WatchForm, comment composer/edit, filters across mobile + desktop breakpoints"
    expected: "No visual regressions from the 16px-mobile font; shadcn primitives untouched, admin untouched, the 3 rewrites swap only the text-* token"
    why_human: "Visual fidelity across breakpoints requires browser eyes; jsdom does not compile Tailwind"
  - test: "DUPE-04 SC#1 visual — Add a watch via search whose catalog row matches an existing owned/wishlist row; observe ConfirmStep under the DupeBanner on horlo.app"
    expected: "Primary CTA (Add to Wishlist / Add to Collection / etc.) is NOT visible under the banner. Ghost row (Edit details / Start over) remains clickable. Inputs remain editable. Clicking 'Add another copy' makes the primary CTA reappear and become functional."
    why_human: "jsdom assertions guarantee structural absence (the <Button> is not in the DOM); visual confirmation that the confirm screen feels clean is a runtime call per CONTEXT D-15 + feedback_mobile_ui_verify_on_prod"
---

# Phase 74: DupeBanner Gate Refinement + Mobile Polish — Verification Report

**Phase Goal:** Users understand why the ConfirmStep CTA is unavailable when a DupeBanner is shown, and iOS Safari does not auto-zoom inputs across the app.

**Verified:** 2026-05-30T20:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-01 — When DupeBanner mounted, ConfirmStep primary CTA (Section 6) is NOT rendered (no Saving... copy, no disabled stub, no placeholder) | VERIFIED | `ConfirmStep.tsx:320-336` wraps `<Button>` block in `{!bannerActive && (...)}` early-return; mock at `AddWatchFlow.test.tsx:207-211` mirrors. 4 WR-01 tests assert `queryByText('Confirm primary').not.toBeInTheDocument()` |
| 2 | D-02 — Additive `bannerActive?: boolean` prop on ConfirmStep (default false) | VERIFIED | `ConfirmStep.tsx:95-100` interface declaration (with JSDoc), `:126` destructure `bannerActive = false`, prop count 4 hits in file |
| 3 | D-02 — AddWatchFlow.tsx:694 reverts `pending={state.pending}` AND adds `bannerActive={state.dupeContext != null}` | VERIFIED | `AddWatchFlow.tsx:694` = `pending={state.pending}`; `:695` = `bannerActive={state.dupeContext != null}`; `grep "pending={state.pending \|\| state.dupeContext"` returns 0 |
| 4 | D-03 — Ghost row (Edit details + Start over) stays mounted; price/reference/year inputs remain editable; only Section 6 button removed | VERIFIED | `ConfirmStep.tsx:297-316` Section 5 unaffected (outside the `{!bannerActive && ...}` block); Sections 1-4 also unaffected; mock keeps Start over + Edit details |
| 5 | D-04 + D-10 — 3 existing WR-01 tests pivoted from `toBeDisabled()` to disappearance-paired assertions on `data-testid='dupe-banner-{owned\|wishlist}'` | VERIFIED | Tests A/B/C at `AddWatchFlow.test.tsx:759/776/794` — each asserts `queryByText('Confirm primary').not.toBeInTheDocument()` AND `findByTestId('dupe-banner-{owned\|wishlist}').toBeInTheDocument()` |
| 6 | D-04 + D-10 — New WR-01 Test D added: pure absence-by-construction + no addWatch call | VERIFIED | Test D at `:824-835` — banner appears + CTA absent + microtask flush + `addWatch.not.toHaveBeenCalled()` |
| 7 | D-05 — No visual / DOM-order change beyond Section 6 conditional | VERIFIED | Only edit in `ConfirmStep.tsx` is the additive prop + the `{!bannerActive && (...)}` wrap of an existing block; no aria-live, no placeholder, no animation added |
| 8 | D-06 — globals.css gains @layer base block setting font-size 1rem on input/textarea/select | VERIFIED | `globals.css:166-172` — new `@layer base { input, textarea, select { font-size: 1rem; } }` block with inline comment "prevents iOS Safari auto-zoom on focus"; no `!important` |
| 9 | D-07 — 3 user-facing files rewrite `text-sm` → `text-base md:text-sm` on native form controls | VERIFIED | `CommentCompose.tsx:60` (textarea), `CommentItem.tsx:170` (textarea), `SearchEntry.tsx:242` (Combobox.Input) all have `text-base md:text-sm` |
| 10 | D-07 scope guard — admin-only files and shadcn primitives NOT modified | VERIFIED | `git log e491b2c1..HEAD -- src/components/admin/ src/components/ui/input.tsx src/components/ui/textarea.tsx` returns empty (no commits) |
| 11 | D-08 — src/app/layout.tsx viewport export remains `{ viewportFit: 'cover' }`; no maximumScale/userScalable/minimumScale | VERIFIED | `layout.tsx:29-31` unchanged since 2026-04-05; static guard `tests/static/no-iOS-zoom-viewport.test.ts` passes 7/7 |
| 12 | D-11 — Static guard file with `// @vitest-environment node` pragma on line 1 | VERIFIED | `head -1 tests/static/no-iOS-zoom-viewport.test.ts` = `// @vitest-environment node`; cites D-11 in header (1 hit); tests `maximumScale`, `userScalable`, `minimumScale` keys + raw HTML meta forms |
| 13 | D-12 — Static guard file with `// @vitest-environment node` pragma on line 1 | VERIFIED | `head -1 tests/static/no-text-sm-on-native-form-controls.test.ts` = `// @vitest-environment node`; cites D-12 in header; walks `src/components/comment/` + `src/components/watch/SearchEntry.tsx`; scope-limited (no admin walk); 2/2 pass |
| 14 | D-15 — All human items bundled into single v8.1 prod UAT walk | DEFERRED to human verification | Per CONTEXT D-15, prod UAT walk bundles Phase 72+73+74 in single Vercel deploy |
| 15 | Phase 68 D-03 ConfirmStep prop contract preserved (additive only — no rename/removal/semantic change of pending) | VERIFIED | `pending?: boolean` at line 93 unchanged; `bannerActive?: boolean` appended; `pending` semantic now reverted to "real async work" (interfaces 21+ existing props retained) |
| 16 | Phase 70 D-11 DupeBanner sibling-above-ConfirmStep pattern UNCHANGED | VERIFIED | `AddWatchFlow.tsx:661-672` `<DupeBanner ... />` sibling block unchanged; `git diff` against `DupeBanner.tsx` since phase start = empty |
| 17 | Build is the gate — npm run build exits 0 | VERIFIED | `npm run build` → "✓ Compiled successfully in 5.4s" + "✓ Generating static pages (33/33)" |
| 18 | font-medium guardrail (recurrence-5) — no new font-medium in modified files | VERIFIED | `grep -c font-medium` on the 5 modified source files: ConfirmStep=0, AddWatchFlow=0, CommentCompose=0, CommentItem=0, SearchEntry=2 (both pre-existing JSDoc comments citing the rule by name — not classes) |

**Score:** 18/18 truths verified structurally (4 of these defer the visual/runtime confirmation to bundled prod UAT per D-15)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/ConfirmStep.tsx` | bannerActive prop + Section 6 early-return null | VERIFIED | 4 bannerActive hits; Section 6 wrapped at line 320; Phase 68 D-03 contract intact |
| `src/components/watch/AddWatchFlow.tsx` | Reverted pending + bannerActive prop wired at line 694-695 | VERIFIED | `pending={state.pending}` + `bannerActive={state.dupeContext != null}` adjacent; OR-gate removed |
| `src/components/watch/AddWatchFlow.test.tsx` | 4 WR-01 tests using disappearance-paired pattern | VERIFIED | Tests A/B/C/D at lines 759/776/794/824; 28/28 file tests pass; mock honors bannerActive (line 207) |
| `src/app/globals.css` | @layer base font-size 1rem floor on input/textarea/select | VERIFIED | New @layer base block at lines 166-172; no !important; specificity 0,0,1 |
| `src/components/comment/CommentCompose.tsx` | text-base md:text-sm on raw textarea | VERIFIED | Line 60 |
| `src/components/comment/CommentItem.tsx` | text-base md:text-sm on raw edit-comment textarea | VERIFIED | Line 170 |
| `src/components/watch/SearchEntry.tsx` | text-base md:text-sm on Combobox.Input | VERIFIED | Line 242; git diff confirms single-token swap, no composition change |
| `tests/static/no-iOS-zoom-viewport.test.ts` | New file with @vitest-environment node + D-11 viewport meta assertions | VERIFIED | Line 1 = pragma; 7/7 tests pass; cites D-11 |
| `tests/static/no-text-sm-on-native-form-controls.test.ts` | New file with @vitest-environment node + D-12 scope-limited className regex | VERIFIED | Line 1 = pragma; 2/2 tests pass; cites D-12; admin/* not walked |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `AddWatchFlow.tsx:694-695` ConfirmStep call site | `ConfirmStep.tsx:95-100` interface + line 320 Section 6 | `bannerActive={state.dupeContext != null}` prop wired to gate early-return | WIRED | grep `bannerActive=\{state\.dupeContext != null\}` returns 1 hit |
| `AddWatchFlow.test.tsx` WR-01 describe (lines 731-836) | DupeBanner mock testid (line 230) | `findByTestId('dupe-banner-{owned\|wishlist}')` presence assertions | WIRED | 4 testid-pair assertions across Tests A/B/C/D |
| `globals.css:166-172` @layer base block | iOS Safari focus-zoom heuristic (font-size < 16px) | `font-size: 1rem` on input, textarea, select | WIRED | DOM-default floor — confirmed in browser would need prod UAT |
| `CommentCompose.tsx:60` + `CommentItem.tsx:170` + `SearchEntry.tsx:242` | shadcn Input + Textarea primitive pattern | `text-base md:text-sm` responsive parity | WIRED | All 3 hits present; shadcn primitives untouched (already correct) |
| `tests/static/no-iOS-zoom-viewport.test.ts` | `src/app/layout.tsx:29` viewport export | `fs.readFileSync` + regex absence assertions on maximumScale/userScalable/minimumScale | WIRED | 7/7 tests pass against current correct viewport |
| `tests/static/no-text-sm-on-native-form-controls.test.ts` | `src/components/comment/*` + `src/components/watch/SearchEntry.tsx` | `fs.readdirSync` + regex assertion on native form-control opening tags | WIRED | 2/2 tests pass; scan covers expected files (sanity test) + violations array empty |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build is the gate | `npm run build` | exit 0 — Compiled successfully in 5.4s; 33/33 static pages | PASS |
| AddWatchFlow tests (including 4 WR-01) | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | 28/28 pass in 324ms | PASS |
| MOB-01 viewport static guard | `npx vitest run tests/static/no-iOS-zoom-viewport.test.ts` | 7/7 pass in 2ms | PASS |
| MOB-01 className regression guard | `npx vitest run tests/static/no-text-sm-on-native-form-controls.test.ts` | 2/2 pass in 32ms | PASS |
| iOS Safari runtime auto-zoom behavior | iPhone Safari tap test | SKIP — Safari-runtime only | SKIP — human_needed |
| Pinch-zoom preserved | iPhone Safari two-finger gesture | SKIP — Safari-runtime only | SKIP — human_needed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DUPE-04 | 74-01-PLAN.md | User sees a clear, non-ambiguous reason why ConfirmStep CTA is disabled when DupeBanner mounted; "hidden entirely" path chosen per D-01 | SATISFIED structurally; visual confirmation NEEDS HUMAN | ConfirmStep Section 6 wrapped in `{!bannerActive && (...)}`; 4 WR-01 tests assert absence; prod UAT confirms visual cleanliness |
| MOB-01 | 74-02-PLAN.md | User can focus an input field on iOS Safari without auto-zoom; pinch-zoom preserved; no maximum-scale=1 | SATISFIED structurally; runtime confirmation NEEDS HUMAN | globals.css @layer base floor + 3 className rewrites; viewport untouched + locked by D-11 guard; iPhone Safari verification deferred per D-09 |

No orphaned requirements — REQUIREMENTS.md maps DUPE-04 and MOB-01 to Phase 74 only, and both are claimed by the two plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | None — no TBD/FIXME/XXX/PLACEHOLDER tokens in modified files; no hardcoded empty data flowing to render; no console.log-only handlers; no font-medium introductions |

**Note on SearchEntry.tsx font-medium:** 2 grep hits at lines 45 and 283. Both are JSDoc/inline comments explicitly citing the no-font-medium guardrail by name (e.g., `* - font-semibold (NOT font-medium) on result-row primary text per ...` and `no-raw-palette guardrail (NOT font-medium).`). These are documentation references, not className introductions, and are pre-existing from earlier phases (not modified by Phase 74).

### Human Verification Required (bundled v8.1 prod UAT walk per D-15)

#### 1. MOB-01 SC#2 — iOS Safari input focus does not auto-zoom

**Test:** From an iPhone Safari on horlo.app: (a) tap a comment textarea on a watch detail page; (b) tap the add-watch search input; (c) tap a comment edit textarea (your own comment); (d) tap any other input across the app
**Expected:** Page does NOT auto-zoom on any focus event — the font-size floor (16px) + responsive text-base md:text-sm holds at runtime
**Why human:** iOS Safari's auto-zoom-on-focus heuristic is not observable in jsdom (D-13 rejected unit-test attempts because Tailwind compilation is not in the test harness). Per `feedback_mobile_ui_verify_on_prod`, this is iPhone-Safari-on-prod only.

#### 2. MOB-01 SC#3 — Pinch-zoom still works

**Test:** From iPhone Safari on any page of horlo.app, two-finger pinch-zoom
**Expected:** Page still zooms via pinch — confirms viewport export is not blocking pinch-zoom (no maximum-scale=1, no user-scalable=no)
**Why human:** Pinch-zoom is a Safari touch-runtime gesture; cannot be simulated in jsdom. The D-11 static guard locks the viewport export from regressing to a forbidden key; runtime confirmation requires Safari.

#### 3. MOB-01 SC#4 — No visual regressions in other form contexts

**Test:** Walk WatchForm (add-watch flow form-prefill branch), comment composer, comment edit, filters across mobile + desktop breakpoints
**Expected:** No visual regressions — shadcn primitives are untouched (already use text-base md:text-sm); admin tooling is untouched (out of scope per D-07); the 3 rewrites only swap the text-* token (font-weight + spacing unchanged); the @layer base rule has specificity 0,0,1 so existing utility classes still win
**Why human:** Visual fidelity across breakpoints requires browser eyes; jsdom does not compile Tailwind.

#### 4. DUPE-04 SC#1 visual — ConfirmStep screen "feels clean" under DupeBanner

**Test:** From any logged-in user on horlo.app, walk the add-watch flow: pick a catalog watch that matches an existing owned/wishlist row. DupeBanner mounts on the confirm screen.
**Expected:** Primary CTA ("Add to Wishlist" / "Add to Collection" / "Save as Grail") is NOT visible under the banner. Ghost row ("Edit details" / "Start over") remains clickable. Inputs (reference, year, price) remain editable. Clicking "Add another copy" makes the primary CTA reappear and become functional (and clicking it then fires addWatch).
**Why human:** jsdom assertions guarantee structural absence (the `<Button>` is not in the DOM); whether the screen visually feels clean under the banner is a runtime call per CONTEXT D-15 + `feedback_mobile_ui_verify_on_prod`.

### Gaps Summary

No structural gaps. All 18 observable truths verified in code; 9 modified/created artifacts present and wired; 2 requirements (DUPE-04, MOB-01) closed structurally with prod UAT awaiting bundled v8.1 deploy.

Phase 74 is the LAST phase of the v8.1 milestone. Per `feedback_mobile_ui_verify_on_prod` + D-15, all 4 human-verification items above will be bundled into a single Vercel deploy and a single UAT walk covering 6 items in total: (1) SRCH-01 multi-token match, (2) SRCH-02 keyboard nav, (3) SRCH-03 footer click, (4) ROUTE-01 owned redirect, (5) DUPE-04 CTA hidden, (6) MOB-01 iOS auto-zoom + pinch-zoom.

Per `feedback_ppr_cache_fill_no_longer_call_out`, PPR / React #419 / cache-fill / soft-nav regression checks are explicitly OUT of scope for this phase's UAT.

---

*Verified: 2026-05-30T20:55:00Z*
*Verifier: Claude (gsd-verifier)*
