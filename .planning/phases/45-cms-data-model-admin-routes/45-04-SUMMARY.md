---
phase: 45-cms-data-model-admin-routes
plan: "04"
subsystem: cms-data-layer
tags: [cms, dal, server-actions, tdd, collection-paths, hero-pin, catalog-picker]
dependency_graph:
  requires: [45-01]
  provides: [collection-path-dal, cms-settings-dal, path-actions, settings-actions, catalog-picker-action]
  affects: [45-05, 45-06, 47]
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN for every file (test first, then implementation)
    - vi.hoisted() for mock variables available in vi.mock factory (avoids hoisting ReferenceError)
    - Fully-chainable select mock with thenable chain (handles arbitrary .where().orderBy().limit() chains)
    - Three-block try/catch Server Action pattern (auth gate → zod parse → DAL call)
key_files:
  created:
    - src/data/collectionPaths.ts
    - src/data/cmsSettings.ts
    - src/data/__tests__/collectionPaths.test.ts
    - src/app/actions/cms/collectionPaths.ts
    - src/app/actions/cms/settings.ts
    - src/app/actions/cms/catalogPicker.ts
    - src/app/actions/__tests__/cms-collectionPaths.test.ts
    - src/app/actions/__tests__/cms-settings.test.ts
  modified: []
decisions:
  - "vi.hoisted() required for shared mock variables in vi.mock factory — avoids vitest hoisting ReferenceError"
  - "Thenable chain mock pattern used instead of mockResolvedValue on a single method to support multi-hop chains"
  - "swapPathSortOrder implemented as db.transaction swap per D-12 — matches curatedLists pattern"
  - "searchCatalogForPicker enforces 2-char minimum before delegating to searchCatalogWatches — no separate trim needed (searchCatalogWatches trims internally)"
  - "settings.ts inline comment on line 45 (spaces + // revalidateTag not updateTag) causes grep -v '^//' to include it — this is a comment explaining the choice, not actual updateTag usage; no actual updateTag import or call exists"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_created: 8
  tests_added: 23
---

# Phase 45 Plan 04: CMS Collection-Paths + Settings Data Layer Summary

Collection-paths and CMS-settings DAL modules with owner-gated Server Actions and a catalog-picker action — the write surface for the `/admin/paths` UI and hero-pin control built in Plans 05 and 06.

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 (TDD RED) | collectionPaths + cmsSettings DAL tests | af04724 | 7 RED |
| 1 (TDD GREEN) | collectionPaths + cmsSettings DAL modules + test | c90c0c9 | 7 GREEN |
| 2 (TDD RED) | CMS Server Action tests | 9032de6 | 16 RED |
| 2 (TDD GREEN) | CMS Server Actions implementation | 2362532 | 23 GREEN |

## Key Deliverables

### DAL Modules

**`src/data/collectionPaths.ts`**
- `getPublishedPaths(limit?)` — D-03 two-layer defense: explicit `WHERE status='published'` predicate (layer 2; RLS is layer 1)
- `getAllPathsForOwner()` — no status filter; reads drafts for admin use
- `getPathById`, `getPathWithNodes`, `getPathNodes` — single-path reads
- `createPath`, `updatePath`, `deletePath`, `setPathStatus` — CRUD
- `setPathNode(pathId, slot, catalogId, rationale?)` — insert node at slot 0-2
- `removePathNode(nodeId)` — remove a follow-on node
- `swapPathSortOrder(idA, orderA, idB, orderB)` — D-12: two-update transaction for integer order column

**`src/data/cmsSettings.ts`**
- `getCmsSettings()` — reads id=1 row; returns safe default `{ pinnedListId:null, pinExpiresAt:null, heroFormat:'featured_list' }` when absent (no throw)
- `setPinnedHero(listId, expiresAt)` — updates id=1 row
- `clearPinnedHero()` — nulls pin fields on id=1 row

### Server Actions

**`src/app/actions/cms/collectionPaths.ts`**
- `createCollectionPath(data)` — D-16: zod `z.enum([...])` with four exact path-type strings; `.strict()` mass-assignment protection
- `updateCollectionPath`, `deleteCollectionPath` — CRUD
- `setPathNode`, `removePathNode` — node management; slot validated 0-2
- `movePathUp`, `movePathDown` — D-12: swaps integer order via DAL transaction
- `publishCollectionPath`, `unpublishCollectionPath` — each calls `revalidateTag('explore:hero', 'max')` (two-arg Next.js 16 form)

