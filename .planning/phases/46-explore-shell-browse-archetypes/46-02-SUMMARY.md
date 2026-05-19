---
phase: 46-explore-shell-browse-archetypes
plan: 02
subsystem: ui
tags: [search, facets, drizzle, zod, react, tailwind, catalog, archetypes]

# Dependency graph
requires:
  - phase: 46-01
    provides: ARCHETYPE_CONFIG lookup + browse DAL + archetype-config.ts

provides:
  - CatalogSearchFilters extended with brand/era/genre/archetype facets
  - searchCatalogWatches hasActiveFacet gate lifted for new facets (query-free run)
  - WHERE predicates for era (eraSignal eq), genre/archetype (primaryArchetype eq, archetype-wins), brand (slug→id SQL subquery)
  - searchSchema Zod fields brand(.max(100))/era/genre/archetype(.max(50)) with .optional()
  - useSearchState: 4 new facet state pairs URL-synced + passed to searchWatchesAction
  - SearchPageClient/WatchesPanel: inline removable facet chips + archetype editorial header

affects:
  - 46-03 (Collector Archetypes chips deep-link into /search?archetype=X — this plan makes those links functional)
  - 46-browse-pages (brand/era/genre index pages deep-link into /search with these facet params)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Archetype-wins precedence: filters?.archetype ?? filters?.genre resolves both genre and archetype to primaryArchetype column"
    - "Brand slug→id subquery: raw sql`${watchesCatalog.brandId} = (SELECT id FROM brands WHERE slug = ${filters.brand} LIMIT 1)` — parameterized, no JOIN required"
    - "hasActiveFacet gate: extended pattern lifts query-free run for any active facet dimension"
    - "Inline removable facet chips: bg-accent/10 border-accent chip with X icon + sr-only dismiss label — above results, not in FilterDrawer"
    - "Archetype editorial header: ARCHETYPE_CONFIG lookup gates render — unknown archetype values produce no header (T-46-04 mitigation)"

key-files:
  created:
    - src/data/__tests__/catalog-facets.test.ts (7 TDD tests for all new facet behaviors)
  modified:
    - src/data/catalog.ts (CatalogSearchFilters + hasActiveFacet + WHERE predicates)
    - src/app/actions/search.ts (searchSchema + searchWatchesAction pass-through)
    - src/components/search/useSearchState.ts (4 state pairs + URL sync + effect deps)
    - src/components/search/SearchPageClient.tsx (destructure + activeCount + WatchesPanel props + chips + header)

key-decisions:
  - "Brand filter uses raw SQL subquery (Option A) — slug→id resolution at query time, no JOIN needed, keeps existing single-table Drizzle query structure"
  - "archetype wins over genre when both are set — const primaryArchetypeFilter = filters?.archetype ?? filters?.genre"
  - "Inline chips live in WatchesPanel (not FilterDrawer) per UI-SPEC D-10 — arriving facets are above-results chips, not drawer toggles"
  - "ARCHETYPE_CONFIG lookup guards editorial header — unknown/arbitrary archetype param yields null header (T-46-04)"

patterns-established:
  - "Facet predicate extension pattern: append new if-block to predicates array before and(...predicates) guard"
  - "URL facet round-trip: useState initialized from searchParams.get() → if(val) params.set() in URL sync effect"

requirements-completed: [EXPL-03, EXPL-05]

# Metrics
duration: 8min
completed: 2026-05-19
---

# Phase 46 Plan 02: Facet Extension for /search Watches Tab Summary

**Brand/era/genre/archetype URL facets wired end-to-end through DAL → server action → hook → UI, enabling query-free browse and removable inline chip + archetype editorial header rendering on /search**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-19T02:50:00Z
- **Completed:** 2026-05-19T02:57:43Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 5

## Accomplishments

- Extended `CatalogSearchFilters` and `searchCatalogWatches` WHERE builder with brand (slug→id subquery), era (eraSignal eq), genre+archetype (primaryArchetype eq, archetype-wins precedence), and updated `hasActiveFacet` to lift the query-free gate for all four new dimensions
- Extended `searchSchema` Zod validation with `.max()` bounds and threaded all four new fields through `searchWatchesAction`
- Wired all four facets through `useSearchState` (URL-synced state, effect deps, action call) and `SearchPageClient`/`WatchesPanel` (inline removable chips with X dismiss + archetype editorial header)
- 7 new TDD tests cover archetype filter, era filter, genre→archetype column mapping, archetype-wins precedence, brand subquery, and two no-regression cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend catalog DAL + search action with brand/era/genre/archetype facets** - `f64b948` (feat)
2. **Task 2: Wire facets through useSearchState + render inline chips and archetype header** - `1d0111a` (feat)
3. **Task 3: Checkpoint:human-verify** - auto-approved (auto-mode chain)

## Files Created/Modified

- `src/data/__tests__/catalog-facets.test.ts` - 7 TDD tests for all new facet behaviors (archetype, era, genre→archetype, archetype-wins, brand subquery, no-regression x2)
- `src/data/catalog.ts` - CatalogSearchFilters extended; hasActiveFacet extended; era/archetype+genre/brand WHERE predicates added
- `src/app/actions/search.ts` - searchSchema Zod fields brand/era/genre/archetype with .max() and .optional(); searchWatchesAction pass-through
- `src/components/search/useSearchState.ts` - 4 new state pairs from URL params; URL sync extended; hasActiveFacet in Watches sub-effect extended; action call extended; effect dep array extended; UseSearchState interface + return object updated
- `src/components/search/SearchPageClient.tsx` - imports X + ARCHETYPE_CONFIG; destructures 4 new facets; activeCount extended; WatchesPanel receives new props; inline removable chip row + archetype editorial header rendered in WatchesPanel

## Decisions Made

- **Brand filter as SQL subquery (Option A):** `sql\`${watchesCatalog.brandId} = (SELECT id FROM brands WHERE slug = ${filters.brand} LIMIT 1)\`` — parameterized, no JOIN, no schema change
- **Archetype wins over genre:** `const primaryArchetypeFilter = filters?.archetype ?? filters?.genre` — both map to same column; precedence prevents double-predicate
- **Chips in WatchesPanel, not FilterDrawer:** Per UI-SPEC D-10, arriving facets are inline removable chips above results; FilterDrawer manages movement/size/style only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/search` Watches tab now handles 7 facet dimensions (movement/size/style + brand/era/genre/archetype)
- Plan 03 (Collector Archetypes chips on /explore) can deep-link to `/search?tab=watches&archetype=X` and it will work
- Brand/era/genre browse index pages (Plans 03+) can deep-link with their respective facet params

---
*Phase: 46-explore-shell-browse-archetypes*
*Completed: 2026-05-19*
