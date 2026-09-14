---
phase: 85-collection-lifecycle
plan: 03
subsystem: server-actions
tags: [server-actions, drizzle, dead-code-removal, watchflow, dal-comments]

# Dependency graph
requires:
  - phase: 85-01
    provides: "watches.previously_owned status + disposal columns on local Supabase; disposalReasonEnum mirrored in src/db/schema.ts"
provides:
  - "editWatch/addWatch Server Action status zod enum speaks previously_owned; no divestments dual-write"
  - "src/app/actions/divestments.ts deleted (recordDivestment retired, D-03)"
  - "StatusToggle/WatchCard dead island + destinations.ts/.test.ts + DAL comments off 'sold'"
affects: [85-04, 85-05, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment rewording must avoid literal grep-armor substrings (recordDivestment, actions/divestments, db.transaction, divestments, 'sold') even in prose — the plan's own verify gate greps for them"

key-files:
  created: []
  modified:
    - src/app/actions/watches.ts
    - src/app/actions/divestments.ts
    - tests/integration/phase37-rls.test.ts
    - src/components/filters/StatusToggle.tsx
    - src/components/watch/WatchCard.tsx
    - tests/static/WatchCard.sold-badge.test.tsx
    - src/lib/watchFlow/destinations.ts
    - src/lib/watchFlow/destinations.test.ts
    - src/components/watch/ConfirmStep.tsx
    - src/data/follows.ts
    - src/data/discovery.ts
    - src/data/catalog.ts

key-decisions:
  - "editWatch's owned<->previously_owned transition is now a single watchDAL.updateWatch call — no db.transaction, no divestments insert (D-03); the prior isTransitioningToSold branch and its atomic dual-write are gone entirely, not just renamed"
  - "tests/integration/phase37-rls.test.ts: removed the entire 'recordDivestment dual-write (V-10; T-37-TXN-01)' describe block plus its now-orphaned vi.mock('@/lib/auth')/vi.mock('next/cache') and TEST_USER_ID fixture — none of those were used by the retained V-02..V-09/V-14 assertions"
  - "Comments referencing the retired code path had to avoid the literal substrings the plan's own verify gate greps for (recordDivestment, actions/divestments, db.transaction, divestments) — reworded to descriptive prose ('the historical disposal-tracking table', 'an atomic transaction') rather than naming the removed symbols"
  - "src/db/schema.ts / src/lib/types.ts / src/lib/constants.ts retain the literal string 'sold' as a DisposalReason enum value (D-02) — that is correct and out of scope; this plan only targeted 'sold' as a WatchStatus"

patterns-established: []

requirements-completed: [LIFE-01]

# Metrics
duration: ~30min
completed: 2026-09-14
---

# Phase 85 Plan 03: Retire divestments dual-write + remaining status references Summary

**Deleted the divestments dual-write from `editWatch` and `src/app/actions/divestments.ts` entirely (D-03), and swept every remaining non-test application-source `'sold'` status literal (dead StatusToggle/WatchCard island, `watchFlow/destinations`, DAL allowlist/badge comments) off to `previously_owned`.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (both auto)
- **Files modified:** 12 (2 modified + 1 deleted in Task 1; 9 modified in Task 2)

## Accomplishments

- `src/app/actions/watches.ts`: extended the Server Action zod status enum to `['owned', 'wishlist', 'grail', 'previously_owned']`; deleted the entire `isTransitioningToSold` branch (the `db.transaction` + divestments INSERT dual-write) — `editWatch`'s status-changing write is now a single `watchDAL.updateWatch(user.id, watchId, updatePayload)` call, identical in shape to every other edit. Removed the now-unused `divestments`/`watches` schema imports and `db`/`eq`/`and` drizzle-orm imports (nothing else in the file used them). Reworded the Phase 27/37/70/DISP-02 comments that referenced the retired sold/divestments language.
- Deleted `src/app/actions/divestments.ts` (`recordDivestment` retired, D-03). Confirmed via grep that no other source or test file imports it besides the test file updated in this same task.
- `tests/integration/phase37-rls.test.ts`: removed the `recordDivestment dual-write (V-10; T-37-TXN-01)` describe block and its now-orphaned `vi.mock('@/lib/auth')`, `vi.mock('next/cache')`, and `TEST_USER_ID` fixture (all three were used exclusively by that block). The `divestments` table-shape/RLS/FK assertions (V-02..V-09, V-14) are untouched and still pass their local-DB-gated `describe.skip` guard.
- Dead-island cleanup (type-compile only, zero UAT surface): `StatusToggle.tsx`'s option list and `WatchCard.tsx`'s badge-variant ternary now use `previously_owned`; `tests/static/WatchCard.sold-badge.test.tsx`'s assertion string updated to match the new ternary literal (file path/describe title left alone, matching the plan's explicit instruction).
- `src/lib/watchFlow/destinations.ts` had no runtime `'sold'` comparison to change (the status→tab mapping is `wishlist/grail → wishlist, everything else → collection`) — only its docblock needed updating; `destinations.test.ts`'s "owned / sold" case now asserts `previously_owned` routes to `/u/{username}/collection` identically to `owned`.
- Comment-only updates (no logic changes, per plan) in `ConfirmStep.tsx`, `follows.ts`, `discovery.ts`, `catalog.ts` — every prose reference to the excluded/non-badged `'sold'` status now reads `'previously_owned'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retire the divestments dual-write (D-03)** - `d27810c2` (feat)
2. **Task 2: Update remaining application-source status references (dead island, destinations, comments)** - `0977e2df` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/app/actions/watches.ts` - zod enum extension; `isTransitioningToSold`/`db.transaction`/divestments-insert branch deleted; unused imports removed; comments reworded
- `src/app/actions/divestments.ts` - deleted (`recordDivestment` retired)
- `tests/integration/phase37-rls.test.ts` - V-10 describe block + its exclusive mocks/fixtures removed; V-02..V-09/V-14 retained
- `src/components/filters/StatusToggle.tsx` - dead-island option list: `previously_owned` replaces `sold`
- `src/components/watch/WatchCard.tsx` - dead-island badge ternary: `previously_owned` replaces `sold`
- `tests/static/WatchCard.sold-badge.test.tsx` - assertion string updated to the new ternary literal
- `src/lib/watchFlow/destinations.ts` - docblock updated (no runtime change needed)
- `src/lib/watchFlow/destinations.test.ts` - "owned / sold" test case now uses `previously_owned`
- `src/components/watch/ConfirmStep.tsx` - 2 comment updates (excluded-status docblock + prop docblock)
- `src/data/follows.ts` - 1 comment update (chip-count exclusion rationale)
- `src/data/discovery.ts` - 3 comment updates (exclusion rationale ×1, inline `inArray` comment ×2)
- `src/data/catalog.ts` - 5 comment updates (badge-logic allowlist rationale)

