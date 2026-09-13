---
phase: 84-wear-history-depth
plan: 03
subsystem: lib
tags: [vitest, tdd, pure-functions, worn-tab, leaderboard, privacy]

# Dependency graph
requires:
  - phase: 84-wear-history-depth (Plan 02)
    provides: logBackfillWear server action, wear.ts/stats.ts baseline
provides:
  - WINDOW_DAYS / WearWindowKey / DEFAULT_WEAR_WINDOW rolling-window constants
  - filterEventsByWindow (D-13 rolling-window filter over wornDate)
  - buildLeaderboard (D-11 zero-wear-inclusive ranking with D-13 tie-break)
  - scopeWornTabWatches (D-14 viewer-privacy scoping helper, closes T-84-LEAK)
affects: [84-05 (leaderboard component), 84-06 (Worn tab page wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure logic + exhaustive vitest unit tests, no I/O, no framework imports"
    - "Client-side leaderboard computed from the already viewer-gated events array (no new SQL aggregate)"

key-files:
  created:
    - src/lib/wornTabScope.ts
    - tests/unit/leaderboard.test.ts
    - tests/unit/wornTabScope.test.ts
  modified:
    - src/lib/wear.ts
    - src/lib/stats.ts

key-decisions:
  - "filterEventsByWindow has no upper bound on the window (only a lower cutoff) so a cross-timezone viewer's clock skew never drops an owner's same-day wear."
  - "buildLeaderboard reuses wearCountByWatchMap for count aggregation rather than re-implementing counting, per the plan's key_links contract."
  - "scopeWornTabWatches deliberately imports nothing beyond types, keeping it testable without rendering the Suspense/'use cache' Worn tab page; 84-06 wires it in."

patterns-established:
  - "Rolling-window day arithmetic uses setUTCDate on a todayISO-anchored UTC date and lexical string comparison against the text wornDate column — never ::date/INTERVAL SQL casts or JS Date comparison of the events themselves."

requirements-completed: []  # WEAR-03/WEAR-04 stay unmarked — this plan ships only the logic half; 84-05/84-06 deliver the UI and wiring that complete the requirements.

# Metrics
duration: 10min
completed: 2026-09-12
---

# Phase 84 Plan 03: Leaderboard Logic + Worn Tab Privacy Scoping Summary

**Pure, fully unit-tested rolling-window filter, zero-wear-inclusive ranking, and viewer-privacy scoping helpers behind the Worn tab leaderboard — no UI, no wiring, 27/27 tests green.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-13T04:20:00Z (approx, per session start)
- **Completed:** 2026-09-13T04:22:40Z
- **Tasks:** 2 (both `type="auto" tdd="true"`, sharing one RED/GREEN cycle per the plan's single `<feature>` block)
- **Files modified:** 5 (2 modified, 3 created)

## Accomplishments
- `WINDOW_DAYS` / `WearWindowKey` / `DEFAULT_WEAR_WINDOW` rolling-window constants added to `src/lib/wear.ts` (D-09 default `'3mo'`, D-13 day counts: 1mo=30, 3mo=90, 6mo=182, 12mo=365, all=null).
- `filterEventsByWindow` added to `src/lib/stats.ts` — lexical `wornDate >= cutoffISO` comparison, no upper bound, UTC day arithmetic via `setUTCDate` (never `::date`/`INTERVAL` SQL casts).
- `buildLeaderboard` added to `src/lib/stats.ts` — every owned watch gets a row (including zero-wear), non-owned watchIds never produce rows, ranked by count desc → most-recent wornDate desc → "Brand Model" A→Z, with zero-wear rows sorted A→Z at the bottom.
- `src/lib/wornTabScope.ts` created — `scopeWornTabWatches` mirrors the Collection tab's `settings.collectionPublic` gate for the Worn tab, closing T-84-LEAK (a non-owner without collection access only sees watches they've already seen a wear for).
- `tests/unit/leaderboard.test.ts` (22 tests) and `tests/unit/wornTabScope.test.ts` (5 tests) — 27/27 passing, covering every behavior case in the plan's `<behavior>` block including month/year boundary arithmetic and non-mutation guarantees.

## Task Commits

Each task was committed atomically as a shared RED/GREEN pair (both tasks' RED and GREEN steps were combined into one test-then-implement cycle per the plan's single `<feature>` block):

1. **RED (Tasks 1+2 tests)** - `545beb15` (test) — `tests/unit/leaderboard.test.ts` + `tests/unit/wornTabScope.test.ts`, confirmed failing (20/22 and all of wornTabScope failing on missing exports/module).
2. **GREEN (Tasks 1+2 implementation)** - `057549c2` (feat) — `src/lib/wear.ts`, `src/lib/stats.ts`, `src/lib/wornTabScope.ts`; all 27 tests pass.

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## TDD Gate Compliance

- RED gate: `545beb15` (`test(84-03): ...`) — present, confirmed 20/22 new assertions failing pre-implementation.
- GREEN gate: `057549c2` (`feat(84-03): ...`) — present, all 27 tests pass after implementation.
- REFACTOR gate: not needed — implementation matched the plan's exact spec on the first pass; no cleanup commit required.

## Files Created/Modified
- `src/lib/wear.ts` - Added `WINDOW_DAYS`, `WearWindowKey`, `DEFAULT_WEAR_WINDOW` (D-09, D-13)
- `src/lib/stats.ts` - Added `filterEventsByWindow` and `buildLeaderboard` + `LeaderboardRow<W>`, extended the existing `@/lib/wear` import
- `src/lib/wornTabScope.ts` - New pure helper: `scopeWornTabWatches` (D-14 / T-84-LEAK)
- `tests/unit/leaderboard.test.ts` - New: 22 tests covering window filtering and leaderboard ranking
- `tests/unit/wornTabScope.test.ts` - New: 5 tests covering all viewer-scoping cases

## Decisions Made
None beyond what's captured in `key-decisions` above — plan executed exactly as written, including the D-14 confirmation note already baked into the plan's objective (Collection tab gates non-owners on `settings.collectionPublic`; Worn tab previously did not, which this helper fixes at the logic layer).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Pure in-process TypeScript logic with no DB, API route, or UI surface touched.

## Next Phase Readiness

- `filterEventsByWindow`, `buildLeaderboard`, and `scopeWornTabWatches` are exported, pure, and exhaustively tested — ready for 84-05 (leaderboard component) and 84-06 (Worn tab page wiring, which will call `scopeWornTabWatches` against `src/app/u/[username]/[tab]/page.tsx`'s existing `settings.collectionPublic` gate).
- No blockers. WEAR-03/WEAR-04 intentionally remain unmarked in REQUIREMENTS.md per this plan's scope (logic half only).

---
*Phase: 84-wear-history-depth*
*Completed: 2026-09-12*

## Self-Check: PASSED

All created/modified files verified present (src/lib/wear.ts, src/lib/stats.ts, src/lib/wornTabScope.ts, tests/unit/leaderboard.test.ts, tests/unit/wornTabScope.test.ts, this SUMMARY). All 3 commits verified present in git log (545beb15 test RED, 057549c2 feat GREEN, 2083e5ac docs SUMMARY).
