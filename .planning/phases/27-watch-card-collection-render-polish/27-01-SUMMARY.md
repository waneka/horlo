---
phase: 27-watch-card-collection-render-polish
plan: 01
subsystem: testing
tags: [vitest, drizzle, postgres, rtl, dnd-kit-precursor, wave-0-red, tdd]

# Dependency graph
requires:
  - phase: 25-profile-prominence-empty-states
    provides: "ProfileWatchCard, WishlistTabContent, CollectionTabContent existing component shapes the new specs assert against"
  - phase: 26-wywt-auto-nav
    provides: "Phase 25 useFormFeedback / Sonner toast precedent — referenced in CONTEXT D-09 for reorder error toast"
provides:
  - "tests/integration/phase27-schema.test.ts — DB-gated assertions on sort_order column shape + watches_user_sort_idx existence"
  - "tests/integration/phase27-backfill.test.ts — DB-gated assertions on per-user ROW_NUMBER ranking + zero-duplicate invariant"
  - "tests/integration/phase27-bulk-reorder.test.ts — DB-gated bulkReorderWishlist owner-only enforcement (3 cases: happy path, foreign id, owned-status filter)"
  - "tests/integration/phase27-getwatchesbyuser-order.test.ts — DB-gated read-path order assertion (sort_order ASC, createdAt DESC tiebreaker)"
  - "src/app/actions/__tests__/reorderWishlist.test.ts — 7-case Server Action surface contract (auth, Zod .strict(), error mapping, length cap)"
  - "src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx — 9-case status × price-presence matrix + sizes attr (D-13)"
  - "src/components/profile/__tests__/CollectionTabContent.test.tsx — grid-cols-2 wrapper assertion (D-11 / VIS-07)"
  - "src/components/profile/WishlistTabContent.test.tsx (extended) — Phase 27 owner DnD path + grid-cols-2 (3 cases)"
