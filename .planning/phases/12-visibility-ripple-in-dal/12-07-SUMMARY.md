---
phase: 12-visibility-ripple-in-dal
plan: "07"
subsystem: tests
tags: [gap-closure, wishlist, visibility, three-tier, mocks]
dependency_graph:
  requires: []
  provides: [three-tier-wishlist-test-contract]
  affects: [WYWT-10, WYWT-11]
tech_stack:
  added: []
  patterns: [queue-based-mock, parity-dispatch, explicit-follows-flag]
key_files:
  created: []
  modified:
    - tests/actions/wishlist.test.ts
decisions:
  - "Use mockFollowsExpected flag to distinguish followers-tier tests from all others, avoiding broken even/odd counter logic when multi-invocation tests (Test 7) don't issue follows queries"
  - "Keep mockJoinRows as a simple variable (not a queue) since most tests set it once per it() block; multi-invocation Test 7 relies on mockFollowsExpected=false → always returns mockJoinRows"
  - "selectCallCount accumulates across the whole test rather than per-invocation to enable Test 9's selectCallCount==1 and Tests 10/11's selectCallCount==2 assertions"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-22T21:51:05Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 1
---

# Phase 12 Plan 07: Gap Closure — wishlist.test.ts Three-Tier Mock Contract

One-liner: Rewrote wishlist.test.ts mock fixture and db.select chain to match the production three-tier visibility contract, adding Tests 10-11 for followers-tier coverage and purging all wornPublic references.

## Objective

Close the single VERIFICATION.md gap on Truth #5: `tests/actions/wishlist.test.ts` used the pre-Phase-12 `wornPublic` mock contract, causing Tests 5 Case B and 9 to pass for the wrong reason and leaving the followers-tier happy/sad paths untested.

## Tasks Executed

### Task 1: Replace publicWearJoinRow fixture + queue-configurable db.select mock

- Replaced `wornPublic: true` with `profilePublic: true` + `visibility: 'public'` in `publicWearJoinRow()` to match the action's SELECT shape at lines 62-71
- Introduced `mockFollowRows`, `mockFollowsExpected`, `selectCallCount`, `_invocationParity` for two-query dispatch
- `beforeEach` resets all mock state per test
- Commit: `ac4d799`

### Task 2: Rewrite Test 5 Case B (three-tier deny) + Test 9 (G-5 self-bypass)

- Test 5 now has 3 explicit deny branches:
  - Case A: no row → "Wear event not found"
  - Case B: `visibility='private'` + non-self → "Wear event not found"
  - Case C: `profilePublic=false` + `visibility='public'` → "Wear event not found" (G-4 outer gate)
- Test 9 exercises G-5 isSelf short-circuit with worst-case settings (`visibility='private'`, `profilePublic=false`, `actorId==viewerUserId`) and asserts `selectCallCount==1` (no follows query on self path)
- All `wornPublic` references purged (`grep -c "wornPublic"` returns 0)
- Commit: `36437bf`

### Task 3: Add Test 10 (followers-tier happy) + Test 11 (followers-tier deny)

- Test 10: `visibility='followers'` + `mockFollowRows=[{id:'follow-row-id-placeholder'}]` → success + `selectCallCount==2`
- Test 11: `visibility='followers'` + `mockFollowRows=[]` → "Wear event not found" + `selectCallCount==2`
- Both tests set `mockFollowsExpected=true` to enable parity-based dispatch in the mock
- Commit: `74fee9b`

## Final Test Run

```
Tests  11 passed (11)
Test Files  1 passed (1)
```

Full action suite (no regressions):
```
Tests  53 passed (53)
Test Files  7 passed (7)
```

## Gap Closure Verification

| VERIFICATION.md Missing Item | Status |
|------------------------------|--------|
| publicWearJoinRow returns `{ visibility, profilePublic }` not `{ wornPublic }` | RESOLVED |
| Test 5 Case B exercises visibility='private' deny branch | RESOLVED |
| Test 9 uses G-5 isSelf check not wornPublic semantics | RESOLVED |
| Mock db.select chain configurable for two-query dispatch | RESOLVED |
| Test 10: followers-tier happy path | RESOLVED |
| Test 11: followers-tier deny path | RESOLVED |

**VERIFICATION.md Truth #5 re-verification:** All 6 missing items addressed. Wishlist action tests green (11/11). Integration matrix test at `tests/integration/phase12-visibility-matrix.test.ts` untouched. Truth #5 passes.

## Dead-Key Purge Confirmed

```
grep -c "wornPublic" tests/actions/wishlist.test.ts
→ 0
```

## Three-Tier Contract Shape

```
grep -E "visibility: '(public|followers|private)'" tests/actions/wishlist.test.ts | wc -l
→ 6
```

(fixture default + Test 5 Case B + Test 5 Case C + Test 9 + Test 10 + Test 11)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced even/odd counter with mockFollowsExpected flag**
- **Found during:** Task 1 verification
- **Issue:** The plan's queue-based counter approach (even calls = JOIN, odd = follows) broke Test 7 which calls the action twice with `visibility='public'` — the second action invocation's JOIN would be dispatched as call #1 (odd → follows), returning an empty array and causing "Wear event not found" instead of success.
- **Fix:** Introduced `mockFollowsExpected` boolean flag. When false (default), every `db.select()` returns `mockJoinRows`. When true (Tests 10, 11), alternates JOIN/follows using `_invocationParity`. This cleanly separates followers-tier tests from all others without any counting.
- **Files modified:** `tests/actions/wishlist.test.ts`
- **Commits:** ac4d799 → 36437bf → 74fee9b (iterative refinement)

## Known Stubs

None — this plan is test-only with no production stubs.

## Threat Flags

None — test-only changes; no new production surface introduced.

## Self-Check: PASSED

- `tests/actions/wishlist.test.ts` exists and was modified
- Commits ac4d799, 36437bf, 74fee9b all present in git log
- `npx vitest run tests/actions/wishlist.test.ts` exits 0 (11 tests)
- `grep -c "wornPublic" tests/actions/wishlist.test.ts` returns 0
- Zero files under `src/` modified
