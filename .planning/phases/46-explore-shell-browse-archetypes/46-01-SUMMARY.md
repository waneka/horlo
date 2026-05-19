---
phase: 46-explore-shell-browse-archetypes
plan: "01"
subsystem: explore-dal
tags: [explore, browse, archetypes, dal, cache, retire]
dependency_graph:
  requires: []
  provides:
    - src/lib/archetype-config.ts
    - src/data/browse.ts
  affects:
    - src/app/explore/page.tsx (will be replaced in Plan 03)
    - src/data/discovery.ts (pruned of retired functions)
tech_stack:
  added: []
  patterns:
    - "'use cache' + cacheTag + cacheLife for viewer-independent browse counts"
    - "GROUP BY count queries via db.execute(sql`...`) pattern"
    - "Static config object (ARCHETYPE_CONFIG) keyed on PrimaryArchetype union"
key_files:
  created:
    - src/lib/archetype-config.ts
    - src/lib/archetype-config.test.ts
    - src/data/browse.ts
    - src/data/__tests__/browse.test.ts
    - src/data/__tests__/catalog-facets.test.ts
    - src/components/explore/__tests__/CollectorArchetypes.test.tsx
  modified:
    - src/data/discovery.ts
    - src/components/insights/SameFamilyRail.tsx
  deleted:
    - src/components/explore/ExploreHero.tsx
    - src/components/explore/PopularCollectors.tsx
    - src/components/explore/PopularCollectorRow.tsx
    - src/components/explore/TrendingWatches.tsx
    - src/components/explore/GainingTractionWatches.tsx
    - src/app/explore/collectors/page.tsx
    - src/app/explore/watches/page.tsx
    - tests/components/explore/CollectorsSeeAll.test.tsx
    - tests/components/explore/GainingTractionWatches.test.tsx
    - tests/components/explore/PopularCollectors.test.tsx
    - tests/components/explore/TrendingWatches.test.tsx
    - tests/components/explore/WatchesSeeAll.test.tsx
decisions:
  - "DiscoveryWatchCard NOT deleted — SameFamilyRail and LineageRail import it (non-explore callers); RESEARCH.md claim was incorrect"
  - "discovery.ts retained with getCollectorsForCatalog (used by /catalog/[catalogId]/page.tsx); three Phase 18 functions deleted"
  - "Test files for retired components (5 files) deleted as Rule 3 auto-fix — they caused tsc errors after their components were deleted"
  - "ARCHETYPE_CONFIG uses UI-SPEC proposed defaults (D-16 locked-in working values); owner reviews at UAT"
metrics:
  duration: "6m 51s"
  completed_date: "2026-05-19"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 2
  files_deleted: 12
---

# Phase 46 Plan 01: Foundation — Archetype Config, Browse DAL, Phase 18 Retire Summary

Established Phase 46 foundation: 10-entry ARCHETYPE_CONFIG, four 'use cache' Browse count DAL functions, Wave 0 test scaffolds for downstream plans, and clean deletion of Phase 18 Explore surface (5 components + 2 routes + 3 DAL functions + 5 orphaned test files).

## What Was Built

### Task 1: ARCHETYPE_CONFIG (a4fd7ff)

Created `src/lib/archetype-config.ts` exporting `ArchetypeConfig` interface and `ARCHETYPE_CONFIG` — a `Record<PrimaryArchetype, ArchetypeConfig>` with 10 entries, one for every value in `PRIMARY_ARCHETYPES`. Display names and descriptions come from the UI-SPEC § Copywriting Contract (D-16 proposed defaults, owner reviews at UAT).

Wave 0 test (`archetype-config.test.ts`) covers all four behaviors: all 10 archetypes present, non-empty displayName/description, `value` field matches key, displayNames are not raw archetype values.

Result: 4/4 tests passing.

### Task 2: Browse Count DAL (dcfa97e)

Created `src/data/browse.ts` exporting four async functions:
- `getBrowseArchetypeCounts` — GROUP BY primary_archetype WHERE NOT NULL, ORDER BY count DESC
- `getBrowseEraCounts` — GROUP BY era_signal WHERE NOT NULL
- `getBrowseGenreCounts` — GROUP BY primary_archetype WHERE NOT NULL (same column, aliased as 'genre' — D-17 intentional)
- `getBrowseBrandCounts` — JOIN brands on brand_id, ORDER BY name_normalized ASC