## Decisions Made

None beyond what the plan already specified. One mechanical discovery: the plan's own verify-gate grep (`grep -rn "recordDivestment\|actions/divestments\|isTransitioningToSold"`) and the acceptance criterion `grep -c "divestments" src/app/actions/watches.ts` returns 0 meant my first pass at explanatory comments (which named the retired symbols/table in prose, e.g. "the divestments dual-write ... db.transaction") tripped the same gate meant to prove they're gone. Reworded to descriptive-but-non-literal phrasing ("the historical disposal-tracking table", "an atomic transaction") — functionally identical documentation, gate-safe.

## Deviations from Plan

None — plan executed exactly as written. The comment-wording iteration above was resolved within Task 1's own verify loop before considering the task done, not a deviation from the plan's action steps.

## Issues Encountered

The Edit tool's exact-string matching failed on 2 multi-line comment replacements in `src/data/follows.ts`/`src/data/discovery.ts` containing an em-dash (`—`) mid-line — the tool reported "no match" despite the visible text looking identical. Root cause was never fully isolated (od -c showed the em-dash as expected 3-byte UTF-8); worked around by using a small Python script to locate the exact line by index and do a targeted substring replace, which succeeded immediately. No content risk — the replacement was verified afterward with a direct grep showing zero remaining `'sold'` status literals in either file.

## User Setup Required

None - no external service configuration required.

## Verification

