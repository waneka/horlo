---
phase: 81-recommender-display-server-action-swap
plan: 05
subsystem: watch-detail-page DAL / hierarchy read-path
tags:
  - phase-81
  - scope-patch
  - detail-page-drift
  - same-family-rail
  - lineage-rail
  - canonical-identity
  - inner-join
  - read-time-join
dependency-graph:
  requires:
    - Plan 02 canonical-brand-JOIN pattern (`topUpFromCatalogPopularity`) — the validated reference pattern replicated verbatim here
    - Phase 80 NOT NULL on `watches_catalog.brand_id` + `family_id` (INNER JOIN row-preservation guarantee)
  provides:
    - `getSameFamilyForCatalog` projects canonical `brands.name` + `watch_families.name` (was drift-prone `watches_catalog.brand` + `.model`)
    - `getLineageForReference` recursive CTE projects canonical `b.name` + `f.name` in BOTH seed + recursive arms (Pitfall 5 extended)
  affects:
    - CONTEXT.md § Deferred Ideas revisit-trigger (the "if drift becomes visible in other surfaces post-Phase-81, revisit" clause fires here + closes here)
    - `SameFamilyRail.tsx` + `LineageRail.tsx` (no code change — they consume the same field names, which now carry canonical strings)
tech-stack:
  added: []
  patterns:
    - Read-time canonical JOIN pattern (Plan 02) extended to the two watch-detail-page rail DALs
    - Pitfall 5 (both-arms-must-carry-projection) invariant extended from `wc.image_url` to `b.name` + `f.name` in the recursive CTE
    - GROUP BY substitutes canonical columns for denorm columns when SELECT swaps sources (Postgres aggregation rule)
key-files:
  created:
    - .planning/phases/81-recommender-display-server-action-swap/81-05-SUMMARY.md
  modified:
    - src/data/hierarchy.ts
decisions:
  - Reused Plan 02's INNER JOIN pattern verbatim rather than inventing a new SQL shape. Import extension (`brands`, `watchFamilies` from `@/db/schema`) matches Plan 02's already-shipped import list.
  - GROUP BY tiebreak columns (`ORDER BY … asc(watchesCatalog.brand), asc(watchesCatalog.model)`) switched to canonical (`asc(brands.name), asc(watchFamilies.name)`) for internal consistency — minor deterministic-ordering drift acknowledged, aligns with Phase 81's intent (canonical wins).
  - CYCLE clause + depth < 10 guard + Postgres 15 `CYCLE id SET is_cycle USING path` left untouched (T-81-P05-04 mitigation kept scope tight — the safety mechanisms are orthogonal to the drift fix).
  - Public interface shapes (`SameFamilyWatch`, `LineageRow`) unchanged — field names + types identical. Rail components stay untouched.
metrics:
  duration: 9m
  completed: 2026-07-13
  tasks_completed: 2/2
  files_modified: 1
  commits: 2
---

# Phase 81 Plan 05: Same-Family + Lineage Rail Canonical Display Summary

