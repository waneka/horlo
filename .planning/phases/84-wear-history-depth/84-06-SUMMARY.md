---
phase: 84-wear-history-depth
plan: 06
subsystem: profile
tags: [react, server-components, privacy, wear-leaderboard, worn-tab]

# Dependency graph
requires:
  - phase: 84-wear-history-depth (Plan 03)
    provides: scopeWornTabWatches (D-14 viewer-privacy scoping helper)
  - phase: 84-wear-history-depth (Plan 05)
    provides: WearLeaderboard component
provides:
  - "WearLeaderboard mounted above the Timeline/Calendar toggle row in every WornTabContent render branch"
  - "Worn-tab watch lists (watchMap + ownedWatches) scoped by viewer privacy in [tab]/page.tsx, closing T-84-LEAK"
affects: [84-07 (local-dev walk + prod push)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaderboard always receives the unfiltered events array — the watch-filter Select never affects it (D-08)"
    - "Page-level privacy scoping mirrors the Collection tab's settings.collectionPublic gate rather than adding a new tab-level lock"

key-files:
  created: []
  modified:
    - src/components/profile/WornTabContent.tsx
    - src/app/u/[username]/[tab]/page.tsx

key-decisions:
  - "WearLeaderboard renders as the first child inside a new outer gap-6 wrapper in all three WornTabContent branches (populated, owner-empty, non-owner-empty); the existing header row + Timeline/Calendar were re-wrapped in an inner gap-4 div so their internal spacing is byte-identical to before."
  - "scopeWornTabWatches is called once, immediately after signCoverUrls, and its mapWatches/ownedWatches outputs replace the previously unscoped watches array for both watchMap construction and the ownedWatches prop — no second DB call, no new await."

requirements-completed: [WEAR-03, WEAR-04]

# Metrics
duration: ~20min
completed: 2026-09-13
---

# Phase 84 Plan 06: Leaderboard Wiring + Worn-Tab Privacy Scoping Summary

**Mounted the tested `WearLeaderboard` component above the Worn tab's Timeline/Calendar toggle in all three render states, then closed a privacy gap by routing the Worn tab's watch lists through `scopeWornTabWatches` so a non-owner viewer of a private collection can no longer discover owned watches via zero-wear leaderboard rows, the filter dropdown, or `watchMap`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2

## Accomplishments

- `WearLeaderboard` now renders as the first child in `WornTabContent`'s populated state, the owner zero-wear empty state, and the non-owner zero-wear empty state — always visible per D-08, never collapsible, not a third view.
- The leaderboard is fed the unfiltered `events` prop in every branch, so the watch-filter `Select` (which only affects Timeline/Calendar) never changes leaderboard ranking or counts.
- `src/app/u/[username]/[tab]/page.tsx`'s worn branch now calls `scopeWornTabWatches({ isOwner, collectionPublic: settings.collectionPublic, watches, eventWatchIds })` right after `signCoverUrls`, closing T-84-LEAK: a non-owner viewer of a `collectionPublic=false` profile now only receives watches referenced by their own visible wears in both `watchMap` and `ownedWatches` — previously they received the full owned list unconditionally.
- No new `await`, no change to the Suspense/`connection()` structure, `unstable_instant` stays `false` — verified by the unchanged `tests/static/ppr-dynamic-before-use-cache.test.ts` and a `git diff` grep for added `await` lines.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount WearLeaderboard above the view toggle in WornTabContent** - `4cd0aa10` (feat)
2. **Task 2: Scope Worn-tab watch lists by viewer in page.tsx (D-14 / T-84-LEAK)** - `04209a75` (fix)

## Files Created/Modified

- `src/components/profile/WornTabContent.tsx` - Added `WearLeaderboard` import; all three render branches wrap their existing content in a `gap-6` outer div with `<WearLeaderboard events={events} watches={ownedWatches} />` as the first child; the populated branch's original header-row + Timeline/Calendar content is re-wrapped in an inner `gap-4` div to preserve its prior internal spacing.
- `src/app/u/[username]/[tab]/page.tsx` - Added `scopeWornTabWatches` import; worn branch now derives `scopedOwnedWatches`/`mapWatches` from it; `watchMap` builds from `mapWatches` instead of the raw `watches` array; `WornTabContent`'s `ownedWatches` prop uses `scopedOwnedWatches` instead of an unscoped `.filter((w) => w.status === 'owned')`.

## Decisions Made

See `key-decisions` above. No decisions beyond what the plan's `<interfaces>`/`<action>` sections already specified — both tasks matched the plan's literal spec on the first pass.

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps matched on the first attempt for both tasks.

## Issues Encountered

None.

## Verification

- `npx vitest run tests/components/profile/WearLeaderboard.test.tsx tests/components/profile/LogTodaysWearButton.test.tsx` — 22/22 pass.
- `npx vitest run tests/unit/wornTabScope.test.ts tests/static/ppr-dynamic-before-use-cache.test.ts` — 9/9 pass.
- `npx vitest run tests/unit/wornTabScope.test.ts tests/unit/leaderboard.test.ts tests/components/profile/WearLeaderboard.test.tsx tests/components/profile/LogTodaysWearButton.test.tsx tests/static/ppr-dynamic-before-use-cache.test.ts` (plan's full `<verification>` list) — 53/53 pass.
- `npm run build` — exits 0 (run twice, once per task).
- All acceptance-criteria greps for both tasks matched on the first pass (see plan `84-06-PLAN.md` for the literal grep list — `<WearLeaderboard events={events} watches={ownedWatches} />` = 3, `<WearLeaderboard events={filtered}` = 0, leaderboard-before-ViewTogglePill ordering check exits 0, import count = 1, `font-medium|font-bold` = 0; `scopeWornTabWatches` import = 1, call = 1, `collectionPublic: settings.collectionPublic` = 2, `ownedWatches={scopedOwnedWatches}` = 1, `mapWatches.map(` = 1, `unstable_instant = false` = 1, added-await diff count = 0).
- `git diff "src/app/u/[username]/[tab]/page.tsx" | grep -c "^+.*await "` — 0 (no new awaits).
- Full `npm run test` run (all files) separately: 16 test files / 53 tests failed, beyond the plan's documented pre-existing baseline (`tests/components/WywtPostDialog.test.tsx`, `tests/components/profile/WornCalendar.test.tsx` month-drift, 5 in `tests/no-raw-palette.test.ts`). Confirmed every additional failing file (`moveWishlistToCollection.test.ts`, `addwatch-catalog-resilience.test.ts`, `watches.notesPublic.test.ts`, `watches.test.ts`, `extract-watch.test.ts`, `watch-new-page.test.ts`, `CollectorsLikeYou.test.tsx`, `WatchPickerDialog.test.tsx`, `watch-photo-section.test.tsx`, `AddWatchFlow.cacheRemount.test.tsx`, `AddWatchFlow.test.tsx`, `AddWatchFlow.urlCacheRemount.test.tsx`, `signCoverUrls.test.ts`) does not reference either file this plan modified (`WornTabContent.tsx` or `[tab]/page.tsx`) and is unrelated to WEAR-03/WEAR-04 — treated as pre-existing full-suite noise (likely cross-test mock/module-state pollution that only surfaces when the entire suite runs together) and left untouched per the deviation rules' SCOPE BOUNDARY. The plan's own `<verification>` block specifies the targeted vitest list, not the full suite, as the authoritative gate for this plan.
- No push — per this plan's `<verification>` section, push happens at 84-07.

## User Setup Required

None.

## Next Phase Readiness

- WEAR-03 and WEAR-04 are both fully shipped (logic from 84-03, component from 84-05, wiring from this plan) and marked complete in `.planning/REQUIREMENTS.md`.
- The Worn tab now shows the leaderboard above Timeline/Calendar in every state, fed by viewer-gated wears and privacy-scoped owned watches — T-84-LEAK is closed.
- Phase 84 is 6/7 plans complete. 84-07 remains: the local-dev walk against local Supabase and the prod push/verification, per this plan's objective ("The local-dev walk happens in 84-07").
- No blockers.

---
*Phase: 84-wear-history-depth*
*Completed: 2026-09-13*

## Self-Check: PASSED

All modified/created files verified present (`src/components/profile/WornTabContent.tsx`, `src/app/u/[username]/[tab]/page.tsx`, this SUMMARY). Both commits (`4cd0aa10`, `04209a75`) verified present in `git log`.