- Task 1 grep gate: `test ! -f src/app/actions/divestments.ts && ! grep -rn "recordDivestment\|actions/divestments\|isTransitioningToSold" src tests && ! grep -n "db.transaction" src/app/actions/watches.ts && test "$(grep -c "divestments" src/app/actions/watches.ts)" = "0" && grep -q "V-04" ... && grep -q "V-09" ...` — PASSED.
- Task 1 acceptance criteria: `grep -c "z.enum(['owned', 'wishlist', 'grail', 'previously_owned'])"` = 1; `grep -c "'sold'"` in `watches.ts` = 0; `tests/integration/phase37-rls.test.ts` still contains `V-04`/`V-09`, no `describe('recordDivestment` — all confirmed.
- Task 2 targeted vitest: `npx vitest run src/lib/watchFlow/destinations.test.ts tests/static/WatchCard.sold-badge.test.tsx` — 17/17 passed. Task 2's grep gate (quoted `'sold'`/`"sold"` literals outside disposal-mentioning lines across the 9 files) = 0 matches — PASSED.
- `npx tsc --noEmit` and `npx eslint` on all files touched in both tasks: zero errors/warnings.
- `npm run build` intentionally NOT run as this plan's gate (per the plan's explicit scope boundary) — 85-04 owns the build-green gate.
- Ran the full targeted test files for `src/app/actions/watches.ts` (`tests/actions/watches.test.ts`, `tests/actions/watches.notesPublic.test.ts`, `src/app/actions/__tests__/watches-recs-invalidation.test.ts`). The last passes 8/8. The first two fail 9 total tests, all with the identical root cause `No "updateTag" export is defined on the "next/cache" mock` — a stale mock gap that predates this plan (Phase 75 added `updateTag` calls; these two test files' `vi.mock('next/cache', ...)` only stub `revalidatePath`/`revalidateTag`). Confirmed pre-existing via `.planning/STATE.md`'s Phase 84 P06 metric line, which already lists `watches.test` and `watches.notesPublic` as "pre-existing full-suite noise, out of scope per SCOPE BOUNDARY" — unrelated to this plan's divestments-retirement changes. Not fixed (out of scope per SCOPE BOUNDARY; logged here for traceability, not to `deferred-items.md` since it's already tracked in STATE.md history).

## Next Phase Readiness

- The divestments dual-write no longer exists anywhere in the codebase; `src/app/actions/divestments.ts` is gone. `editWatch`'s status-changing write path is uniform (single `updateWatch` call) regardless of destination status.
- Every non-test application-source file this plan targeted (dead island, `watchFlow/destinations`, DAL comments) is free of the `'sold'`-as-status literal.
- **Expected and intentional, per this plan's scope boundary:** `src/db/schema.ts`, `src/lib/types.ts`, and `src/lib/constants.ts` still contain the literal `'sold'` — correctly, as a `DisposalReason` enum value (D-02), not a `WatchStatus`. Do not treat this as a regression.
- **Remaining for 85-04:** 6 test fixture files still use `'sold'` as a `WatchStatus` literal (`src/app/actions/__tests__/moveWishlistToCollection.test.ts`, `src/app/actions/__tests__/watches-recs-invalidation.test.ts`, `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx`, `src/components/watch/AddWatchFlow.test.tsx`, `src/components/watch/ConfirmStep.test.tsx`, `src/data/__tests__/reactions-comments-gate.test.ts`) — these were deliberately not swept per this plan's explicit scope boundary ("Don't sweep test fixtures owned by 85-04"). `npm run build` is still expected to fail until 85-04's fixture sweep lands.
- 85-04 runs next and owns the `npm run build` gate.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/app/actions/watches.ts
- FOUND: tests/integration/phase37-rls.test.ts
- CONFIRMED DELETED: src/app/actions/divestments.ts
- FOUND: src/components/filters/StatusToggle.tsx
- FOUND: src/components/watch/WatchCard.tsx
- FOUND: tests/static/WatchCard.sold-badge.test.tsx
- FOUND: src/lib/watchFlow/destinations.ts
- FOUND: src/lib/watchFlow/destinations.test.ts
- FOUND: src/components/watch/ConfirmStep.tsx
- FOUND: src/data/follows.ts
- FOUND: src/data/discovery.ts
- FOUND: src/data/catalog.ts
- FOUND: .planning/phases/85-collection-lifecycle/85-03-SUMMARY.md
- FOUND commit: d27810c2 (Task 1)
- FOUND commit: 0977e2df (Task 2)