**One-liner:** Extended the read-time canonical-JOIN pattern (Plan 02's `topUpFromCatalogPopularity` fix) to the two watch-detail-page rail DALs — `getSameFamilyForCatalog` INNER JOINs `brands` + `watch_families` and projects canonical strings in SELECT + GROUP BY + ORDER BY; `getLineageForReference` recursive CTE gains the same JOINs in BOTH the seed arm and the recursive arm with matching `b.name AS brand` + `f.name AS model` projections. Drift catalog rows (e.g., `Hamilton Watch / DriftTest Chrono` with canonical `Hamilton / Khaki Field Mechanical`) now surface canonical brand/family strings on SameFamilyRail and LineageRail. No public interface changes; the two Rail components consume the same field names.

## Tasks Executed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 05-1 | `getSameFamilyForCatalog` canonical INNER JOIN (import extension, SELECT/GROUP BY/ORDER BY substitution) | 39b7783e | ✓ |
| 05-2 | `getLineageForReference` recursive CTE both-arms canonical JOIN + projection swap | 748c0b5f | ✓ |

## File Diff Shape

| File | Before (LOC) | After (LOC) | Change |
|------|-------------:|------------:|:------:|
| src/data/hierarchy.ts | 175 | 201 | +26 — Plan 02 canonical JOIN pattern replicated in `getSameFamilyForCatalog` (Task 05-1) and extended to both arms of the `getLineageForReference` recursive CTE (Task 05-2); import extension `brands` + `watchFamilies`; inline docstring calls out Pitfall 5 extension. |

## Interface Contracts

**Preserved (unchanged):**
- `SameFamilyWatch` interface (L53-59): still `{ id: string; brand: string; model: string; imageUrl: string | null; ownersCount: number }`. Field names + types identical; the underlying projection sources changed from denorm to canonical.
- `LineageRow` interface (L28-40): still `{ id, brand, model, reference, imageUrl, predecessor_catalog_id, successor_catalog_id, relationship_type, depth, direction, is_cycle }`. Field names + types identical.

**Consumer surface (no changes required):**
- `SameFamilyRail.tsx` renders `.brand` / `.model` directly — receives canonical strings automatically.
- `LineageRail.tsx` renders `.brand` / `.model` directly — receives canonical strings automatically.

## Verification

- **`npm run build` → exits 0** — clean build both after Task 05-1 and after Task 05-2. Authoritative gate per `[[baseline-not-green-build-is-gate]]`.
- **Grep armor + Plan 02 pattern parity:**
  - `grep -c "innerJoin(brands" src/data/hierarchy.ts` → **1** (Task 05-1 acceptance ≥ 1 ✓)
  - `grep -c "innerJoin(watchFamilies" src/data/hierarchy.ts` → **1** (Task 05-1 acceptance ≥ 1 ✓)
  - `grep -c "brand: brands.name" src/data/hierarchy.ts` → **1** (Task 05-1 SELECT projection ✓)
  - `grep -c "model: watchFamilies.name" src/data/hierarchy.ts` → **1** (Task 05-1 SELECT projection ✓)
  - `grep -c "JOIN brands b" src/data/hierarchy.ts` → **2** (Task 05-2 acceptance ≥ 2, seed + recursive arm ✓)
  - `grep -c "JOIN watch_families f" src/data/hierarchy.ts` → **2** (Task 05-2 acceptance ≥ 2 ✓)
  - `grep -c "b.name AS brand" src/data/hierarchy.ts` → **3** (2 in SQL body — one per arm; 1 in inline docstring; Task 05-2 acceptance ≥ 2 ✓)
  - `grep -c "f.name AS model" src/data/hierarchy.ts` → **3** (2 in SQL body — one per arm; 1 in inline docstring; Task 05-2 acceptance ≥ 2 ✓)
  - `grep -c "= ANY(" src/data/hierarchy.ts` → **0** (`[[drizzle-sql-any-array-pitfall]]` armor holds — no IN clauses in this file, none introduced ✓)
- **Live query smoke against drift fixture** (Task 05-1 acceptance criterion, exercised via psql against `supabase_db_horlo` on 127.0.0.1:54322):
  - Drift catalog row `90c4ac1f-1b4f-4fc1-80ce-96e425d34af4`: `watches_catalog.brand='Hamilton Watch'`, `watches_catalog.model='DriftTest Chrono'`, `brand_id → brands.name='Hamilton'`, `family_id → watch_families.name='Khaki Field Mechanical'`.
  - Canonical JOIN query returns `Hamilton / Khaki Field Mechanical` (NOT `Hamilton Watch / DriftTest Chrono`). Correctness proof for the pattern the DAL now uses.
- **Threat register verified in code:**
  - T-81-P05-01 (denorm regression via missed JOIN): both DALs now hard-wire the JOINs; grep armor above catches any future refactor that removes them.
  - T-81-P05-02 (INNER JOIN loses rows): schema check — `watchesCatalog.brandId` and `watchesCatalog.familyId` are `.notNull()` (Phase 80 flip, verified in schema.ts L505-506). INNER JOINs cannot lose rows.
  - T-81-P05-03 (GROUP BY drift): `getSameFamilyForCatalog` GROUP BY substitutes `brands.name` for `watchesCatalog.brand` and `watchFamilies.name` for `watchesCatalog.model`; `npm run build` exits 0 (Postgres aggregation would reject at query time otherwise — the build type-check + a successful live query against the drift fixture together prove the shape is valid).
  - T-81-P05-04 (lineage CTE arm asymmetry): both seed arm (L135) and recursive arm (L162) carry identical `JOIN brands b … JOIN watch_families f …` + `b.name AS brand, f.name AS model` — proved by grep counts of 2 for each JOIN identifier and 2 for each `AS` projection in the SQL body.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed atomically with acceptance criteria met on first build.

## Runtime Observations

- **Drift fixture confirmed present + effective before change:** psql query against `watches_catalog.id = '90c4ac1f-…4af4'` returned `denorm_brand='Hamilton Watch', denorm_model='DriftTest Chrono', canonical_brand='Hamilton', canonical_family='Khaki Field Mechanical'`. Fixture per D-81-04's recipe (denorm drift on a canonical Hamilton brand_id).
- **Plan 02 pattern replicated verbatim:** Import list `brands, watchFamilies` matches Plan 02's `src/data/recommendations.ts` L6-12. SELECT projection form `brand: brands.name, model: watchFamilies.name` matches Plan 02 L492-493 verbatim. Chain form `.innerJoin(brands, eq(brands.id, watchesCatalog.brandId)).innerJoin(watchFamilies, eq(watchFamilies.id, watchesCatalog.familyId))` matches Plan 02 L502-503 / L536-537.
- **CTE both-arms discipline:** Pitfall 5 comment already warned the recursive CTE about carrying `wc.image_url` in both arms; the same discipline mentally extends to `b.name` + `f.name`. Docstring updated to reflect the extension without changing code comment structure.
- **No test file exists specifically for these two DALs** in `src/data/__tests__/`. `npm run build`'s TypeScript pass + the psql smoke against the drift fixture together form the correctness gate. Detail-page walkthrough on `npm run dev` (per operator revisit trigger) is the human UAT — the operator explicitly noted they'll re-walk before running the fixture REVERT block.
- **Drift fixture NOT reverted here:** the operator will run the REVERT block after re-verifying the detail page renders canonical strings.

## Requirements Marked Complete

**RECO-01** (already marked at Plan 02 close for the home-rail exclusion path) and **RECO-04** (already marked at Plan 02 close for the home-rail rationale path) had scope patched here to cover the two detail-page rail surfaces per CONTEXT.md § Deferred Ideas revisit trigger. No new requirement IDs added to Plan 05 frontmatter beyond the tags already tracking `phase-81` + `scope-patch` + `detail-page-drift` + `same-family-rail` + `lineage-rail`. Marking again is a no-op (idempotent).

## Threat Flags

None. No new network endpoints, no new auth paths, no new file-access patterns, no new schema-mutation surface introduced. Read-path-only change on existing DALs; the trust boundary is unchanged.

## Self-Check: PASSED

- File `.planning/phases/81-recommender-display-server-action-swap/81-05-SUMMARY.md` created (this file).
- Commit `39b7783e` exists on `main` (Task 05-1 — `getSameFamilyForCatalog` canonical JOIN).
- Commit `748c0b5f` exists on `main` (Task 05-2 — `getLineageForReference` CTE both-arms canonical JOIN).
- `npm run build` last run exits 0.
- Grep armor: `= ANY(` returns 0 in `src/data/hierarchy.ts`; Plan 02 pattern parity greps all pass.
- Live psql smoke against drift fixture returns canonical `Hamilton / Khaki Field Mechanical`.
- Public `SameFamilyWatch` + `LineageRow` interfaces unchanged (grep of the file confirms the type declarations at L28-40 + L53-59 are byte-identical to pre-Plan-05).
