---
status: complete
phase: 29-nav-profile-chrome-cleanup
source:
  - 29-01-SUMMARY.md
  - 29-02-SUMMARY.md
  - 29-03-SUMMARY.md
  - 29-04-SUMMARY.md
  - 29-05-SUMMARY.md
  - 29-06-SUMMARY.md
  - quick/2026-05-05-form04-gap3-url-extract-cache/SUMMARY.md
started: 2026-05-05T07:45:00Z
updated: 2026-05-05T12:35:00Z
re_verification:
  reason: |
    Gap closure plans shipped: 29-05 (verdict cache module-scope), 29-06 (StrictMode-safe cleanup),
    AND post-UAT Quick Task FORM-04 Gap 3 (useUrlExtractCache). Re-test Test 8 (extract NOT re-fired
    on remount — the original user-observable bottleneck) + Test 10 (deep-link prefill survives StrictMode).

    First re-test of Test 8 (after only 29-05) FAILED — diagnosis showed the verdict cache survived
    remount but /api/extract-watch was uncached upstream. Quick Task added useUrlExtractCache to
    skip the fetch entirely on URL re-paste. NOW re-testing.
---

## Current Test

[testing complete — all 10 tests pass post-29-05/29-06/Quick Gap 3]

## Tests

### 1. Cold Start Smoke Test
expected: |
  Kill any running dev server. Run `npm run dev`. Server boots without errors,
  the homepage loads, and `/watch/new` returns 200 (not 500). Phase 29 touched
  `src/app/watch/new/page.tsx` (Server Component), so a fresh start exercises
  the new `crypto.randomUUID()` code path.
result: pass

### 2. NAV-16 — UserMenu dropdown order
expected: |
  Click the chevron next to your avatar in the top-right. Dropdown shows
  (top to bottom): email label → Settings → Theme segmented control → Sign out.
  No "Profile" row anywhere. Avatar itself (not the chevron) still navigates
  to `/u/{username}/collection` when clicked.
result: pass

### 3. PROF-10 — Profile tab strip horizontal scroll only
expected: |
  Visit `/u/{your-username}`. The profile tab strip (Collection / Wishlist /
  Insights / Common Ground / Activity / etc.) overflows horizontally on a
  narrow window. NO vertical scrollbar appears on the tab strip itself.
  The active-tab underline is fully visible (not clipped at the bottom).
result: pass

### 4. PROF-10 — Vertical scroll gesture passthrough
expected: |
  On `/u/{your-username}`, hover or touch the profile tab strip and do a
  vertical scroll gesture (two-finger trackpad swipe up/down, OR touch swipe
  on mobile). The PAGE scrolls; the tab strip does NOT consume the gesture.
  Horizontal swipes on the tab strip still scroll the tabs.
result: pass

### 5. FORM-04 Layer 1 — CTA re-entry reset
expected: |
  Visit `/watch/new`. Paste any URL into the paste-input field. Click any
  "Add Watch" CTA elsewhere in the app (top-nav, search row 3-CTA, etc.) —
  this re-enters `/watch/new`. The paste-input field is EMPTY (not still
  showing your prior paste). Rail is empty. State is idle.
result: pass

