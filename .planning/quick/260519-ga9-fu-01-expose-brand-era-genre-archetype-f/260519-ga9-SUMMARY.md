---
phase: quick-260519-ga9
plan: 01
subsystem: search
tags: [search, filter-drawer, facets, explore]
requires:
  - useSearchState brand/era/genre/archetype setters (existing)
  - getBrowseBrandCounts JOIN shape (src/data/browse.ts, existing)
provides:
  - getBrowseBrandFacets() — { slug, name }[] brand vocab DAL
  - EraChips / GenreChips / ArchetypeChips / BrandChips components
  - Brand/Era/Genre/Archetype controls in the /search Filter drawer
affects:
  - src/components/search/FilterDrawer.tsx
  - src/components/search/SearchPageClient.tsx
  - src/app/search/page.tsx
tech-stack:
  added: []
  patterns:
    - MovementChips single-select chip pattern replicated for 4 new facets
    - StyleChips vocab-driven pattern replicated for BrandChips
key-files:
  created:
    - src/components/search/EraChips.tsx
    - src/components/search/GenreChips.tsx
    - src/components/search/ArchetypeChips.tsx
    - src/components/search/BrandChips.tsx
  modified:
    - src/data/browse.ts
    - src/app/search/page.tsx
    - src/components/search/FilterDrawer.tsx
    - src/components/search/SearchPageClient.tsx
    - tests/components/search/FilterDrawer.test.tsx
    - tests/components/search/SearchPageClient.test.tsx
    - tests/app/search/SearchPageClient.test.tsx
decisions:
  - "Brand control uses a server-side getBrowseBrandFacets() DAL ({ slug, name } projection of the existing brands JOIN) — no new query shape, shares the explore:browse cache scope."
  - "Era/Genre/Archetype use closed TS vocabularies (ERA_SIGNALS, PRIMARY_ARCHETYPES) — no fetch."
  - "All four chips replicate the locked MovementChips style (font-semibold selected state, no font-medium)."
metrics:
  duration: ~1h
  completed: 2026-05-19T18:51:30Z
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 7
---

# Quick Task 260519-ga9 / Plan 01: Expose Brand / Era / Genre / Archetype Filters Summary

Added Brand, Era, Genre, and Archetype chip controls to the `/search` Watches-tab Filter drawer, wired to the existing `useSearchState` setters and URL round-trip — closing the gap where those facets could only be picked from `/explore`.

## What Was Built

**Task 1 — Four facet chip-group components (commit `ae3466d`)**

Four `'use client'` chip components, each a structural copy of `MovementChips.tsx`:
- `EraChips.tsx` — single-select over `ERA_SIGNALS` (3 values), local `ERA_DISPLAY_LABELS` map.
- `GenreChips.tsx` — single-select over `PRIMARY_ARCHETYPES` (10 values), plain genre labels (`GENRE_DISPLAY_NAMES`).
- `ArchetypeChips.tsx` — single-select over `PRIMARY_ARCHETYPES`, identity copy via `ARCHETYPE_CONFIG[value].displayName`.
- `BrandChips.tsx` — vocab-driven single-select; renders `name`, passes `slug` to `onSelect`; empty-vocab safe.

All match the locked chip style: `font-semibold` selected state, no `font-medium` (project lint forbids it).

**Task 2 — Brand-facet DAL + FilterDrawer wiring (commit `9a6276d`)**

- `src/data/browse.ts` — added `getBrowseBrandFacets()`: a `{ slug, name }[]` projection of the same `brands ⋈ watches_catalog` INNER JOIN used by `getBrowseBrandCounts`, minus the count column. Same `'use cache'` + `cacheTag('explore','explore:browse')` + `cacheLife('hours')` scope, so catalog mutations bust it identically.
- `src/app/search/page.tsx` — added the brand-facet fetch into the existing `Promise.all([...])` alongside `getTopStyleTags(8)`; threads the result as a new `brandVocab` prop.
- `src/components/search/SearchPageClient.tsx` — added `brandVocab` to `SearchPageClientProps`; threads `brandVocab` plus the existing `brand/era/genre/archetype` values and `setBrand/setEra/setGenre/setArchetype` setters into the `<FilterDrawer>` mount. Inline removable facet chips untouched (still the second surface, same setters).
- `src/components/search/FilterDrawer.tsx` — extended `FilterDrawerProps` with the four facet values, four `onXChange` handlers, and `brandVocab`. Renders `<BrandChips>`, `<EraChips>`, `<GenreChips>`, `<ArchetypeChips>` after `<StyleChips>`. `handleClearAll` now also resets all four facets.

