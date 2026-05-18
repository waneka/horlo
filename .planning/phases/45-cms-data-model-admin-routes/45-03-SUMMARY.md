---
phase: 45-cms-data-model-admin-routes
plan: "03"
subsystem: cms-data-layer
tags: [cms, curated-lists, dal, server-actions, tdd, security, d03, d06, d12]
dependency_graph:
  requires: [45-01]
  provides: [curatedLists-dal, curatedLists-server-actions]
  affects: [45-05-admin-lists-ui, 47-explore-hero-rail]
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN with Vitest mock chain for Drizzle ORM"
    - "D-06: assertOwner() as first statement in all 12 CMS Server Actions"
    - "D-03: explicit WHERE status='published' in getPublishedLists (two-layer draft defense)"
    - "D-12: db.transaction wrapping integer sort_order swap for lists and items"
    - "CMS-06: zero-watch publish guard in publishCuratedList (count before set)"
    - "revalidateTag('explore:hero','max') two-argument form on publish/unpublish"
key_files:
  created:
    - src/data/curatedLists.ts
    - src/app/actions/cms/curatedLists.ts
    - src/data/__tests__/curatedLists.test.ts
    - src/app/actions/__tests__/cms-curatedLists.test.ts
  modified: []
decisions:
  - "getListItemById added to DAL to enable moveListItemUp/Down to resolve listId from itemId alone"
  - "moveList/Item Up/Down accept only the entity ID (not listId); the action performs the adjacency lookup internally"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  tests_added: 27
---

# Phase 45 Plan 03: curatedLists DAL + Server Actions Summary

**One-liner:** curatedLists DAL with two-layer draft defense + 12 owner-gated Server Actions with zero-watch publish guard and explore:hero cache revalidation.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | curatedLists DAL module + DAL test | 59b528b | src/data/curatedLists.ts, src/data/__tests__/curatedLists.test.ts |
| 2 | curatedLists Server Actions + action test | b2808f0 | src/app/actions/cms/curatedLists.ts, src/app/actions/__tests__/cms-curatedLists.test.ts |

## TDD Gate Compliance

Both tasks followed strict TDD RED/GREEN:

- **Task 1:** RED commit `d33037f` (failing DAL test) → GREEN commit `59b528b` (DAL implementation)
- **Task 2:** RED commit `2149e26` (failing action test) → GREEN commit `b2808f0` (action implementation)

## Security Invariants Verified

### D-03: Two-Layer Draft Defense
- `getPublishedLists()` contains explicit `where(eq(curatedLists.status, 'published'))` — query-level filter independent of RLS
- `getAllListsForOwner()` has NO status filter (owner reads drafts via RLS is_admin policy)
- Test: the DAL test asserts `where()` is called for published reads and NOT called for owner reads

### D-06: assertOwner in Every CMS Server Action
All 12 exported functions call `await assertOwner()` as their first statement inside a try/catch that returns `{ success: false, error: 'Not authorized' }`. Verified by grep: 12 occurrences match 12 exported functions.

### CMS-06: Zero-Watch Publish Guard
`publishCuratedList` calls `getListItemCount(listId)` before `setListStatus`. Returns `{ success: false, error: 'Cannot publish a list with no watches.' }` if count === 0. `setListStatus` is never called when count is 0 (verified by test mock assertion).

### Hero Cache Revalidation
`revalidateTag('explore:hero', 'max')` called in both `publishCuratedList` and `unpublishCuratedList`. Two-argument form confirmed correct per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`. `updateTag` is NOT used anywhere in the file (it's for read-your-own-writes; hero is global shared cache).

### T-45-10: Mass Assignment Protection
All 4 Zod schemas use `.strict()` — unknown keys rejected. createListSchema, updateListSchema, addWatchSchema, updateCommentarySchema.

## Deviations from Plan

### Auto-added: getListItemById helper (Rule 2 - missing critical functionality)

- **Found during:** Task 2 implementation of moveListItemUp/moveListItemDown
- **Issue:** The plan specified `moveListItemUp(itemId)` accepting only an `itemId`. The action needs the item's `listId` to call `getListItems(listId)` for ordering. The DAL had no way to look up an item by ID alone.
- **Fix:** Added `getListItemById(itemId)` to `src/data/curatedLists.ts` — a standard select-by-primary-key helper following the `getListById` pattern already in the module.
- **Files modified:** `src/data/curatedLists.ts` (+10 lines), `src/app/actions/__tests__/cms-curatedLists.test.ts` (added `getListItemById` to mock and test setup)
- **Impact:** No behavior change to the action signatures; the lookup is internal to the action implementation.

## Known Stubs

None — all functions are fully implemented with real DAL calls.

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond what the plan's threat model describes. All 12 Server Actions are `'use server'` exports — they are HTTP-callable POST endpoints, but all are gated by `assertOwner()`. No new public-read surfaces added (getPublishedLists is a DAL function, not an API route).

## D-10 Flag (Deferred)

Per RESEARCH.md Pitfall 7: the RESTRICT FKs from `curated_list_items.catalog_id` and `collection_path_nodes.catalog_id` onto `watches_catalog` will block future bulk catalog TRUNCATE operations (v5.2 catalog expansion). This is a known architectural tradeoff from D-08 (RESTRICT blocks on any reference, draft or published). No action required in Phase 45 — documented here per D-10 instruction.

## Self-Check: PASSED

- [x] `src/data/curatedLists.ts` exists — FOUND
- [x] `src/app/actions/cms/curatedLists.ts` exists — FOUND
- [x] `src/data/__tests__/curatedLists.test.ts` exists — FOUND
- [x] `src/app/actions/__tests__/cms-curatedLists.test.ts` exists — FOUND
- [x] Commit `d33037f` (RED DAL test) exists — FOUND
- [x] Commit `59b528b` (GREEN DAL + test) exists — FOUND
- [x] Commit `2149e26` (RED action test) exists — FOUND
- [x] Commit `b2808f0` (GREEN actions + test) exists — FOUND
- [x] 8 DAL tests pass
- [x] 19 action tests pass
- [x] No TypeScript errors in new files
