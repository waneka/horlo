---
phase: 57-comment-thread-ui-feed-extension-grid-counts
plan: 01
subsystem: testing
status: complete
tags: [wave-0, tdd, comments, feed, grid-counts, security]
completed: "2026-05-24"
duration: ~11m
tasks_completed: 2
tasks_total: 2
files_created: 4
files_modified: 1

dependency_graph:
  requires: []
  provides:
    - "tests/data/getCommentsForTarget.test.ts (CMNT-03/CMNT-09/D-04 RED guard)"
    - "tests/data/comments.test.ts (GATE-03 regression guards)"
    - "tests/data/getBatchedWatchCounts.test.ts (DISP-01/D-10 RED guard)"
    - "tests/data/getFeedForUser.test.ts — FEED-07 WHERE-shape RED cases appended"
    - "tests/actions/comments.test.ts — FEED-06/CMNT-07 RED cases appended"
  affects:
    - "Plans 02, 03 (these tests gate their implementations)"

tech_stack:
  added: []
  patterns:
    - "vi.fn() mock for per-test mockImplementation override (getCommentsForTarget, getBatchedWatchCounts)"
    - "WHERE-clause SQL AST walk (mirror of Phase 12 visibility test pattern)"
    - "vi.mock('@/data/activities') logActivity spy for FEED-06 assertions"

key_files:
  created:
    - tests/data/getCommentsForTarget.test.ts
    - tests/data/comments.test.ts
    - tests/data/getBatchedWatchCounts.test.ts
  modified:
    - tests/data/getFeedForUser.test.ts
    - tests/actions/comments.test.ts

decisions:
  - "Appended FEED-06 + CMNT-07 cases to existing tests/actions/comments.test.ts rather than creating separate per-action files — avoids duplicate mock setup and keeps CMNT-01/02/06/07/FEED-06 in one canonical home. VALIDATION map's separate-file rows are reconciled to this file."
  - "FEED-07 tests assert WHERE clause SQL shape (contains 'commented'/'targetOwnerId'/'watchStatus') rather than result-row filtering — because the unit mock chain does not actually run SQL predicates. Mirrors the existing Phase 12 'visibility' test pattern (lines 189-214 of getFeedForUser.test.ts)."
  - "CMNT-03 tests use vi.fn() + mockImplementation (not the shared-chain mock in top of getCommentsForTarget.test.ts) to get per-call control over the two db.select invocations (gate check + comments query)."
---

# Phase 57 Plan 01: Wave 0 Nyquist Test Scaffolds Summary

Wave 0 test scaffolds for Phase 57 — every downstream behavior (Plans 02-06) has an automated test waiting for it. All correctness-critical cases fail RED on current main, as expected.

## What Was Built

Five test files created/extended:

1. **`tests/data/getCommentsForTarget.test.ts`** (new) — 4 tests
   - CMNT-03: asserts orderBy receives `isDescending: true` (2 RED — source uses `asc()`)
   - CMNT-09: asserts result length equals query row count (passes — regression guard)
   - D-04: asserts gated viewer gets `[]` (passes — gate works today)

2. **`tests/data/comments.test.ts`** (new) — 10 tests
   - GATE-03: `canViewerCommentOnTarget` gate assertions across all branches
   - All 10 pass today (gate logic is correct) — regression guards
   - Covers: wear short-circuit, owner bypass, non-wishlist open, wishlist isMutualFollow delegation, direction correctness, fail-closed on missing watch

3. **`tests/data/getBatchedWatchCounts.test.ts`** (new) — 7 tests
   - DISP-01/D-10: all 7 fail RED with "getBatchedWatchCounts is not a function"
   - Plan 03 creates the function; these tests turn GREEN when it ships
   - Covers: gated wishlist (commentCount:0), non-wishlist (true count), owner's own wishlist, N+1 guard (≤5 queries for 50 watches), Map return type, empty input, mixed batch

4. **`tests/data/getFeedForUser.test.ts`** (extended) — 3 new cases appended
   - FEED-07: asserts WHERE clause SQL AST contains 'commented', 'targetOwnerId', 'watchStatus'
   - All 3 fail RED — no 'commented' branch in current `getFeedForUser` WHERE clause
   - Pre-existing 12 tests all still pass