## Verification

- `npx tsc --noEmit` — **clean for all FU-01 files** (new chips, FilterDrawer, SearchPageClient, search/page.tsx, browse.ts).
- `npx eslint` on all 8 FU-01 source files — clean, no `font-medium`.
- `npx vitest run` on `FilterDrawer.test.tsx` + both `SearchPageClient.test.tsx` — **26/26 tests pass**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test fixtures broken by new required props**
- **Found during:** Task 2 verification (`npx tsc --noEmit`).
- **Issue:** Adding the new *required* props to `FilterDrawerProps` and `SearchPageClientProps` broke three test fixtures that construct those prop objects: `tests/components/search/FilterDrawer.test.tsx`, `tests/components/search/SearchPageClient.test.tsx`, and `tests/app/search/SearchPageClient.test.tsx`.
- **Fix:** Added the four chip-component mocks + the new props to `FilterDrawer.test.tsx`'s `DEFAULT_PROPS`; added `brandVocab={[]}` to all 9 render sites in `tests/components/search/SearchPageClient.test.tsx`; added `styleVocab={[]} brandVocab={[]}` to all 13 render sites in `tests/app/search/SearchPageClient.test.tsx`.
- **Note:** `tests/app/search/SearchPageClient.test.tsx` was *already failing at base `08b31f0`* (missing the `styleVocab` prop required since Phase 40). FU-01 fixed both props there as a clean, consistent unblock since the file is a `SearchPageClient` test already.
- **Files modified:** the three test files above.
- **Commit:** `9a6276d`.

## Deferred Issues

Pre-existing tsc errors in test files this task never touched (logged to `deferred-items.md`):
- `tests/data/getGainingTractionCatalogWatches.test.ts`, `getMostFollowedCollectors.test.ts`, `getTrendingCatalogWatches.test.ts` — reference DAL exports not present on `src/data/discovery`.
- `tests/integration/catalog-taste.test.ts`, `phase17-extract-route-wiring.test.ts` — `null` not assignable to non-null types.

These predate FU-01 and are out of scope.

## Recovery Note (cwd drift — #3097)

The Task 1 commit initially landed on `main` because a `cd` in a Bash call drifted the cwd from the worktree into the main repo (`/Users/tylerwaneka/Documents/horlo`). Recovered immediately: cherry-picked the commit onto the worktree branch (`worktree-agent-a5cc71c9668e8ebae`, now `ae3466d`) and hard-reset `main` back to base `08b31f0`. Verified `main` carries only the pre-existing untracked files and the worktree branch carries both FU-01 commits. All subsequent operations used absolute worktree paths with no `cd`.

## Human Verification (Task 3 — checkpoint:human-verify)

**Task 3 — APPROVED by operator (twwaneka@gmail.com) 2026-05-19.** Brand/Era/Genre/Archetype chip groups in the `/search` filter drawer confirmed in-browser — selection, URL round-trip, shared state with inline chips, and "Clear all" all working; deployed to prod (`horlo-4yc86lgns`).

Steps verified:

1. `npm run dev`, open `/search`, click the Watches tab, click "Filter".
2. Confirm the drawer shows Brand, Era, Genre, Archetype chip groups below Movement / Case Size / Style, in the same chip style.
3. Click an Era chip (e.g. "Modern") — results refilter, URL gains `&era=modern`, inline removable "Modern" chip appears above results.
4. Click a Brand chip — URL gains `&brand={slug}`, results refilter.
5. Click a Genre chip and an Archetype chip — `&genre=` / `&archetype=` params appear. (Both map to the same catalog column; if both set, archetype wins server-side — existing behavior.)
6. Remove a facet via its inline removable chip; reopen the drawer — that facet's chip is no longer selected (shared state).
7. Click "Clear all" — brand/era/genre/archetype clear along with movement/size/style; URL params drop.

## Self-Check: PASSED

- Created files verified present: EraChips.tsx, GenreChips.tsx, ArchetypeChips.tsx, BrandChips.tsx — all FOUND.
- Commits verified: `ae3466d` (Task 1), `9a6276d` (Task 2) — both FOUND on `worktree-agent-a5cc71c9668e8ebae`.
