---
phase: 29-nav-profile-chrome-cleanup
plan: 04
subsystem: ui
tags:
  - nextjs16
  - cache-components
  - activity
  - react-key
  - useLayoutEffect
  - form-04
  - state-hygiene

requires:
  - phase: 29-nav-profile-chrome-cleanup
    plan: 01
    provides: "AddWatchFlow.test.tsx + WatchForm.test.tsx FORM-04 reset describe block — verification surface this plan turns from scaffold to production-meaningful regression gate"
  - phase: 28-add-watch-flow-verdict-copy-polish
    provides: "handleWishlistConfirm router.push(returnTo ?? default) post-commit nav pattern (D-15 router.refresh removal); the FORM-04 reset-on-commit now layers ON TOP of this nav pattern"
  - phase: 20-collection-fit-and-verdict-copy
    provides: "useWatchSearchVerdictCache(collectionRevision) D-06 contract — preserved under Option B hoisting strategy (cache resets per remount; collectionRevision-keyed re-fetch repopulates fast)"
  - phase: 20.1-add-watch-flow-rethink
    provides: "AddWatchFlow 9-state machine + initialState derivation from props (D-12, D-16) — preserved verbatim; key prop forces derivation to actually run on every entry"

provides:
  - "src/app/watch/new/page.tsx — per-request crypto.randomUUID() nonce as <AddWatchFlow key={flowKey}> (Layer 1)"
  - "src/components/watch/AddWatchFlow.tsx — useLayoutEffect cleanup-on-hide reset (Layer 2 — back-nav defense for Activity-preservation)"
  - "src/components/watch/AddWatchFlow.tsx — handleWishlistConfirm success branch resets state BEFORE router.push (Layer 3 — eliminates post-commit stale-state paint frame)"
  - "Plan 01 RED→GREEN gate: AddWatchFlow.test.tsx Test 1 (key-change remount) + Test 2 (useLayoutEffect cleanup-on-hide sanity) both green at production-runtime"

affects:
  - 30-wywt-capture-alignment-fix
  - 31-v4-verification-backfill

tech-stack:
  added: []
  patterns:
    - "Three-layer state-reset defense for Next.js 16 cacheComponents+Activity-preserved routes: per-request server nonce as React key (forward navs/refreshes) + useLayoutEffect cleanup-on-hide (back-nav within 3-route Activity window) + commit-time explicit reset BEFORE router.push (eliminates stale-state paint frame)"
    - "Server-Component nonce generation via crypto.randomUUID() in already-dynamic page (await searchParams) — no connection() ceremony required (RESEARCH Pattern 3, Pitfall 2 inline-comment guard)"
    - "useLayoutEffect cleanup as canonical Next.js 16 Activity-hide reset hook (NOT useEffect — async cleanup produces flash-of-stale-state per Anti-Patterns)"

key-files:
  created: []
  modified:
    - "src/app/watch/new/page.tsx — added crypto.randomUUID() nonce + key prop on AddWatchFlow + Pitfall 2 inline guard"
    - "src/components/watch/AddWatchFlow.tsx — extended React import to include useLayoutEffect; added useLayoutEffect cleanup hook after existing focus useEffect; replaced trailing 'intentionally NOT called' comment with setUrl/setRail/setState reset BEFORE router.push in handleWishlistConfirm success branch"

key-decisions:
  - "Three-layer defense (per CONTEXT D-12/D-13/D-14) shipped exactly as specified: Layer 1 (server nonce → key) covers forward navs and refreshes; Layer 2 (useLayoutEffect cleanup) covers back-nav from Activity-preserved routes (Pitfall 4 — Server Component does NOT re-run on back-nav); Layer 3 (commit-time reset) covers the 1-frame post-commit stale-state paint window."
  - "Hoisting strategy = Option B (accept verdict cache reset per AddWatchFlow remount). Phase 20 D-06 cache regression tests (4/4) green. Rationale: minimal blast radius, cache repopulates fast via collectionRevision-keyed re-fetch, no new wrapper component or context-plumbing complexity. Option A (Client wrapper hoisting) deferred to v5.0+ if UAT shows the reset is observable."
  - "useLayoutEffect cleanup resets to LITERAL { kind: 'idle' } (not prop-derived initialState) per RESEARCH Pattern 4 'Note on initialState derived from props' — when the user navigates back from another route, deep-link query params are typically not carried over; idle is the correct end state. Validate in UAT."
  - "Pitfall 2 inline guard ('// DO NOT add use cache to this file...') retained verbatim near crypto.randomUUID() — prevents future maintainer from silently freezing the nonce at build time."
  - "Pitfall 8 honored: key={flowKey} appears at JSX level on the AddWatchFlow JSX, NEVER inside a spread."

