---
phase: 85-collection-lifecycle
plan: 04
subsystem: testing
tags: [vitest, drizzle, rename-sweep, watchstatus, build-gate]

# Dependency graph
requires:
  - phase: 85-02
    provides: "WatchStatus union with previously_owned; DAL mapping; D-14/D-18 predicates"
  - phase: 85-03
    provides: "divestments dual-write retired; non-test source swept off 'sold' as WatchStatus"
provides:
  - "Every remaining test fixture (src/-colocated + tests/) models previously_owned instead of sold"
  - "Repo-wide grep gate proves no status-'sold' literal remains anywhere in src or tests"
  - "npm run build exits 0 — the rename sweep's build gate that Wave-4+ plans (85-05, 85-06, 85-07) depend on"
affects: [85-05, 85-06, 85-07, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Baseline-failure verification: revert edited test file to HEAD via `git checkout --`, re-run the same suite to prove identical failures pre-date this plan, then restore the edited content from a scratch-dir backup — no stash used"

key-files:
  created: []
  modified:
    - src/app/actions/__tests__/moveWishlistToCollection.test.ts
    - src/app/actions/__tests__/watches-recs-invalidation.test.ts
    - src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx
    - src/components/watch/ConfirmStep.test.tsx
    - src/components/watch/AddWatchFlow.test.tsx
    - src/data/__tests__/reactions-comments-gate.test.ts
    - tests/integration/phase59-unified-route.test.ts
    - tests/lib/tasteTags.test.ts
    - tests/data/comments.test.ts
    - tests/data/searchCatalogWatches.test.ts
    - tests/data/getFollowedOwnersForCatalog.test.ts
    - tests/data/getCollectorsForCatalog.test.ts
    - tests/integration/phase37-rls.test.ts

key-decisions:
  - "tests/integration/phase37-rls.test.ts (owned by 85-03's files_modified, not this plan's) still had one 'sold' literal in an explanatory comment 85-03 wrote about the retired dual-write — fixed here per the plan's explicit instruction to sweep any leftover found by the repo-wide gate in a prior plan's files, documented as a deviation"
  - "moveWishlistToCollection.test.ts's Case 3 (happy path) and the 'side-effect chain' test fail with `result.success === false` on both the edited and the unedited-at-HEAD version of the file (confirmed by temporarily reverting via `git checkout --` and re-running, then restoring from a scratch-dir backup) — root cause is the same missing `updateTag` export on this file's own `vi.mock('next/cache', ...)` stub that 85-03's SUMMARY already logged for watches.test.ts/watches.notesPublic.test.ts; pre-existing, unrelated to the sold->previously_owned rename, not fixed (out of this plan's scope boundary)"
  - "phase59-unified-route.test.ts: soldWatchId renamed to previouslyOwnedWatchId (variable identity, not just the string literal) per the plan's explicit instruction"

patterns-established: []

requirements-completed: [LIFE-01]

# Metrics
duration: ~25min
completed: 2026-09-14
---

# Phase 85 Plan 04: Close the sold → previously_owned rename Summary

**Swept the last 13 test fixture files off the `sold` WatchStatus literal, proved the repo-wide grep gate is empty, and got `npm run build` to exit 0 — the single build gate the rest of Wave 4 (85-05/06/07) depends on.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (both auto)
- **Files modified:** 13 (6 in Task 1, 7 in Task 2 — 6 planned + 1 deviation fix in a 85-03-owned file)

## Accomplishments

- All 6 `src/`-colocated test fixtures listed in the plan now model `previously_owned` instead of `sold`, with unchanged semantics: `moveWishlistToCollection.test.ts` Case 5's status-whitelist rejection message, title, and mocked row; `ProfileWatchCard-priceLine.test.tsx`'s price-bucket case; `reactions-comments-gate.test.ts`'s comment-visible non-wishlist case; `AddWatchFlow.test.tsx`'s `onWatchCreated` status union; comment-only touches in `watches-recs-invalidation.test.ts` and `ConfirmStep.test.tsx`.
- All 6 `tests/` fixtures listed in the plan swept the same way: `phase59-unified-route.test.ts`'s `soldWatchId` variable renamed to `previouslyOwnedWatchId` (identity, not just the literal) across seed data, comments, and 3 assertions; `tasteTags.test.ts`, `comments.test.ts`, `searchCatalogWatches.test.ts`, `getFollowedOwnersForCatalog.test.ts`, `getCollectorsForCatalog.test.ts` all had their `previously_owned`-excluded-exactly-where-`sold`-was rows and titles updated.
- Repo-wide gate `grep -rn "'sold'|"sold"" src tests | grep -vi disposal` found one additional leftover in `tests/integration/phase37-rls.test.ts` (an 85-03-owned file, not in this plan's `files_modified`) — an explanatory comment describing the retired divestments dual-write still read `status='sold'`. Fixed per the plan's explicit "if it prints a line inside 85-02/85-03's files, fix it the same way" instruction. Gate is now empty.
- `npm run build` exits 0 (verified twice, once with output captured directly to confirm the true process exit code rather than a piped `tail`'s).

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep src/ colocated test fixtures off the sold status** - `82c22ac1` (test)
2. **Task 2: Sweep tests/ fixtures, run the repo-wide literal gate, and pass the build** - `ee267ecf` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/app/actions/__tests__/moveWishlistToCollection.test.ts` - Case 5 status/error-message/title swapped to `previously_owned`
- `src/app/actions/__tests__/watches-recs-invalidation.test.ts` - comment-only swap
- `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` - docblock + test case swapped to `previously_owned`
- `src/components/watch/ConfirmStep.test.tsx` - docblock comment swap
- `src/components/watch/AddWatchFlow.test.tsx` - `onWatchCreated` status union literal swap
- `src/data/__tests__/reactions-comments-gate.test.ts` - test title + mocked status swapped
- `tests/integration/phase59-unified-route.test.ts` - `soldWatchId` → `previouslyOwnedWatchId` (variable + all usages), status literal, comments, test titles
- `tests/lib/tasteTags.test.ts` - fixture row status swap
- `tests/data/comments.test.ts` - test title + mocked status swapped
- `tests/data/searchCatalogWatches.test.ts` - test title + mocked status row swapped
- `tests/data/getFollowedOwnersForCatalog.test.ts` - docblock, `seedWatchForCatalog` union type, test title + call swapped
- `tests/data/getCollectorsForCatalog.test.ts` - docblock, `seedWatchForCatalog` union type, test title + call swapped
- `tests/integration/phase37-rls.test.ts` - deviation fix: explanatory comment's `status='sold'` reference updated to `previously_owned`

## Decisions Made

None beyond what's captured in the frontmatter `key-decisions`. One clarifying note on the plan's own acceptance criterion: `grep -c "Cannot move previously_owned watch to collection" src/app/actions/__tests__/moveWishlistToCollection.test.ts` returns 2, not the 1 stated in the plan's acceptance_criteria — the string legitimately appears twice (once in the test title, once in the assertion), and the original `'sold'` version had the identical two-line shape before this plan touched it. This is not a bug; the plan's stated count was imprecise about the file's pre-existing structure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/integration/phase37-rls.test.ts` still had a `'sold'` status literal in prose**
- **Found during:** Task 2's repo-wide gate (`grep -rn "'sold'|"sold"" src tests | grep -vi disposal`)
- **Issue:** This file belongs to 85-03's `files_modified`, not this plan's, but 85-03's own D-03 explanatory comment (added when the divestments dual-write was retired) described the retired UPDATE as `watches.status='sold'`, which the repo-wide literal gate correctly flagged.
- **Fix:** Updated the comment's status literal to `previously_owned`. Comment-only change; no test logic touched.
- **Files modified:** `tests/integration/phase37-rls.test.ts`
- **Verification:** Repo-wide gate re-run, empty. Targeted vitest for this file still DB-gated-skips cleanly (17 tests | 17 skipped, 0 failed) with no `DATABASE_URL` set.
- **Committed in:** `ee267ecf` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug — leftover literal in a comment).
**Impact on plan:** Necessary for the plan's own success criterion (repo-wide gate must be empty). No scope creep — same mechanical literal swap already being applied everywhere else in this plan.

## Issues Encountered

`src/app/actions/__tests__/moveWishlistToCollection.test.ts`'s Case 3 ("happy path — wishlist→owned") and the "side-effect chain" test both fail with `result.success === false` in the targeted vitest run for this file. I verified this predates this plan's edits: backed up the edited file to the scratch directory, ran `git checkout -- src/app/actions/__tests__/moveWishlistToCollection.test.ts` to restore the exact HEAD version (pre-this-plan), re-ran `npx vitest run` on that unmodified file, and got the identical 2 failures with the identical error (`expected false to be true` at the `result.success).toBe(true)` assertion). Restored the edited version afterward via `cp` from the scratch backup (no `git stash` used, per the destructive-git prohibition). Root cause: this test file's own `vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))` doesn't stub `updateTag`, which `moveWishlistToCollection`'s happy-path/side-effect branches call — the exact same missing-mock-export root cause 85-03's SUMMARY already logged for `tests/actions/watches.test.ts` / `tests/actions/watches.notesPublic.test.ts` (Phase 75 added `updateTag` calls; older test files' `next/cache` mocks were never updated to include it). Not fixed — out of this plan's scope boundary (unrelated to the sold→previously_owned rename; the Case 5 test this plan actually targets passes cleanly).

## User Setup Required

None - no external service configuration required.

## Verification

- Task 1 targeted vitest: `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx src/data/__tests__/reactions-comments-gate.test.ts src/components/watch/ConfirmStep.test.tsx src/components/watch/AddWatchFlow.test.tsx` — 85/87 pass; 2 pre-existing baseline failures confirmed identical at HEAD (see Issues Encountered).
- Task 1 grep gate: `grep -n "'sold'|"sold"" <6 files> | grep -vi disposal | wc -l` = 0. PASSED.
- Task 1 acceptance: `grep -c "Cannot move previously_owned watch to collection" moveWishlistToCollection.test.ts` = 2 (plan stated 1; see Decisions Made note — both occurrences are the correct mechanical swap).
- Task 2 targeted vitest: `npx vitest run tests/lib/tasteTags.test.ts tests/data/comments.test.ts tests/data/searchCatalogWatches.test.ts tests/data/getFollowedOwnersForCatalog.test.ts tests/data/getCollectorsForCatalog.test.ts tests/integration/phase59-unified-route.test.ts tests/integration/phase37-rls.test.ts` — 53 passed, 38 skipped (DB-gated integration suites correctly `describe.skip` without `DATABASE_URL`), 0 failed.
- Repo-wide gate: `grep -rn "'sold'|"sold"" src tests | grep -vi disposal` — empty. PASSED.
- `npm run build` — exit code 0, captured directly (not through a pipe), confirmed twice. `✓ Compiled successfully`, `Finished TypeScript`, all 36 routes generated. PASSED — this is the rename sweep's authoritative build gate per CLAUDE.md's Local-First Development note ("npm run build exit 0 is authoritative").
- Full-repo static/unit prebuild suite (run as part of `npm run build`'s pretest hook): 21 files / 485 tests passed, 0 failed.

## Next Phase Readiness

- The `sold` → `previously_owned` rename is fully closed: no source or test file anywhere in the repo uses `'sold'` as a `WatchStatus` value; it survives correctly only as a `DisposalReason` enum value (in `schema.ts`, `types.ts`, `constants.ts`, and the plan's own `disposal_reason`-mentioning lines) — exactly per D-01/D-02.
- `npm run build` exits 0. Wave-4 behavior plans (85-05 disposal flow, 85-06 celebration moment, 85-07 previously-owned visibility toggle) can now build on a compiling base.
- No new requirements beyond LIFE-01 (already marked complete by 85-01) are touched by this plan — it is purely the build-gate closure for the rename 85-01/85-02/85-03 started.
- One pre-existing, out-of-scope test gap remains and is now doubly confirmed: `moveWishlistToCollection.test.ts`'s own `next/cache` mock (plus `watches.test.ts` / `watches.notesPublic.test.ts` from 85-03) is missing an `updateTag` stub. A future quick task could add `updateTag: vi.fn()` to all three files' `vi.mock('next/cache', ...)` calls in one pass.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/app/actions/__tests__/moveWishlistToCollection.test.ts
- FOUND: src/app/actions/__tests__/watches-recs-invalidation.test.ts
- FOUND: src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx
- FOUND: src/components/watch/ConfirmStep.test.tsx
- FOUND: src/components/watch/AddWatchFlow.test.tsx
- FOUND: src/data/__tests__/reactions-comments-gate.test.ts
- FOUND: tests/integration/phase59-unified-route.test.ts
- FOUND: tests/lib/tasteTags.test.ts
- FOUND: tests/data/comments.test.ts
- FOUND: tests/data/searchCatalogWatches.test.ts
- FOUND: tests/data/getFollowedOwnersForCatalog.test.ts
- FOUND: tests/data/getCollectorsForCatalog.test.ts
- FOUND: tests/integration/phase37-rls.test.ts
- FOUND: .planning/phases/85-collection-lifecycle/85-04-SUMMARY.md
- FOUND commit: 82c22ac1 (Task 1)
- FOUND commit: ee267ecf (Task 2)