Each function follows the established `'use cache'` + `cacheTag('explore', 'explore:browse')` + `cacheLife('hours')` + `db.execute(sql)` pattern from `getTopStyleTags` in `catalog.ts`. No new revalidation wiring needed — `cacheTag('explore')` registration means existing `revalidateTag('explore', 'max')` calls in watch mutations bust Browse caches automatically (RESEARCH § Anti-Patterns).

Wave 0 browse test scaffold (8 tests) verifies return shapes. Wave 0 catalog-facets scaffold (4 `it.skip`) is staged for Plan 02 to unskip once `searchCatalogWatches` is extended.

Result: 8/8 tests passing.

### Task 3: Phase 18 Retire + CollectorArchetypes scaffold (e0a0abc + 6dd61bb)

Deleted Phase 18 Explore-exclusive components and routes per D-01..D-03:
- Components: ExploreHero, PopularCollectors, PopularCollectorRow, TrendingWatches, GainingTractionWatches
- Routes: /explore/collectors and /explore/watches (+ directories)
- discovery.ts: removed getMostFollowedCollectors, getTrendingCatalogWatches, getGainingTractionCatalogWatches; retained getCollectorsForCatalog

Zero surviving references to /explore/collectors or /explore/watches outside test files. Only `src/app/explore/page.tsx` retains imports of deleted components — its breakage is expected and resolved in Plan 03.

Wave 0 CollectorArchetypes test scaffold created with 2 `it.skip` cases (EXPL-02 null-hide + 10-chip render) for Plan 03 to unskip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DiscoveryWatchCard not deleted — non-explore callers found**
- **Found during:** Task 3
- **Issue:** RESEARCH.md claimed DiscoveryWatchCard is "Only imported by TrendingWatches.tsx, GainingTractionWatches.tsx, and src/app/explore/watches/page.tsx." In reality, `src/components/insights/SameFamilyRail.tsx` and `src/components/insights/LineageRail.tsx` also import it.
- **Fix:** DiscoveryWatchCard.tsx was retained (not deleted). D-04 guidance applies: "only retire Explore-exclusive code." Also updated a stale comment in SameFamilyRail.tsx that referenced the deleted TrendingWatches.tsx.
- **Files modified:** src/components/insights/SameFamilyRail.tsx (comment only)
- **Files not deleted:** src/components/explore/DiscoveryWatchCard.tsx

**2. [Rule 3 - Blocking] Orphaned test files caused tsc errors after component deletion**
- **Found during:** Task 3 verification
- **Issue:** `tests/components/explore/` contained 5 test files (CollectorsSeeAll, GainingTractionWatches, PopularCollectors, TrendingWatches, WatchesSeeAll) that imported the deleted components and discovery.ts exports. TypeScript reported errors in these test files after deletion.
- **Fix:** Deleted all 5 test files — they test the retired Phase 18 surface and have no value after deletion.
- **Files deleted:** 5 files in tests/components/explore/
- **Commit:** e0a0abc

## Known Stubs

None. All new files contain working implementations:
- `archetype-config.ts`: all 10 entries filled with editorial copy
- `browse.ts`: all 4 functions issue real SQL queries via db.execute

## Threat Flags

No new trust-boundary-crossing surfaces introduced. Browse count functions are viewer-independent (global cache, no getCurrentUser() inside 'use cache' scope per T-46-01 mitigation in plan threat model). Catalog GROUP BY queries use parameterized Drizzle sql template (no string concatenation).

## Self-Check

- [x] src/lib/archetype-config.ts exists
- [x] src/lib/archetype-config.test.ts exists
- [x] src/data/browse.ts exists
- [x] src/data/__tests__/browse.test.ts exists
- [x] src/data/__tests__/catalog-facets.test.ts exists
- [x] src/components/explore/__tests__/CollectorArchetypes.test.tsx exists
- [x] Commits a4fd7ff, dcfa97e, e0a0abc, 6dd61bb exist
- [x] 12/12 tests passing (archetype-config + browse)
- [x] No dangling references to /explore/collectors or /explore/watches outside test files
- [x] ARCHETYPE_CONFIG has 10 entries (Object.keys count = 10)
- [x] browse.ts has 4 'use cache' directives and 4 cacheTag calls

## Self-Check: PASSED
