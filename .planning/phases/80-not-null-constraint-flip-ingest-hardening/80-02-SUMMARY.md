---
phase: 80-not-null-constraint-flip-ingest-hardening
plan: 02
subsystem: database
tags: [postgres, drizzle, pg_trgm, resolver, ingest, dal]

# Dependency graph
requires:
  - phase: 80-01
    provides: slugifyWithRandomSuffix helper + 10 RED unit tests at tests/unit/data/catalog-resolver.test.ts
provides:
  - resolveBrandId: 3-tier brand resolver (exact → fuzzy-clear-gap → atomic auto-create)
  - resolveFamilyId: 4-tier family resolver (exact → alias-containment → fuzzy → atomic auto-create)
  - ResolveDecision type + BrandResolution + FamilyResolution interfaces
  - 4 D-80-04 structured log event types with unified 8-key payload
affects:
  - 80-03 (wires both resolvers into upsertCatalogFromExtractedUrl + upsertCatalogFromUserInput)
  - 80-04 (schema.ts notNull flip uses same file path)
  - 80-05 (migration ships after resolver code proves)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-tier brand resolver: exact name_normalized → word_similarity clear-gap (D-80-01) → ON CONFLICT auto-create"
    - "4-tier family resolver: exact → alias @> ARRAY literal → word_similarity LIMIT 1 → ON CONFLICT auto-create"
    - "Unified D-80-04 8-key log payload: auto-create events emit score + runner_up_* as null (not omitted)"
    - "ON CONFLICT ON CONSTRAINT <name> DO UPDATE SET col = table.col RETURNING id, (xmax = 0) AS was_created — race-safe atomic upsert"
    - "slugifyWithRandomSuffix for auto-create brand slugs — eliminates 23505 slug collision retry path"

key-files:
  created:
    - src/data/catalog-resolver.ts
  modified: []

key-decisions:
  - "D-80-01 enforced in TypeScript not SQL: fuzzy clear-gap check runs client-side after LIMIT 2 query — easier to unit test"
  - "Single file commit for both tasks: both resolvers implemented in one file creation since they share module-level constants and types"
  - "public.f_unaccent applied symmetrically on both sides of word_similarity for Héron ↔ Heron parity (Open Q #4 confirmed)"
  - "Family fuzzy uses LIMIT 1 (no clear-gap rule) per D-80-02 asymmetry vs brand"
  - "Empty rawModel coerced to UNSPECIFIED_FAMILY_NAME before tier queries — same 4-tier flow with substituted model"

patterns-established:
  - "Pattern B (db.execute cast): result as unknown as Array<{...}> — used for all 8 SQL calls in the resolver"
  - "Unified 8-field D-80-04 whitelist across all 4 event types: fuzzy events include real runner_up values, auto-create events emit null placeholders"
  - "Plan 03 contract: import resolveBrandId + resolveFamilyId from @/data/catalog-resolver; call BOTH before each INSERT in BOTH upsert helpers; add brand_id + family_id to INSERT column + VALUES lists; OMIT from DO UPDATE SET"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03, INGEST-04]

# Metrics
duration: 15min
completed: 2026-06-25
---

# Phase 80 Plan 02: Catalog Resolver Summary

**Brand + family resolver module with 3-tier/4-tier pg_trgm lookup, D-80-01 clear-gap tie-break, alias-before-fuzzy ordering, and atomic ON CONFLICT auto-create; all 10 unit tests GREEN**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-25T19:00:00Z
- **Completed:** 2026-06-25T19:08:39Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- `resolveBrandId` implements D-80-01: exact → word_similarity >= 0.6 with runner-up clear-gap check (threshold 0.1) → atomic ON CONFLICT brands_name_normalized_unique auto-create; uses slugifyWithRandomSuffix to eliminate slug collision retry path
- `resolveFamilyId` implements D-80-02: exact on name_normalized → aliases @> ARRAY[...]::text[] (operator-curated merges win) → word_similarity >= 0.6 LIMIT 1 (no clear-gap rule) → atomic ON CONFLICT watch_families_brand_name_unique auto-create; empty rawModel coerced to '(unspecified)' placeholder
- All 4 D-80-04 structured log event types (`fuzzy_brand_match`, `brand_auto_created`, `fuzzy_family_match`, `family_auto_created`) emit unified 8-key payload; auto-create events emit `score` + `runner_up_*` as `null` (not omitted) per T-80-06
- 10/10 unit tests GREEN; `(xmax = 0) AS was_created` race-safety signal implemented for both brand and family auto-create paths

## Task Commits

1. **Task 1 + Task 2: Brand resolver + Family resolver** — `cde76eb9` (feat)
   - Both resolvers implemented in single file creation; committed together since they share module constants and types

## Files Created/Modified

- `/Users/tylerwaneka/Documents/horlo/src/data/catalog-resolver.ts` — Brand + family resolver helpers with D-80-01/D-80-02 tier logic, D-80-04 structured events, server-only boundary

## Decisions Made

- D-80-01 clear-gap check runs in TypeScript after LIMIT 2 SQL query (not in SQL CASE expression) — simpler, unit-testable, matches RESEARCH recommendation
- Both resolvers written in the same file creation (not sequentially across two commits) since they're tightly coupled through module constants; both tasks committed together
- public.f_unaccent wrapped on BOTH sides of word_similarity for diacritic symmetry (Open Q #4) — confirmed correct by existing searchCatalogWatches precedent in catalog.ts L549
- Family fuzzy uses LIMIT 1 (asymmetric vs brand's LIMIT 2) per D-80-02 no-clear-gap-rule

## Deviations from Plan

None — plan executed exactly as written. Both tasks implemented cleanly against the RED tests from Plan 01.

## Issues Encountered

None. The `server-only` import required the `// @vitest-environment node` pragma (already on the test file from Plan 01). All 10 tests passed on first run.

## Stub Tracking

No stubs. The resolver module is fully implemented:
- All 3 brand tiers execute real SQL (mocked in tests via queue-based vi.mock)
- All 4 family tiers execute real SQL
- Log events emit real payload objects (not placeholder strings)

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced by this plan. The resolver module uses existing DB tables (brands, watch_families) via existing Drizzle db client with server-only boundary. All SQL uses parameterized binding (T-80-01 verified by grep — zero sql.raw calls; zero = ANY(${...}) array spreads).

## Next Phase Readiness

Plan 03 can import `resolveBrandId` + `resolveFamilyId` from `@/data/catalog-resolver` directly. Contract:
- Call `resolveBrandId(input.brand)` → get `brandId`
- Call `resolveFamilyId(brandId, input.model)` → get `familyId`
- Add `brand_id`, `family_id` to INSERT column + VALUES in BOTH upsert helpers
- OMIT `brand_id`, `family_id` from `DO UPDATE SET` clause (Discretion iii — existing FKs survive on conflict)

---

## Self-Check: PASSED

Files verified:
- `src/data/catalog-resolver.ts` — FOUND
- Commit `cde76eb9` — FOUND (`git log --oneline -1` confirms)
- 10/10 tests GREEN — confirmed by test run output

*Phase: 80-not-null-constraint-flip-ingest-hardening*
*Completed: 2026-06-25*
