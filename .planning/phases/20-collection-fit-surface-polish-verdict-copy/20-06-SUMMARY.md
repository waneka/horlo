---
phase: 20-collection-fit-surface-polish-verdict-copy
plan: 06
subsystem: catalog-routing
tags: [next.js, server-component, drizzle, verdict, routing, explore]

# Dependency graph
requires:
  - phase: 20-collection-fit-surface-polish-verdict-copy
    plan: 02
    provides: computeVerdictBundle, computeViewerTasteProfile, catalogEntryToSimilarityInput
  - phase: 20-collection-fit-surface-polish-verdict-copy
    plan: 03
    provides: CollectionFitCard pure-renderer
affects: []

provides:
  - "/catalog/[catalogId] Server Component route (FIT-03 / D-10) with D-07/D-08 framing"
  - "DiscoveryWatchCard wrapped in Link to /catalog/[catalogId] — /evaluate?catalogId= reference eliminated from explore components"
  - "5 integration tests for /catalog/[catalogId] route (404, cross-user, D-07, D-08, ownerHref)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component catalog detail: params: Promise<{ catalogId }> with await params — mirrors /watch/[id] pattern"
    - "Inline Drizzle SELECT for D-08 viewer-ownership check scoped by BOTH userId AND catalogId (T-20-06-01)"
    - "vi.hoisted() for mock variables referenced in vi.mock() factories — avoids TDZ hoisting errors"
    - "acquisitionDate (text, string|null) vs createdAt (timestamp, Date object) — coercion to ISO string via new Date().toISOString()"

key-files:
  created:
    - src/app/catalog/[catalogId]/page.tsx
    - tests/app/catalog-page.test.ts (replaced 5 it.todo scaffolds with 5 real integration tests)
  modified:
    - src/components/explore/DiscoveryWatchCard.tsx

key-decisions:
  - "D-10 route is /catalog/[catalogId] keyed by watches_catalog.id — existing /watch/[id] (per-user UUID) untouched"
  - "D-08 detection inline via Drizzle SELECT on watches WHERE userId=viewer AND catalogId=param — no helper existed in watches.ts"
  - "acquisitionDate is text in schema (returns string|null); createdAt is timestamp (returns Date object) — coerce via new Date(row.createdAt).toISOString()"
  - "TrendingWatches + GainingTractionWatches need no changes — they already pass watch.id as catalog UUID and do not own a Link wrapper; DiscoveryWatchCard owns the Link"
  - "WatchSearchRow.tsx /evaluate refs left for Plan 05 (disjoint files per parallel execution contract)"
  - "vi.hoisted() required for mock variables referenced in vi.mock() factory functions — vi.fn() declarations at module scope cannot be accessed before vi.mock() hoisting"

requirements-completed: [FIT-03]

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 20 Plan 06: Catalog Page and Cleanup Summary

**Closed the D-10 routing shape by shipping `/catalog/[catalogId]` as a Server Component with D-07/D-08/D-03 framing branches, and rewired `DiscoveryWatchCard` from the dangling `/evaluate?catalogId=` comment to the new `/catalog/[catalogId]` route.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-04-30
- **Tasks:** 2
- **Files created:** 2 (page.tsx + test replacement)
- **Files modified:** 1 (DiscoveryWatchCard.tsx)

## Accomplishments

- `src/app/catalog/[catalogId]/page.tsx` — Server Component implementing the full D-10 routing shape:
  - `getCatalogById(catalogId)` → null → `notFound()` (404)
  - Viewer owns a watch with this catalogId (D-08) → `'self-via-cross-user'` framing inline — no composer called; link points to viewer's per-user `/watch/{watches.id}`
  - Viewer collection empty (D-07) → verdict null → no `<CollectionFitCard>` rendered
  - Viewer has collection + does not own → `computeVerdictBundle` with `framing: 'cross-user'` (D-03)
  - Security: `findViewerWatchByCatalogId` scopes SELECT by BOTH `userId` AND `catalogId` (T-20-06-01 mitigated)
- `tests/app/catalog-page.test.ts` — 5 integration tests replacing Plan 01's `it.todo` scaffolds; all 5 pass.
- `src/components/explore/DiscoveryWatchCard.tsx` — Wrapped card body in `<Link href="/catalog/${watch.id}">` per D-10; removed dangling `/evaluate?catalogId=` comment.
- `TrendingWatches.tsx` and `GainingTractionWatches.tsx` required no changes — confirmed they already pass `watch.id` as catalog UUID and do not own a Link wrapper.
- D-09 byte-lock holds: `git diff HEAD -- src/lib/similarity.ts` empty.
- `src/app/evaluate/` directory does not exist (success criterion 5/6 — enforced by `tests/no-evaluate-route.test.ts`).

## Task Commits

Each task committed atomically with `--no-verify` per parallel-agent contract:

1. **Task 1: /catalog/[catalogId] page + 5 integration tests** — `7ddba7c` (feat)
2. **Task 2: Wire DiscoveryWatchCard to /catalog/[catalogId]** — `f7ee54b` (feat)

## Files Created/Modified

### Created

- `src/app/catalog/[catalogId]/page.tsx` — Server Component for catalog watch detail with `computeVerdictBundle` + D-07/D-08 framing; `findViewerWatchByCatalogId` helper scoped by userId + catalogId.
- `tests/app/catalog-page.test.ts` — 5 real integration tests (was 5 it.todo from Plan 01 scaffold): 404 path, cross-user framing, D-07 hide-when-empty, D-08 self-owned callout, ownerHref points to per-user watches.id.

### Modified