5. **`tests/actions/comments.test.ts`** (extended) — 4 new cases appended
   - CMNT-07: deleteCommentAction revalidates profile tag (1 RED — no revalidateTag today)
   - FEED-06: logActivity called on non-self watch comment (1 RED)
   - FEED-06: self-comment guard suppresses logActivity (1 pass — no call expected or made)
   - FEED-06: wear comment logs with `watchId=null` and `targetType='wear'` (1 RED)
   - Pre-existing 9 tests all still pass

## Test Run Results

```
Test Files: 4 failed | 1 passed (5)
Tests:      15 failed | 30 passed | 11 skipped (56)
```

- **15 RED** failures — all assert not-yet-built behavior (correct Wave 0 outcome)
- **30 passing** — all pre-existing cases preserved
- **11 skipped** — integration tests (no local DB in CI)

### RED Evidence by Requirement

| Requirement | Failure Reason | Turns GREEN In |
|-------------|----------------|----------------|
| CMNT-03 (watch) | `containsDesc(orderByArg) === false` (asc used) | Plan 02 |
| CMNT-03 (wear) | same | Plan 02 |
| DISP-01 (all 7) | `getBatchedWatchCounts is not a function` | Plan 03 |
| FEED-07 ('commented') | WHERE has no 'commented' literal | Plan 02 |
| FEED-07 (targetOwnerId) | WHERE has no 'targetOwnerId' | Plan 02 |
| FEED-07 (watchStatus) | WHERE has no 'watchStatus' | Plan 02 |
| CMNT-07 | `revalidateTag` called 0 times | Plan 02 |
| FEED-06 (non-self) | `logActivity` called 0 times | Plan 02 |
| FEED-06 (wear) | `logActivity` called 0 times | Plan 02 |

## Deviations from Plan

### Auto-fixed Issues

None.

### Design Decisions (Recorded per Plan Output spec)

**1. Append to `tests/actions/comments.test.ts` vs. separate files**

The VALIDATION map listed separate `addCommentAction.test.ts` and `editCommentAction.test.ts` files. Per the plan's explicit instruction ("Decision: APPEND to the existing `tests/actions/comments.test.ts`"), all Wave 0 action cases were appended to the existing file. CMNT-01/CMNT-02 happy-path coverage exists once in the pre-existing file; no duplication.

**2. FEED-07 assertion strategy: WHERE shape, not result filtering**

The plan's original framing described asserting that a `commented` wishlist row is "excluded from A's feed." In the unit test context, the mock chain returns `mockRows` directly without running SQL predicates. Asserting on result rows would produce either: (a) false positives (passes for wrong reason — metadata stripping), or (b) unconditionally-passing tests (mock returns everything). 

Solution: assert the SQL AST shape — the WHERE clause must contain the string literals `'commented'`, `'targetOwnerId'`, and `'watchStatus'` — mirroring the existing Phase 12 `'visibility'` test (lines 189-214 of getFeedForUser.test.ts). This is a sound RED assertion because the current WHERE clause has none of these strings, and Plan 02's implementation will add all three.

**3. `vi.fn()` mock for `db.select` in getCommentsForTarget.test.ts**

The top-level shared mock in `getFeedForUser.test.ts` uses a plain function capturing to `calls[]`. The `getCommentsForTarget.test.ts` file needs per-call control (first call = gate watch-fetch, second call = comments query with captured orderBy). Used `vi.fn()` in the `@/db` mock so per-test `mockImplementation` overrides work correctly.

## Known Stubs

None. This plan creates test-only files — no production stubs.

## Threat Flags

None. No new production network endpoints, auth paths, or schema changes introduced (test-only plan, T-57-03 disposition: accept).

## Self-Check

Files created/modified:
- `tests/data/getCommentsForTarget.test.ts` — FOUND
- `tests/data/comments.test.ts` — FOUND
- `tests/data/getBatchedWatchCounts.test.ts` — FOUND
- `tests/data/getFeedForUser.test.ts` — FOUND (extended)
- `tests/actions/comments.test.ts` — FOUND (extended)

Commits:
- `3db97e5` — test(57-01): Wave 0 DAL test scaffolds RED
- `b28dc05` — test(57-01): Wave 0 action test scaffolds RED

Verification: all 5 files parse without errors, 15 new cases RED for correct reasons, 30 pre-existing cases pass.

## Self-Check: PASSED
