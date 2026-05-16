---
phase: 38-cat-13-engine-rewire
plan: 04
subsystem: test-fixtures-gap-closure
gap_closure: true
tags: [gap-closure, idiom-a-cascade, fail-loud, plan-a-followup, test-fixtures]
dependency_graph:
  requires: [38-01, 38-02, 38-03]
  provides: [tsc-baseline-restored, vitest-green-actions-suite, fail-loud-contract-test]
  affects: [tests/data, tests/actions]
tech_stack:
  added: []
  patterns: [IDIOM-A-3arg-createWatch, fail-loud-test-contract]
key_files:
  created: []
  modified:
    - tests/data/getRecommendationsForViewer.test.ts
    - tests/data/getSuggestedCollectors.test.ts
    - tests/data/getWatchByIdForViewer.test.ts
    - tests/data/getWearRailForViewer.test.ts
    - tests/data/isolation.test.ts
    - tests/actions/watches.test.ts
    - tests/actions/watches.notesPublic.test.ts
    - tests/actions/wishlist.test.ts
    - tests/actions/addwatch-catalog-resilience.test.ts
decisions:
  - "Used Shape A (upsertCatalogFromUserInput → catalogId → 3-arg createWatch) for tests/data files — preferred over raw db.insert because catalog upsert is idempotent and stays local to each test helper"
  - "Mocked @/data/catalog in all 4 tests/actions files; literal 'cat-id-1' / 'wishlist-cat-id-1' return values used for deterministic assertions"
  - "addwatch-catalog-resilience.test.ts: used resolves.toEqual({success: false, error: 'Failed to create watch'}) — outer try/catch in addWatch (lines 99-294 of watches.ts) catches re-thrown catalog errors and converts to this shape"
  - "watches.test.ts and watches.notesPublic.test.ts: added getWatchById and getMaxWishlistSortOrder to @/data/watches mock — Phase 37 added getWatchById call to editWatch; mocks were missing these (Rule 1 fix)"
  - "watches.notesPublic.test.ts: changed upsertCatalogFromUserInput mock from null to 'cat-id-1' — Phase 38 fail-loud means null return causes addWatch to throw, blocking createWatch from being called"
  - "All 4 production-source paths verified untouched: src/, supabase/, drizzle/, src/db/ — git diff returns 0 bytes"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-12T16:37:27Z"
  tasks_completed: 5
  files_modified: 9
  files_created: 1
  commits: 4
  tsc_errors_before: 35
  tsc_errors_after: 28
  vitest_failures_closed: 13
---

# Phase 38 Plan 04: Test-Fixture Gap Closure Summary

**One-liner:** Closed the test-layer regression from Plan A's D-07 fixture sweep scope gap — 9 test files updated to Phase 38 IDIOM A 3-arg createWatch + fail-loud contract; production code untouched.

## Gap Context

38-VERIFICATION.md found Plan A's D-07 sweep ran `tests/integration/phase*.test.ts` + `tests/data/getWearEventsCountByUser.test.ts` but missed 9 additional files:
- 5 files in `tests/data/` → 7 tsc TS2554 errors (createWatch called with 2 args)
- 4 files in `tests/actions/` → 13 vitest failures (mocks + expectations + 1 stale fire-and-forget test)

## Closure Results

### Gate 1: tsc baseline restored

- Before this plan: 35 total errors (+8 from Phase 38 regressions per 38-VERIFICATION.md line 173)
- After this plan: **28** total errors (target: ≤28)
- The 5 named tests/data/*.test.ts files: **0 errors** (was 7 — all 7 TS2554 errors closed)

### Gate 2: vitest tests/actions sweep

- `tests/actions/watches.test.ts`: 22/22 PASS
- `tests/actions/watches.notesPublic.test.ts`: 4/4 PASS (previously 3 failing)
- `tests/actions/wishlist.test.ts`: 11/11 PASS (previously 5 failing)
- `tests/actions/addwatch-catalog-resilience.test.ts`: 7/7 PASS (was 1 failing + entire file rewrote)
- **Total failures closed: 13 of 13**

### Gate 3: Production code untouched

- `git diff HEAD~4 -- src/ supabase/ drizzle/ src/db/`: **0 bytes**
- No production files modified across all 4 commits

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | tests/data/* IDIOM A cascade | 912e7b6 | 5 |
| 2 | tests/actions/watches + notesPublic mocks | 6c56d2d | 2 |
| 3 | tests/actions/wishlist destructure update | e0a0057 | 1 |
| 4 | resilience test fail-loud rewrite | 48f6854 | 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing getWatchById + getMaxWishlistSortOrder in @/data/watches mock**
- **Found during:** Task 2
- **Issue:** Phase 37 added `getWatchById` call to `editWatch` before `updateWatch`. The mock at the top of `watches.test.ts` and `watches.notesPublic.test.ts` didn't include it. Tests that exercised `editWatch` would fail because `getWatchById` returned `undefined` → early return with `'Watch not found'` before `updateWatch` was called.
- **Fix:** Added `getWatchById: vi.fn().mockResolvedValue({...valid watch...})` and `getMaxWishlistSortOrder: vi.fn().mockResolvedValue(0)` to both files' `@/data/watches` mock factories.
- **Files modified:** tests/actions/watches.test.ts, tests/actions/watches.notesPublic.test.ts
- **Commit:** 6c56d2d

**2. [Rule 1 - Bug] notesPublic test had upsertCatalogFromUserInput returning null**
- **Found during:** Task 2
- **Issue:** The `@/data/catalog` mock in `watches.notesPublic.test.ts` had `upsertCatalogFromUserInput: vi.fn().mockResolvedValue(null)`. Post-Phase-38 fail-loud, a null return causes `addWatch` to throw → outer catch → `{success: false}`. The test at line 106 asserting `result.success === true` would fail.
- **Fix:** Changed `mockResolvedValue(null)` to `mockResolvedValue('cat-id-1')`.
- **Files modified:** tests/actions/watches.notesPublic.test.ts
- **Commit:** 6c56d2d

## Threat Flags

None. Test-only edits; no production code modified; no new trust boundaries.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| All 9 files in 38-VERIFICATION.md gap list edited | PASS |
| 7 tsc TS2554 errors closed in 5 tests/data files | PASS (0 errors remain) |
| 13 vitest failures closed in 4 tests/actions files | PASS (44/44 pass) |
| Production code untouched (src/, supabase/, drizzle/, src/db/) | PASS (0 diff bytes) |
| Fail-loud contract asserted in resilience test | PASS |
| createWatch-not-called assertion present when upsert fails | PASS (2 tests) |
| Single commit per task (4 commits) | PASS |
| Total tsc errors ≤ 28 (pre-Phase-38 baseline + tolerance) | PASS (28) |