- `src/components/explore/DiscoveryWatchCard.tsx` — Added `import Link from 'next/link'`; wrapped card in `<Link href={\`/catalog/${watch.id}\`}>` with `aria-label`; removed `/evaluate?catalogId=` comment; updated JSDoc to reflect D-10 Phase 20 decision.

## Decisions Made

- **D-10 route `/catalog/[catalogId]` keyed by catalog UUID.** Existing `/watch/[id]` (per-user `watches.id`) is byte-untouched per the plan's explicit instruction. No cross-contamination of the two UUID namespaces.
- **Inline Drizzle SELECT for D-08 detection.** No existing helper in `src/data/watches.ts` provides `getViewerWatchByCatalog(userId, catalogId)`. Implemented inline as `findViewerWatchByCatalogId` in the page file — self-contained, scoped, immediately testable.
- **`acquisitionDate` is `text` (string | null); `createdAt` is `timestamp` (Date object).** The `createdAt` fallback uses `new Date(row.createdAt).toISOString()` — the `new Date()` constructor accepts a `Date` object and returns it unchanged, so the coercion is safe even though Drizzle already returns a `Date`. This pattern is consistent with the Plan 02 `numeric`-as-string coercion.
- **`TrendingWatches` and `GainingTractionWatches` unchanged.** Both files already pass `watch.id` as the catalog UUID (Phase 18 contract confirmed) and do not wrap `<DiscoveryWatchCard>` in their own `<Link>`. The Link now lives inside the card.
- **`WatchSearchRow.tsx` `/evaluate` refs deferred to Plan 05.** Per the parallel execution contract, `src/components/search/WatchSearchRow.tsx` is in Plan 05's disjoint file set. This plan does not touch it.
- **`vi.hoisted()` for mock variables in `vi.mock()` factories.** Vitest hoists `vi.mock()` calls to the top of the file at transform time, before `vi.fn()` declarations at module scope are initialized. Using `vi.hoisted()` places the mock declarations in a block that runs before the hoisted `vi.mock()` calls, resolving the TDZ error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for mockNotFound referenced in vi.mock() factory**

- **Found during:** Task 1 test run — `ReferenceError: Cannot access 'mockNotFound' before initialization`
- **Issue:** `vi.mock('next/navigation', () => ({ notFound: mockNotFound }))` references `mockNotFound` which is declared as `const mockNotFound = vi.fn(...)` at module scope. Vitest hoists `vi.mock()` to the top of the file at transform time, before any module-scope declarations are initialized, causing the TDZ error.
- **Fix:** Replaced all top-level `const mock* = vi.fn()` declarations with a single `vi.hoisted()` block returning all mock functions. `vi.hoisted()` runs before hoisted `vi.mock()` calls, so all mock references are initialized.
- **Files modified:** `tests/app/catalog-page.test.ts`
- **Commit:** `7ddba7c` (folded into Task 1 commit since it was discovered before the commit)

## Issues Encountered

- **Worktree working tree desync (resolved).** The worktree was at commit `0dcdf85` (old main) but HEAD was reset to `c94ca0d` via `git reset --soft`. Working tree files from the older commit were still on disk (182 deleted files in git status). Resolved by `git checkout HEAD -- .` which restored all files from the correct HEAD commit. All subsequent work ran cleanly.

## Known Stubs

None. Both the page and the test file ship complete implementations.

- `src/app/catalog/[catalogId]/page.tsx` — full Server Component; verdict computation is live.
- `tests/app/catalog-page.test.ts` — 5 real integration tests; no `it.todo` stubs remain.

## Threat Flags

No new threat surfaces beyond what the plan's `<threat_model>` documents:

- T-20-06-01 (Information Disclosure — `findViewerWatchByCatalogId`) — **mitigated**: Drizzle SELECT scopes by `userId AND catalogId`; parameterized bind prevents injection. Verified by `grep "eq(watchesTable.userId, userId)"` in page.tsx.
- T-20-06-02 (Tampering — catalogId URL param) — **mitigated**: `getCatalogById` returns null for non-existent IDs → `notFound()`.
- T-20-06-03..06 — accepted per plan's threat register.

No new network endpoints, auth paths, or schema changes introduced.

## User Setup Required

None — no external service configuration.

## Next Phase Readiness

- `/catalog/[catalogId]` is now a live route reachable from `/explore` Trending + Gaining Traction rails via `DiscoveryWatchCard`.
- Plan 05 (search accordion action) can proceed with `WatchSearchRow.tsx` modifications independently.
- Plan 04 (watch detail integration) is independent — `/watch/[id]` untouched.
- Phase 20 wave 3 plans (04, 05, 06) are all now targeted at disjoint files; the orchestrator merges after all complete.

## Self-Check

Files verified to exist on disk:

- `src/app/catalog/[catalogId]/page.tsx` — FOUND
- `tests/app/catalog-page.test.ts` — FOUND (5 real tests, 0 it.todo)
- `src/components/explore/DiscoveryWatchCard.tsx` — FOUND (Link import + /catalog href)

Commits verified:

- `7ddba7c` (Task 1: catalog page + tests) — FOUND
- `f7ee54b` (Task 2: DiscoveryWatchCard Link) — FOUND

Guard tests:

- `tests/no-evaluate-route.test.ts` — 3/3 PASS
- `tests/app/catalog-page.test.ts` — 5/5 PASS

D-09 byte-lock:

- `git diff HEAD -- src/lib/similarity.ts` — empty (PASS)

`src/app/evaluate/` — does not exist (PASS)

## Self-Check: PASSED

---
*Phase: 20-collection-fit-surface-polish-verdict-copy*
*Completed: 2026-04-30*