patterns-established:
  - "Three-layer defense for state hygiene under Next.js 16 cacheComponents — when a route under Activity-preservation needs to discard preserved client state on every entry, combine: (1) per-request crypto.randomUUID() Server-Component nonce as React key (forward navs/refreshes), (2) useLayoutEffect cleanup with empty-array deps that resets on Activity-hide / unmount (back-nav), (3) explicit reset before router.push on commit success (post-commit paint frame). Each layer covers a case the other two cannot."
  - "Server-Component nonce generation is safe in already-dynamic pages — /watch/new awaits searchParams (Request-time API → page is already excluded from prerendering); crypto.randomUUID() runs at request time without connection() ceremony. Inline source comment forbids future 'use cache' addition (RESEARCH Pitfall 2)."

requirements-completed: [FORM-04]

# Metrics
duration: ~3 min
completed: 2026-05-05
---

# Phase 29 Plan 04: FORM-04 Implementation Summary

**Three-layer state-reset defense for /watch/new under Next.js 16 cacheComponents+Activity preservation — per-request UUID nonce as AddWatchFlow key (forward navs/refreshes) + useLayoutEffect cleanup-on-hide (back-nav within 3-route Activity window) + commit-time reset BEFORE router.push (eliminates post-commit stale-state paint frame).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T07:35:11Z
- **Completed:** 2026-05-05T07:38:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Layer 1 — per-request nonce as React key (D-12, D-13):** `src/app/watch/new/page.tsx` Server Component now generates `const flowKey = crypto.randomUUID()` after the existing auth + searchParams + DB-fetch work and threads it as `<AddWatchFlow key={flowKey} ... />` (key on its own line, FIRST prop, NOT inside a spread per Pitfall 8). Inline comment block forbids future `'use cache'` addition (Pitfall 2 guard).
- **Layer 2 — useLayoutEffect cleanup (D-14, RESEARCH Pattern 4):** `src/components/watch/AddWatchFlow.tsx` now imports `useLayoutEffect` (in canonical alphabetical order: `useCallback, useEffect, useLayoutEffect, useState, useTransition`) and registers a single empty-deps `useLayoutEffect(() => () => { setState({ kind: 'idle' }); setUrl(''); setRail([]) }, [])` immediately after the existing focus useEffect. The cleanup runs synchronously on Activity-hide / unmount, covering the back-nav case where the Server Component does NOT re-execute (Pitfall 4) — when the user navigates back to `/watch/new` within the 3-route Activity window, the un-hidden tree is already at idle.
- **Layer 3 — commit-time reset (D-14 defense-in-depth):** `handleWishlistConfirm` success branch now calls `setUrl(''); setRail([]); setState({ kind: 'idle' })` BEFORE `router.push(dest)`. The contradicted Phase 28 trailing comment (`// setUrl + setState({kind:'idle'}) intentionally NOT called — mid-nav unmount handles cleanup.`) was removed; replaced by a Phase 29 D-14 comment block explaining the reset eliminates the stale-state paint frame between commit-success and route change.
- **Plan 01 verification surface confirmed GREEN at production-runtime:** Both AddWatchFlow.test.tsx tests (key-change remount, useLayoutEffect cleanup sanity) and the appended WatchForm.test.tsx FORM-04 reset describe block pass — total 13/13 across the two files.
- **Phase 20 D-06 verdict-cache regression check passed:** Option B hoisting strategy (accept the cache reset per remount) is validated — `tests/components/search/useWatchSearchVerdictCache.test.tsx` 4/4 green; the cache is keyed on `collectionRevision` and intentionally repopulates fast via Phase 20 D-06's invalidation contract.
- **Full Phase 29 unit-test sweep green:** UserMenu (12) + ProfileTabs (8) + AddWatchFlow (2) + WatchForm (11) + useWatchSearchVerdictCache (4) — 37/37 tests pass across 5 files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-request nonce + key prop in src/app/watch/new/page.tsx** — `6b4546b` (feat)
2. **Task 2: Add useLayoutEffect cleanup + handleWishlistConfirm reset to AddWatchFlow.tsx** — `d51dad3` (feat)

## Files Created/Modified