### 6. FORM-04 Layer 2 — Back-nav from collection
expected: |
  Visit `/watch/new`. Paste a URL → wait for verdict ready. Manually navigate
  to `/u/{your-username}/collection` (or any other route). Click browser BACK
  to return to `/watch/new`. The paste-input field is EMPTY, FlowState is
  idle (no verdict-ready panel showing the prior URL's data).
result: pass

### 7. FORM-04 Layer 3 — Post-commit reset
expected: |
  Complete a full Add-Watch flow (paste URL → verdict → "Add to Collection"
  or "Add to Wishlist" → confirm). After the redirect to your collection/wishlist,
  click any "Add Watch" CTA. The form is empty (no stale paste URL, no
  stale rail entries from the just-committed flow).
result: pass

### 8. FORM-04 — Verdict cache survives remount (Option B regression check)
expected: |
  On `/watch/new`, paste a URL → verdict appears (e.g., "Core Fit" or "Role
  Duplicate"). Navigate away (browser back, or click any link). Re-enter
  `/watch/new` and paste the SAME URL again. The verdict should appear
  near-instantly (cache hit on catalogId), NOT trigger a fresh LLM extraction
  + similarity re-run. The verdict bundle is keyed on (catalogId, collectionRevision)
  and intentionally cross-session — Phase 29 should NOT have broken this.
result: pass
reported: "pass! (re-tested 2026-05-05 after Quick Task FORM-04 Gap 3 — useUrlExtractCache module-scoped hook now skips /api/extract-watch on URL re-paste; DevTools Network filter stays empty on second paste, verdict appears instantly)"
prior_failures:
  - "first run (after 29-04 only): /api/extract-watch fires and takes normal time → root cause: verdict cache reset on remount (Option B)"
  - "second run (after 29-05 only): /api/extract-watch still fires → root cause: 29-05 only fixed verdict cache, not the upstream extract step (cache keyed on catalogId, only known after extract returns)"
fix_chain:
  - "29-05 — useWatchSearchVerdictCache → module-scoped (verdict layer survives remount)"
  - "Quick FORM-04 Gap 3 — useUrlExtractCache → module-scoped (extract layer survives remount; closes user-observable bottleneck)"

### 9. FORM-04 — Within-flow Skip still loops back to idle inside same mount
expected: |
  On `/watch/new`, paste a URL → verdict ready → click "Skip". The view
  returns to the paste-input idle state, paste-input has focus (auto-focus
  useEffect fires), the rail keeps the just-skipped entry as a "recently
  evaluated" tile. This is a within-flow loop — NOT a re-entry — so the
  cleanup-on-remount does NOT fire. (Within-flow Skip behavior unchanged
  per CONTEXT D-17.)
result: pass

### 10. Deep-link prefill from /search "Add to Collection" CTA
expected: |
  On `/search`, click the "Add to Collection" 3-CTA on a search result row.
  Should navigate to `/watch/new?catalogId={uuid}&intent=owned` (or similar
  deep-link params per Phase 20.1) AND short-circuit the paste-flow to a
  prefilled `manual-entry` / `form-prefill` state — brand, model, reference,
  etc. populated from the catalog watch. Per CONTEXT D-16: "Deep-link entry
  from `/search` row 3-CTA or `/catalog/[id]` 3-CTA (with `?catalogId=X&intent=owned`)
  still short-circuits to form-prefill."
result: pass
reported: "pass (re-tested 2026-05-05 after Plan 29-06 — StrictMode-safe useLayoutEffect cleanup with state.kind==='form-prefill' skip case + global vitest StrictMode wrapper)"
fix_chain:
  - "29-06 — useLayoutEffect cleanup guards: skip when state.kind === 'form-prefill' (initialState-derived deep-link prefill survives StrictMode spurious mount/cleanup/mount cycle)"
  - "29-06 — global vitest StrictMode wrapper in tests/setup.tsx so this regression class is caught in CI"

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

re_verification_history:
  - first_run (Plans 01-04): 8 passed, 2 issues (Test 8 verdict-cache reset on remount, Test 10 deep-link prefill clobbered by StrictMode)
  - second_run (after Plans 05 + 06): Test 10 passed; Test 8 still failing — diagnosis revealed 29-05 fixed verdict cache but /api/extract-watch was uncached upstream
  - third_run (after Quick Task FORM-04 Gap 3): Test 8 passed (DevTools Network filter empty on second paste); Test 10 confirmed passing

## Gaps (CLOSED)

- truth: "Deep-link entry from /search '/Add to Collection' CTA short-circuits AddWatchFlow to a prefilled form-prefill / manual-entry state with brand, model, reference populated from the catalog watch (CONTEXT D-16)"
  status: failed
  reason: "User reported: clicking the 'add to collection' from a watch on /search, it navigates to /watch/new but the form is completely empty - should be prefilled with the data from the watch"
  severity: major
  test: 10
  classification: phase-29-regression
  root_cause: "The useLayoutEffect cleanup added in Plan 29-04 commit d51dad3 (lines 137-143 of AddWatchFlow.tsx) calls setState({kind:'idle'}), setUrl(''), setRail([]) on cleanup. Under React StrictMode (Next.js 16 dev default), the mount → cleanup → mount cycle runs on initial render — the cleanup fires AFTER initialState derives the form-prefill state from URL params, clobbering the prefill before the user ever sees it. /search and /catalog/[id] CTA wiring is correct (WatchSearchRowsAccordion.tsx:124-127, CatalogPageActions.tsx:128-130 both emit `/watch/new?intent=...&catalogId=...&returnTo=...`). The page Server Component (page.tsx) reads catalogId from searchParams and passes it correctly. The bug is purely in AddWatchFlow.tsx's StrictMode-unsafe cleanup."
  artifacts:
    - src/components/watch/AddWatchFlow.tsx (lines 137-143 — the StrictMode-unsafe cleanup)
  missing:
    - vitest StrictMode wrapper (vitest.config.ts / tests/setup.ts) — gap that let this regression through CI
  fix_strategy: "Rework Layer 2 back-nav defense to be StrictMode-safe AND not clobber initial-mount prefill. Options: (a) skip cleanup if it's the first cleanup call via a mounted-ref pattern; (b) drop the useLayoutEffect cleanup entirely and rely solely on Layer 1 (key prop) — verify back-nav case works under Activity-preservation in production build; (c) replace useLayoutEffect with a different mechanism (e.g., key bust on pathname change). Planner picks. Must also add StrictMode wrapper to test setup so the regression test for /search prefill catches future strict-mode bugs."
  resolution: "Closed by Plan 29-06 (commits 7b5c98f, 3e7d20a, 881d6fb, dd2e147). Picked Option (a)+ — ref-guarded cleanup with two skip cases: (1) initial idle (state.kind==='idle' && url==='' && rail.length===0) covers StrictMode mount/cleanup/mount on initial render; (2) state.kind==='form-prefill' covers initialState-derived deep-link prefill. Real Activity-hide back-nav reset (UAT Test 6) preserved. Test infra: tests/setup.ts → tests/setup.tsx (git mv) + global vi.mock('@testing-library/react', ...) wraps every render() in <StrictMode> so this regression class is caught in CI. Re-test 2026-05-05: PASS."

- truth: "useWatchSearchVerdictCache survives AddWatchFlow remount; pasting the same URL on re-entry returns a cached verdict bundle near-instantly without firing /api/extract-watch (CONTEXT D-15: 'The contract is cache survives entry')"
  status: failed
  reason: "User reported: fail - clicking extract on the same url that i just extracted is not instant. i confirmed that http://localhost:3000/api/extract-watch fires and takes some time to resolve"
  severity: major
  test: 8
  classification: phase-29-regression
  root_cause: "Plan 29-04 picked Option B (let cache reset per remount) on D-15 'Claude's Discretion' — but the cache hook useWatchSearchVerdictCache is useState-based and lives INSIDE AddWatchFlow.tsx:114, below the `<AddWatchFlow key={flowKey}>` boundary in page.tsx:110. The crypto.randomUUID() nonce regenerates per request, every navigation back to /watch/new remounts AddWatchFlow, useState lazy-initializer runs again with new Map(), prior verdict bundles are gone. Option B literally cannot honor D-15's 'cache survives entry' contract — only Option A (hoist above the key boundary) can. Plan 29-04's Phase 20 D-06 'regression check' gave a false PASS because those tests only validate same-mount cache hits + collectionRevision invalidation — never the remount survival case D-15 actually requires."
  artifacts:
    - src/components/search/useWatchSearchVerdictCache.ts (the useState-based cache hook)
    - src/components/watch/AddWatchFlow.tsx:114 (where the hook is called — INSIDE the key boundary)
    - src/app/watch/new/page.tsx:110 (the `<AddWatchFlow key={flowKey}>` boundary)
  missing:
    - regression test in tests/components/watch/AddWatchFlow.test.tsx — rerender with new `key` prop, paste same URL, assert /api/extract-watch was NOT called twice
  fix_strategy: "Migrate useWatchSearchVerdictCache.ts from useState-backed Map to module-scoped Map<string, VerdictBundle> with a module-scoped revision counter. On revision change in render, clear the module Map. Hook public API ({revision, get, set}) stays identical. AddWatchFlow + WatchForm + tests untouched. Single-file change; smallest blast radius compared to a Client wrapper hoist."
  resolution: "Closed across two ships:\n  - Plan 29-05 (commits e3f691d, 61f0820, a11061f) implemented the module-scope migration as planned. Verdict cache survives remount.\n  - Re-test revealed the contract was over-broad: verdict cache only short-circuits the verdict server action, not the upstream /api/extract-watch fetch. User still saw the network call.\n  - Quick Task FORM-04 Gap 3 (commits 03667a5, 8de2382, 726f2ed, 0815c96) added useUrlExtractCache — a sibling module-scoped Map<url, ExtractCacheEntry> consulted before the fetch. Re-test 2026-05-05: PASS (DevTools Network filter empty on second paste of same URL across remount)."
