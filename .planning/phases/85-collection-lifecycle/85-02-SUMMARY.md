---
phase: 85-collection-lifecycle
plan: 02
subsystem: database
tags: [typescript, drizzle, postgres, dal, recommender, similarity]

# Dependency graph
requires:
  - phase: 85-01
    provides: "watches.previously_owned status + disposal_reason/sell_price/disposal_date columns on local Supabase; disposalReasonEnum mirrored in src/db/schema.ts"
provides:
  - "WatchStatus union carries previously_owned (replaces sold); DisposalReason type"
  - "WATCH_STATUSES / WATCH_STATUS_LABELS / DISPOSAL_REASONS / DISPOSAL_REASON_LABELS constants"
  - "mapRowToWatch/mapDomainToRow round-trip disposalReason/sellPrice/disposalDate"
  - "D-14: getWatchByIdForViewer visitor predicate narrowed to IN ('owned','grail') — previously_owned is owner-only"
  - "D-18: recommendations.ts viewer-exclusion set includes previously_owned"
  - "LIFE-06 regression test proving analyzeSimilarity/computeGapFill/computeTasteOverlap ignore previously_owned"
affects: [85-03, 85-04, 85-05, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'key' in data idiom (not !== undefined) for nullable DAL fields so an explicit undefined/null clears the DB column (load-bearing for the D-04 undo path in a later plan)"
    - "Recursive drizzle SQL queryChunks walk (StringChunk.value / nested SQL.queryChunks) to assert generated WHERE-clause text in a unit test without a live DB"

key-files:
  created:
    - tests/lib/previouslyOwnedExclusion.test.ts
  modified:
    - src/lib/types.ts
    - src/lib/constants.ts
    - src/data/watches.ts
    - src/data/recommendations.ts
    - tests/data/getWatchByIdForViewer.test.ts
    - src/data/__tests__/recommendations.test.ts

key-decisions:
  - "WATCH_STATUSES order is ['owned','wishlist','grail','previously_owned'] — previously_owned last, per plan (85-04/WatchForm filters it out of the create/edit dropdown per D-07, not this plan)"
  - "DISPOSAL_REASONS keys stay unquoted object-literal keys in DISPOSAL_REASON_LABELS so 85-04's repo-wide grep -rn \"'sold'\" src tests gate isn't tripped by this file"
  - "getWatchByIdForViewer's non-owner OR-branch narrows to IN ('owned','grail') only — previously_owned is deliberately absent (not IN ('owned','previously_owned','grail')) so visitors never match on it; the owner short-circuit above still returns the owner's own previously-owned watch"
  - "recommendations.ts exclusion loop is the ONLY real edit site in that file for D-18 — every other status==='owned' check (seed/candidate scoring) stays owned-only per research's allowlist audit"

patterns-established: []

requirements-completed: [LIFE-01, LIFE-02, LIFE-06]

# Metrics
duration: ~35min
completed: 2026-09-13
---

# Phase 85 Plan 02: Domain types, constants, DAL mapping, D-14 predicate and D-18 exclusion Summary

**`WatchStatus`/`DisposalReason` domain types, disposal-field DAL round-trip with a null-clearing `'key' in data` idiom, a narrowed `IN ('owned','grail')` visitor-visibility predicate (D-14), and a recommender exclusion-set edit (D-18) — locked by a new LIFE-06 regression test proving `analyzeSimilarity`/`computeGapFill`/`computeTasteOverlap` already ignore `previously_owned`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 1 (auto, tdd)
- **Files modified:** 7 (5 modified source/type files, 2 modified test files, 1 new test file)

## Accomplishments
- `src/lib/types.ts`: `WatchStatus` now carries `previously_owned` in place of `sold`; added `DisposalReason` type and the `disposalReason?`/`sellPrice?`/`disposalDate?` fields on `Watch`.
- `src/lib/constants.ts`: `WATCH_STATUSES` reordered with `previously_owned` last; added `WATCH_STATUS_LABELS`, `DISPOSAL_REASONS`, `DISPOSAL_REASON_LABELS`.
- `src/data/watches.ts`: `mapRowToWatch` surfaces the 3 disposal fields; `mapDomainToRow` writes them with the `'key' in data` idiom (not `!== undefined`) so a later explicit-`undefined` write actually nulls the column; `getWatchByIdForViewer`'s non-owner predicate narrowed from `IN ('owned','sold','grail')` to `IN ('owned','grail')` (D-14) with the docblock and inline comment updated to explain the owner-only previously-owned visibility rule.
- `src/data/recommendations.ts`: viewer exclusion loop now also matches `v.status === 'previously_owned'` (D-18) — a disposed model is no longer re-recommended to the viewer who sold it.
- Tests: replaced `getWatchByIdForViewer.test.ts` Unit 8 with a recursive-SQL-chunk-walk assertion proving the generated WHERE text contains `IN ('owned','grail')` and neither `previously_owned` nor `'sold'`, plus a new Unit 8b proving the owner still receives their own previously-owned watch; added a Phase 85 D-18 case to `recommendations.test.ts` proving a viewer's previously-owned watch drops a matching catalog top-up row from their own rail while an unrelated control row still surfaces; added `tests/lib/previouslyOwnedExclusion.test.ts` (new) proving `analyzeSimilarity`, `computeGapFill`, and `computeTasteOverlap` produce identical output with vs. without an identical `previously_owned` twin of the target in the collection.

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain types, constants, DAL mapping, D-14 predicate and D-18 exclusion** - `767822a0` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/lib/types.ts` - `WatchStatus` union swap, `DisposalReason` type, 3 new `Watch` disposal fields
- `src/lib/constants.ts` - `WATCH_STATUSES` reorder, `WATCH_STATUS_LABELS`, `DISPOSAL_REASONS`, `DISPOSAL_REASON_LABELS`
- `src/data/watches.ts` - `mapRowToWatch`/`mapDomainToRow` disposal-field round-trip; `getWatchByIdForViewer` D-14 predicate narrowing
- `src/data/recommendations.ts` - D-18 viewer-exclusion-set addition
- `tests/data/getWatchByIdForViewer.test.ts` - Unit 8/8b replacement (SQL-chunk-walk + owner-still-sees-own-previously-owned)
- `src/data/__tests__/recommendations.test.ts` - D-18 exclusion-key-identity regression case
- `tests/lib/previouslyOwnedExclusion.test.ts` - new LIFE-06 regression test (analyzeSimilarity/computeGapFill/computeTasteOverlap parity)

## Decisions Made
None beyond what CONTEXT.md/RESEARCH.md already locked — plan executed as specified. One implementation-level choice: the D-18 recommendations.test.ts case had to give the viewer a normal `owned` watch in addition to the `previously_owned` twin, because `getRecommendationsForViewer` bails early with `[]` when the viewer has zero currently-owned watches (a pre-existing, correct guard unrelated to D-18) — without it, both the excluded row and the control row would trivially be "absent" for the wrong reason.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps matched on the first pass after the initial test run surfaced (and I fixed, before considering the task done) the zero-owned-watches guard interaction described above — that's a test-fixture completeness fix within Task 1's own TDD RED→GREEN loop, not a deviation from the plan's action steps.

## Issues Encountered

The first run of the new `recommendations.test.ts` D-18 case failed both assertions (`speedmasterRec` correctly `undefined`, but `seikoRec` also `undefined`) because the viewer fixture had only a `previously_owned` watch and no `owned` watch, tripping `getRecommendationsForViewer`'s existing "viewer has 0 owned watches → return []" guard before the exclusion logic under test ever ran. Fixed by adding an unrelated `owned` watch to the viewer fixture; re-ran and both assertions passed for the intended reason (exclusion-key match, not early bail-out).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Domain types, constants, and the DAL now speak `previously_owned` end-to-end; disposal fields round-trip through `mapRowToWatch`/`mapDomainToRow`.
- Visitors are gated out of previously-owned watch pages (D-14); the recommender excludes disposed models from being re-recommended to their own former owner (D-18).
- **Expected and intentional, per this plan's objective:** `npm run build` was NOT run as this plan's gate — it is still expected to fail on remaining `'sold'` literals owned by 85-03 (`src/app/actions/watches.ts`, `src/app/actions/divestments.ts`, `StatusToggle`, `WatchCard`, `watchFlow/destinations.ts`, `ConfirmStep`, follows/discovery/catalog DAL, WatchForm status `<Select>`) and 85-04 (test fixtures + the build-green gate itself). Do not treat this as a regression.
- 85-03 runs next in the same wave (no shared files with this plan); 85-04 sweeps remaining test fixtures and owns the `npm run build` gate.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-13*