- `src/app/watch/new/page.tsx` (+8 lines net) — Inserted the FORM-04 nonce comment block + `const flowKey = crypto.randomUUID()` after `viewerUsername` derivation (line 95) and BEFORE the `return (` (now line 104). Added `key={flowKey}` as the first prop on `<AddWatchFlow>` (line 110) on its own line, anchoring the React-tree-boundary semantic. ALL other code (imports, NewWatchPageProps interface, auth gate, searchParams whitelist, DB fetches via Promise.all, hydrateCatalogPrefill helper) UNCHANGED.
- `src/components/watch/AddWatchFlow.tsx` (+27 lines / -2 lines net) — Three surgical edits: (1) extended React import on line 3 to include `useLayoutEffect` in canonical alphabetical position (between `useEffect` and `useState`); (2) inserted the new `useLayoutEffect(() => () => { ... }, [])` cleanup block immediately after the existing focus useEffect at lines 122-127 (which is preserved verbatim per D-17 — within-flow Skip behavior unchanged); (3) inside `handleWishlistConfirm` success branch, replaced the trailing Phase 28 contradicted comment with the explicit `setUrl('') / setRail([]) / setState({ kind: 'idle' }) / router.push(dest)` reset sequence preceded by a Phase 29 D-14 explanatory comment block. ALL handlers (handleExtract, handleWishlist, handleCollection, handleSkip, handleWishlistCancel, handleManualEntry, handleStartOver, retryAction, manualAction, handleRailSelect) UNCHANGED. ALL render branches UNCHANGED. The `useWatchSearchVerdictCache(collectionRevision)` call at the unchanged location was deliberately NOT hoisted (Option B per CONTEXT D-15 + RESEARCH Pitfall 3 — the cache resets per remount and repopulates fast; Phase 20 D-06 tests pass).

## Decisions Made

- **Plan executed exactly as written.** All three layers landed verbatim per the plan's `<interfaces>` block: literal `crypto.randomUUID()` invocation, literal `useLayoutEffect` cleanup body resetting to `{ kind: 'idle' }` / `''` / `[]`, literal commit-time reset ordering (setUrl → setRail → setState → router.push). Pitfall 8 honored throughout. Pitfall 2 inline guard present verbatim.
- **Hoisting strategy = Option B (accept the verdict cache reset).** Per the plan's locked decision in Task 2's `<action>` block: cache repopulates fast via `collectionRevision`-keyed re-fetch (Phase 20 D-06 contract), Plan 01/04 do NOT modify Phase 20 D-06 invalidation tests so any regression surfaces immediately, and Option A (Client wrapper) introduces new component file + prop-plumbing complexity for a UX delta (~100ms on first re-paste post-remount) that is functionally invisible. Phase 20 D-06 tests pass post-Plan-04.
- **No `useWatchSearchVerdictCache` hoisting.** D-15 / Pitfall 3 explicitly defers Option A (Client wrapper) to a v5.0+ refactor candidate IF UAT shows the cache reset is observable. Current evidence: 4/4 useWatchSearchVerdictCache.test.tsx assertions still pass after the AddWatchFlow remount semantic change — the cache hook's `collectionRevision`-keyed reset semantic is unchanged.
- **No modification to `src/components/search/useWatchSearchVerdictCache.ts`** — locked READ-ONLY per UI-SPEC + Pitfall 3 / D-15 Option B path.
- **No modification to `src/components/watch/WatchForm.tsx`** — re-mounts implicitly via parent key change (PATTERNS.md §3 confirmed; Plan 01 WatchForm reset-on-key-change test passes without any direct WatchForm edit).
- **No modification to `src/components/ui/tabs.tsx`** — different feature (Pitfall 7 / D-09 — out of FORM-04 scope).
- **Existing `useEffect(() => { if (state.kind === 'idle') ... focus paste-url }, [state.kind])` at lines 122-127 preserved verbatim per D-17** (within-flow Skip / Cancel / WishlistRationalePanel-Cancel paths UNCHANGED — they continue to loop back to idle inside the same mount via the existing focus useEffect).
- **searchParams whitelist at `watch/new/page.tsx:53-77` UNCHANGED per D-16** — the `key` prop forces the AddWatchFlow `initialState` derivation (lines 103-108) to actually run fresh on every entry; the URL params still drive initial state when present.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None directly caused by this plan. The pre-existing `tests/app/watch-new-page.test.ts` integration test (4 tests) requires a live local Postgres on `127.0.0.1:5432` and fails with `ECONNREFUSED` when Supabase Docker is not running. This was confirmed pre-existing via `git stash && npm run test ...` (failures present BEFORE Plan 04 edits land). Per the executor's scope-boundary rule, this is out of scope; manual UAT will exercise the page-level integration through real browser navigation. The non-DB integration test (`tests/integration/add-watch-flow-search-cta.test.tsx`, 3 tests) is GREEN with the new key prop + useLayoutEffect cleanup wiring.