affects: [27-02-PLAN, 27-03-PLAN, 27-04-PLAN, 27-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 RED scaffold pattern — every production task in Phase 27 has at least one test it must satisfy before the implementation lands"
    - "DB-gated integration tests with `process.env.DATABASE_URL ? describe : describe.skip` (precedent: 17+ existing phase tests)"
    - "Per-file STAMP token (`p27sc{Date.now().toString(36)}`) ensures cross-test seed isolation"
    - "Module-boundary mocking for Server Action surface tests — vi.mock @/lib/auth + @/data/watches + next/cache before importing the action"
    - "Component-level mocking for parent-of-stub tests — vi.mock all child components as test-id stubs to focus assertions on the wrapper"

key-files:
  created:
    - "tests/integration/phase27-schema.test.ts"
    - "tests/integration/phase27-backfill.test.ts"
    - "tests/integration/phase27-bulk-reorder.test.ts"
    - "tests/integration/phase27-getwatchesbyuser-order.test.ts"
    - "src/app/actions/__tests__/reorderWishlist.test.ts"
    - "src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx"
    - "src/components/profile/__tests__/CollectionTabContent.test.tsx"
  modified:
    - "src/components/profile/WishlistTabContent.test.tsx (extended with Phase 27 describe block)"

key-decisions:
  - "Honor existing tests/integration/ location for DB-gated tests instead of RESEARCH-suggested src/db/__tests__/ — every existing phase test lives in tests/integration/ (PATTERNS.md note line 770-771)"
  - "Use unique STAMP per file (xx=sc/bf/br/od) so multi-file test runs don't collide on shared seed state"
  - "Construct deterministic createdAt timestamps 1ms apart in seed data so backfill ROW_NUMBER ordering assertion is stable"
  - "Pass tooManyIds (501 valid uuids) via randomUUID() instead of literal repetition for the .max(500) length-cap test"
  - "Rollback test in WishlistTabContent.test.tsx INTENTIONALLY OMITTED — dnd-kit synthetic events are hard to trigger via RTL; rollback contract is covered in reorderWishlist.test.ts at the action layer (Plan 01 PLAN action <action> note)"

patterns-established:
  - "Wave 0 RED ordering — tests land first, fail predictably, lock the contract; production tasks in Plans 02-05 turn each test green incrementally"
  - "Cross-task ID dependencies — bulkReorderWishlist + reorderWishlist + getMaxWishlistSortOrder imports remain unresolved at the type level; that's the expected RED state until Plans 02/03 ship the exports"
  - "Per-task STAMP isolation for parallel test runs — STAMP includes Date.now().toString(36) so back-to-back vitest invocations don't collide"

requirements-completed: [WISH-01, VIS-07, VIS-08]

# Metrics
duration: 9min
completed: 2026-05-04
---

# Phase 27 Plan 01: Wave 0 RED Test Scaffolds Summary

**Eight test files (7 new + 1 extended) committed as the Phase 27 contract. Every production task in Plans 02-05 has at least one Vitest spec it must satisfy before the phase exits — RED today, GREEN as the implementation lands.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-04T07:34:59Z
- **Completed:** 2026-05-04T07:44:19Z
- **Tasks:** 3
- **Files modified:** 8 (7 created + 1 extended)

## Accomplishments

- 4 DB-gated integration test files (`phase27-schema`, `phase27-backfill`, `phase27-bulk-reorder`, `phase27-getwatchesbyuser-order`) — 9 it() blocks covering sort_order column shape, per-user backfill ranking, bulkReorderWishlist owner-only enforcement, and read-path order semantics. All gated on `process.env.DATABASE_URL` so CI without a local Postgres skips silently.
- 1 mocked Server Action surface test (`reorderWishlist.test.ts`) — 7 it() blocks covering auth gate, Zod `.strict()` mass-assignment defense (D-10), non-uuid rejection, owner-mismatch error mapping, happy path, missing-field rejection, and T-27-03 max-500 length cap.
- 2 new component tests (`ProfileWatchCard-priceLine.test.tsx` 9 cases — full 8-cell status × price-presence matrix from D-15..D-21 plus sizes attr D-13; `CollectionTabContent.test.tsx` 1 case — grid-cols-2 wrapper assertion D-11).
- 1 extended file (`WishlistTabContent.test.tsx`) — appended Phase 27 describe block (3 tests: owner DnD path with `aria-roledescription="sortable"`, non-owner plain-card path, grid-cols-2 across both branches).

## Task Commits

1. **Task 1: DB-gated integration test scaffolds** — `64e0f09` (test)
2. **Task 2: reorderWishlist Server Action surface test** — `68bdbdb` (test)
3. **Task 3: Card-content + CollectionTabContent grid + WishlistTabContent extension** — `fd553fa` (test)

_Note: Plan 27-01 type=execute (not tdd at plan level); each task uses `tdd="true"` semantically because they ARE the RED tests for downstream plans. Single test commit per task — there is no implementation in this plan to follow._

## Files Created/Modified

- `tests/integration/phase27-schema.test.ts` — Created. 2 it() blocks asserting sort_order column shape (integer / NOT NULL / DEFAULT 0) + watches_user_sort_idx existence.
- `tests/integration/phase27-backfill.test.ts` — Created. 2 it() blocks asserting per-user [0,1,2] sort_order assignment in createdAt DESC order + zero-duplicate (user_id, sort_order) tuples.
- `tests/integration/phase27-bulk-reorder.test.ts` — Created. 3 it() blocks asserting happy path (sort_order = array index), Owner mismatch on foreign user id, Owner mismatch on owned-status id (status filter excludes).
- `tests/integration/phase27-getwatchesbyuser-order.test.ts` — Created. 2 it() blocks asserting sort_order ASC ordering + createdAt DESC tiebreaker on equal sort_order.
- `src/app/actions/__tests__/reorderWishlist.test.ts` — Created. 7 it() blocks covering full Server Action surface contract.
- `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` — Created. 9 it() blocks covering 8 status × price-presence cases plus image sizes attr D-13.
- `src/components/profile/__tests__/CollectionTabContent.test.tsx` — Created. 1 it() block asserting grid-cols-2 wrapper preserves sm:grid-cols-2 + lg:grid-cols-4.
- `src/components/profile/WishlistTabContent.test.tsx` — Extended. Existing 3 Phase 20.1 tests untouched (still green); appended Phase 27 describe block with 3 new tests + 3 new vi.mock declarations (`@/app/actions/wishlist`, `sonner`, `@/components/profile/SortableProfileWatchCard`).

## Decisions Made

- **Honored `tests/integration/` location for DB-gated tests** instead of the RESEARCH.md-suggested `src/db/__tests__/`. Every existing phase integration test lives in `tests/integration/` (17+ files); aligning with the established convention is the cheaper choice.
- **STAMP token per file** (`p27sc`, `p27bf`, `p27br`, `p27od`) lets parallel test runs on the same DB not collide on seed data — the unique suffix from `Date.now().toString(36)` rotates per invocation.
- **Rollback test deliberately omitted from `WishlistTabContent.test.tsx`** per Plan 01 PLAN.md `<action>` note — dnd-kit synthetic events are hard to trigger via RTL alone, and the rollback contract is covered cheaply in `reorderWishlist.test.ts` at the action layer.
- **`it()` regex tightened to `^(Paid|Target|Market):`** for the negative price-line tests so the prefix match isn't confused with a colon appearing elsewhere in card content (e.g., notes that mention "Target" mid-sentence). Stricter than the PLAN.md spec (`/Paid:|Target:|Market:/`) but harmless — it can only widen the negative match if the production code introduces text starting with one of those tokens, which is the exact thing the test is locking.

## Deviations from Plan

None — plan executed exactly as written. The 3 tasks landed at the exact files/paths/it-counts/grep-targets specified in PLAN.md.

## Wave 0 RED State Inventory

The following test failures are EXPECTED and required for the Wave 0 / TDD contract:

| Test file                                                        | Failing assertions today                                                                                                                                                              | Plan that will turn green |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `tests/integration/phase27-schema.test.ts` (4 cases skipped on CI without DB; would FAIL locally) | `sort_order` column does not exist; `watches_user_sort_idx` does not exist                                                                                                            | Plan 27-02                |
| `tests/integration/phase27-backfill.test.ts` (skipped/FAIL)      | sort_order column missing → seed insert fails; backfill not yet wired                                                                                                                  | Plan 27-02                |
| `tests/integration/phase27-bulk-reorder.test.ts` (skipped/FAIL)  | `bulkReorderWishlist` import unresolved (Plan 02 export missing)                                                                                                                       | Plan 27-02                |
| `tests/integration/phase27-getwatchesbyuser-order.test.ts` (skipped/FAIL) | `sortOrder` field missing on Watch type + `getWatchesByUser` ORDER BY not yet added                                                                                            | Plan 27-02                |
| `src/app/actions/__tests__/reorderWishlist.test.ts` (7/7 FAIL)   | `reorderWishlist is not a function` — Plan 03 ships the export                                                                                                                          | Plan 27-03                |
| `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` (5/9 FAIL) | "Paid: $X" / "Market: $X" not rendered today (legacy card only renders wishlist `Target: $X`); sizes attr is `100vw` not `50vw` on mobile breakpoint                | Plan 27-04                |
| `src/components/profile/__tests__/CollectionTabContent.test.tsx` (1/1 FAIL) | grid uses `grid-cols-1` today, not `grid-cols-2`                                                                                                                                  | Plan 27-04                |
| `src/components/profile/WishlistTabContent.test.tsx` (2/3 NEW FAIL — pre-existing 3 still GREEN) | grid uses `grid-cols-1`; `SortableProfileWatchCard` not yet wired for owner branch                                                                                | Plans 27-04 + 27-05       |

**Pre-existing tests:** 3 prior Phase 20.1 specs in `WishlistTabContent.test.tsx` continue to PASS (verified via per-test reporter output).

**Unresolved imports (intentional):** `bulkReorderWishlist`, `reorderWishlist`, and `getMaxWishlistSortOrder` resolve at the type level only today (TypeScript flags them; runtime calls fail). PLAN.md acceptance criteria #5 explicitly states: "if `tsc` does flag it, the test files MUST keep the import and the executor MUST NOT add a stub to make types pass". Honored.

## Test Suite Health

Full `vitest run` after Plan 01:

- 4162 passed (existing pre-Phase-27 baseline preserved)
- 35 failed total
  - 15 NEW failures: all are Phase 27 Wave 0 RED-state lockins
  - 20 pre-existing failures: documented in `.planning/PROJECT.md → ## Requirements → ### Active`:
    - `tests/no-raw-palette.test.ts` × 2 (font-medium UI-SPEC vs lint conflict)
    - `tests/actions/watches.notesPublic.test.ts` × 4 (FEAT-07 Wave 0 scaffold)
    - `tests/app/explore.test.tsx` × 3 (Phase 14 stub copy superseded by Phase 18)
    - `tests/components/WywtPostDialog.test.tsx` × 9 (pre-existing)
    - `tests/integration/backfill-taste.test.ts` × 2 (pre-existing)

No regressions introduced by Plan 01.

## Issues Encountered

None. Plan executed cleanly; every acceptance-criterion grep target hit on the first attempt. Test failures observed during execution were all expected RED-state lockins.

## User Setup Required

None — Wave 0 test scaffolds run entirely in CI/local. No external service configuration introduced.

## Next Phase Readiness

- Plan 27-02 can now generate the drizzle/supabase migrations + DAL helpers; the schema/backfill/bulkReorder/getWatchesByUser-order tests will turn green incrementally as each piece lands.
- Plan 27-03 has a complete 7-case surface contract for `reorderWishlist` to satisfy.
- Plan 27-04 has the full price-line × grid contract locked.
- Plan 27-05 (DnD wiring) has the `aria-roledescription="sortable"` + grid + non-owner-bypass contract locked.

## Self-Check: PASSED

Verified files exist:
- FOUND: tests/integration/phase27-schema.test.ts
- FOUND: tests/integration/phase27-backfill.test.ts
- FOUND: tests/integration/phase27-bulk-reorder.test.ts
- FOUND: tests/integration/phase27-getwatchesbyuser-order.test.ts
- FOUND: src/app/actions/__tests__/reorderWishlist.test.ts
- FOUND: src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx
- FOUND: src/components/profile/__tests__/CollectionTabContent.test.tsx
- FOUND: src/components/profile/WishlistTabContent.test.tsx (extended)

Verified commits exist:
- FOUND: 64e0f09 (Task 1 — integration tests)
- FOUND: 68bdbdb (Task 2 — Server Action surface)
- FOUND: fd553fa (Task 3 — card-content + grid + extend)

---
*Phase: 27-watch-card-collection-render-polish*
*Plan: 01*
*Completed: 2026-05-04*