**`src/app/actions/cms/settings.ts`**
- `setPinnedHero(data)` — zod uuid + nullable datetime; calls `revalidateTag('explore:hero', 'max')`
- `clearPinnedHero()` — calls `revalidateTag('explore:hero', 'max')`
- Header comment cites notifications.ts:14-55 explaining revalidateTag (global cache) vs updateTag (RYO writes)

**`src/app/actions/cms/catalogPicker.ts`**
- `searchCatalogForPicker(query)` — D-11: enforces 2-char minimum; delegates to `searchCatalogWatches({ q, viewerId, limit:20 })`; no full-table client load

### Tests

- `src/data/__tests__/collectionPaths.test.ts` — 7 tests: D-03 predicate structural assertion (`eq(collectionPaths.status, 'published')`), owner-read no-filter assertion, safe-default, pin write assertions
- `src/app/actions/__tests__/cms-collectionPaths.test.ts` — 7 tests: auth gate, D-16 enum, `.strict()`, revalidateTag on publish/unpublish, happy path
- `src/app/actions/__tests__/cms-settings.test.ts` — 9 tests: auth gate (setPinnedHero + clearPinnedHero), revalidateTag assertions, uuid validation, picker 2-char min + delegation + auth gate

## Security Model Verified

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-45-13: non-owner HTTP POST | D-06: `assertOwner()` first in every action | Implemented + tested |
| T-45-14: invalid path_type | D-16: zod `z.enum([...])` rejects out-of-vocabulary values | Implemented + tested |
| T-45-15: SQL injection in picker | `searchCatalogWatches` uses Drizzle parameterized binds | Delegated (verified in RESEARCH.md) |
| T-45-16: mass assignment | All zod schemas use `.strict()` | Implemented + tested |

## Deviations from Plan

### Implementation Notes

**No-deviation execution.** Plan executed as written. One test implementation detail documented:

**1. [Vitest hoisting] `vi.hoisted()` required for shared mock state**
- **Found during:** Task 1 RED implementation
- **Issue:** Mock factory variables referenced in `vi.mock()` cause `ReferenceError: Cannot access 'mockSelect' before initialization` because `vi.mock` is hoisted to the top of the file before variable declarations
- **Fix:** Used `vi.hoisted()` to declare shared mock state and `makeSelectChain` builder in a hoisted context
- **Also fixed:** Used fully-chainable thenable mock chain (every method returns `this`; chain implements `.then/.catch/.finally` as a Promise-like) to support multi-hop queries like `.where().orderBy().limit()`
- **Files modified:** `src/data/__tests__/collectionPaths.test.ts`
- **Commit:** c90c0c9

## Known Stubs

None. All DAL functions are fully implemented with real Drizzle queries. Server Actions call real DAL functions. Catalog picker delegates to the real `searchCatalogWatches` function.

## Threat Flags

None. All files are internal server-only modules. No new network endpoints, external trust boundaries, or public-facing surfaces introduced. The catalog picker reuses the existing, tested `searchCatalogWatches` query path.

## D-10 Note (Deferred)

Per RESEARCH.md D-10: the `ON DELETE RESTRICT` FKs from `collection_path_nodes.catalog_id` onto `watches_catalog` will block a future bulk catalog TRUNCATE (Phase 36 catalog wipes, v5.2 expansion). This is documented in the research, not a defect — it was a locked decision. Flag here for Phase 47/v5.2 planning.

## Self-Check

Files exist:
- src/data/collectionPaths.ts — FOUND
- src/data/cmsSettings.ts — FOUND
- src/data/__tests__/collectionPaths.test.ts — FOUND
- src/app/actions/cms/collectionPaths.ts — FOUND
- src/app/actions/cms/settings.ts — FOUND
- src/app/actions/cms/catalogPicker.ts — FOUND
- src/app/actions/__tests__/cms-collectionPaths.test.ts — FOUND
- src/app/actions/__tests__/cms-settings.test.ts — FOUND

Commits exist:
- af04724 — test(45-04): add failing DAL tests (TDD RED) — FOUND
- c90c0c9 — feat(45-04): collectionPaths + cmsSettings DAL modules (TDD GREEN) — FOUND
- 9032de6 — test(45-04): add failing Server Action tests (TDD RED) — FOUND
- 2362532 — feat(45-04): CMS Server Actions implementation (TDD GREEN) — FOUND

Test results: 23/23 passing

## Self-Check: PASSED