The pre-existing `npx tsc --noEmit` errors in unrelated test files (RecentlyEvaluatedRail.test.tsx, DesktopTopNav.test.tsx, PreferencesClient.debt01.test.tsx, useSearchState.test.tsx, PreferencesClientEmbedded.test.tsx, WatchForm.isChronometer.test.tsx, WatchForm.notesPublic.test.tsx, phase17-extract-route-wiring.test.ts) are also pre-existing and out of scope (Plan 01 SUMMARY documented these as such on 2026-05-05). Neither file modified by Plan 04 introduces any new typecheck errors — verified via `npx tsc --noEmit | grep -E "(watch/new/page|AddWatchFlow.tsx)"` which returns no output.

## User Setup Required

None - no external service configuration required.

## Manual UAT Items (deferred per plan output spec to phase-end UAT)

These are listed as deferred per the plan's `<output>` section:

1. **Forward-nav reset:** Navigate `/watch/new` → paste URL → verdict ready → `router.push('/u/{username}/collection')` → click "Add Watch" CTA → assert paste URL is empty + state.kind is idle.
2. **Back-nav reset (Activity-preservation):** Navigate `/watch/new` → paste URL → browser-back from `/u/.../collection` → `/watch/new` → assert paste URL is empty AND state.kind === 'idle' (Pitfall 4 case — useLayoutEffect cleanup carries this).
3. **WatchForm field reset:** Navigate `/watch/new` → fill brand/model in WatchForm (manual-entry or form-prefill branch) → navigate elsewhere → click "Add Watch" CTA → assert WatchForm fields are empty (parent key change forces re-mount; PATTERNS.md §3 contract).
4. **Verdict cache survival (Option B accepted):** Navigate `/watch/new` → paste URL of catalog A → verdict shown → navigate elsewhere → click "Add Watch" CTA → paste URL of catalog A again → verdict appears (Phase 20 D-06 contract still holds; Option B hoisting accepts a one-time re-fetch on first re-paste post-remount).

## Next Phase Readiness

- **Phase 29 nearing close.** Plans 01 (test scaffold), 02 (NAV-16), 03 (PROF-10), 04 (FORM-04) all complete. Phase 29 success criteria 3/3 met at unit-test level; manual UAT is the remaining gate.
- **No blockers.** The verification surface for FORM-04 is locked: AddWatchFlow.test.tsx (Test 1 + Test 2) + WatchForm.test.tsx FORM-04 reset describe block + Phase 20 D-06 useWatchSearchVerdictCache.test.tsx all green.
- **Plan 30 (WYWT-22 capture alignment fix)** is independent of FORM-04 and unblocked.

## Self-Check

**Files claimed as created/modified — verification:**

- ✅ `src/app/watch/new/page.tsx` — FOUND (modified, +8 lines net).
- ✅ `src/components/watch/AddWatchFlow.tsx` — FOUND (modified, +27/-2 lines net).

**Commits claimed — verification:**

- ✅ `6b4546b` — FOUND in `git log`.
- ✅ `d51dad3` — FOUND in `git log`.

**Acceptance criteria — verification:**

- ✅ Task 1 grep checks: `const flowKey = crypto.randomUUID()` (1), `DO NOT add 'use cache'` (1), `key={flowKey}` (1), `key={flowKey}` immediately precedes `collectionRevision={collection.length}` (1).
- ✅ Task 2 grep checks: `useLayoutEffect` (3 ≥ 2 — 1 import + 1 hook call + 1 in comment block), exact import line `import { useCallback, useEffect, useLayoutEffect, useState, useTransition } from 'react'` (1), `Activity-hide reset (back-button defense)` (1), `Phase 29 FORM-04 D-14 — defense-in-depth state reset BEFORE router.push` (1), `intentionally NOT called — mid-nav unmount handles cleanup` (0), `setState({ kind: 'idle' })` immediately before `router.push(dest)` (1), `useLayoutEffect(() => {` (1), D-17 preserved `if (state.kind === 'idle')` (1).
- ✅ Test runs: `npm run test -- tests/components/layout/UserMenu.test.tsx tests/components/profile/ProfileTabs.test.tsx tests/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.test.tsx tests/components/search/useWatchSearchVerdictCache.test.tsx` exits 0 with 37/37 tests passing.
- ✅ AddWatchFlow integration test: `tests/integration/add-watch-flow-search-cta.test.tsx` 3/3 GREEN.
- ✅ No NEW typecheck errors introduced in either modified file (filtered grep on `tsc --noEmit` output returns empty).

## Self-Check: PASSED

---
*Phase: 29-nav-profile-chrome-cleanup*
*Completed: 2026-05-05*
