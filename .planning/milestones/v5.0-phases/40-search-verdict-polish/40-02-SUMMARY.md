---
phase: 40
plan: "02"
subsystem: verdict
tags: [verdict, composer, catalog-taste, types, fit-05]
dependency_graph:
  requires: []
  provides: [VerdictBundleFull.candidateCatalogTaste, composer-candidateCatalogTaste-threading]
  affects: [40-06-CollectionFitCard-compare-table]
tech_stack:
  added: []
  patterns: [numeric-coercion-defense-in-depth, D-14-module-absent-not-empty]
key_files:
  created: []
  modified:
    - src/lib/verdict/types.ts
    - src/lib/verdict/composer.ts
    - tests/static/composer-engine-alignment.test.ts
    - src/components/insights/CollectionFitCard.test.tsx
    - src/components/watch/AddWatchFlow.test.tsx
    - src/components/watch/VerdictStep.test.tsx
    - src/components/watch/WishlistRationalePanel.test.tsx
    - tests/components/search/useWatchSearchVerdictCache.test.tsx
decisions:
  - "Inline candidateCatalogTaste construction in return literal (not intermediate variable) — required to satisfy source-text assertion regex /candidateCatalogTaste:\\s*catalogEntry/"
  - "Apply Number() coercion idempotently at composer boundary even though mapRowToCatalogEntry already coerces (Pitfall 2 / Assumption A2 defense-in-depth)"
  - "Use null (not undefined) for absent catalogEntry case — Phase 38 LEFT JOIN convention and RSC serialization safety (T-40-06)"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-14T21:54:34Z"
  tasks_completed: 2
  files_changed: 8
---

# Phase 40 Plan 02: candidateCatalogTaste VerdictBundleFull Extension Summary

**One-liner:** Added `candidateCatalogTaste: CatalogTasteAttributes | null` to `VerdictBundleFull` and threaded it through `computeVerdictBundle` with idempotent `Number()` coercion at the postgres-js boundary.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add candidateCatalogTaste field to VerdictBundleFull | bcdae6a | src/lib/verdict/types.ts |
| 2 (RED) | Add failing test for composer threading | 3178cc7 | tests/static/composer-engine-alignment.test.ts |
| 2 (GREEN) | Thread candidateCatalogTaste through composer | 78d0415 | src/lib/verdict/composer.ts + 5 test fixtures |

## What Was Built

### types.ts — New Field (line 35-36)

Added `candidateCatalogTaste: CatalogTasteAttributes | null` to `VerdictBundleFull` at line 35, immediately after `roleOverlap: boolean`. Extended the type-only import at line 3 to include `CatalogTasteAttributes`. JSDoc comment references Phase 40 FIT-05 D-14/D-15 and notes that the confidence gate (`>= 0.5`) is applied downstream in `CollectionFitCard`, not in the type or composer.

`VerdictBundleSelfOwned` and `CandidateTasteSnapshot` were NOT modified — the self-owned branch doesn't compute taste, and `CandidateTasteSnapshot` remains the 5-field internal shape consumed by template predicates.

### composer.ts — Threading (return literal, line 99)

Inside `computeVerdictBundle`, the `candidateCatalogTaste` construction was placed **inline in the return object literal** (not as an intermediate variable). This was required to satisfy the source-text assertion regex `/candidateCatalogTaste:\s*catalogEntry/` — the regex searches for `candidateCatalogTaste:` immediately followed by `catalogEntry`, which matches `candidateCatalogTaste: catalogEntry` (the start of the inline ternary).

The full 8-field construction:
```ts
candidateCatalogTaste: catalogEntry
  ? {
      formality: catalogEntry.formality !== null ? Number(catalogEntry.formality) : null,
      sportiness: catalogEntry.sportiness !== null ? Number(catalogEntry.sportiness) : null,
      heritageScore: catalogEntry.heritageScore !== null ? Number(catalogEntry.heritageScore) : null,
      primaryArchetype: catalogEntry.primaryArchetype,
      eraSignal: catalogEntry.eraSignal,
      designMotifs: catalogEntry.designMotifs ?? [],
      confidence: catalogEntry.confidence !== null ? Number(catalogEntry.confidence) : null,
      extractedFromPhoto: catalogEntry.extractedFromPhoto ?? false,
    }
  : null,
```

### Numeric Coercion Choice

`Number()` coercion is applied to `formality`, `sportiness`, `heritageScore`, and `confidence`. Per RESEARCH Pitfall 2 + Assumption A2, `mapRowToCatalogEntry` in `src/data/catalog.ts` already applies `Number()` at the DAL boundary (lines 77-83), so the coercion in the composer is **idempotent** — `Number(0.72)` returns `0.72`. The defense-in-depth cost is zero and protects against future DAL-mapper drift.

### 3 Call Sites — No Changes Required

All 3 production call sites already pass `catalogEntry` to `computeVerdictBundle`:
- `src/app/watch/[id]/page.tsx:52` — passes `getCatalogById(watch.catalogId)` result
- `src/app/catalog/[catalogId]/page.tsx:117` — passes `catalogEntry`
- `src/app/actions/verdict.ts:63` — passes `catalogEntry`

The composer constructs `candidateCatalogTaste` internally from `catalogEntry`, so no call-site changes were needed. The `ComposeArgs` interface signature (`catalogEntry?: CatalogEntry | null`) was unchanged.

### composer-engine-alignment.test.ts — New Source Assertions

Added a new `describe('Phase 40 FIT-05 — candidateCatalogTaste threading (source-text guard)')` block with two assertions:
1. `expect(composerSrc).toMatch(/candidateCatalogTaste:\s*catalogEntry/)` — verifies the threading is wired in the return literal (RESEARCH Q5 acceptance criterion)
2. `expect(typesSrc).toMatch(/candidateCatalogTaste/)` — verifies the field exists in `types.ts`

Uses `readFileSync('src/lib/verdict/composer.ts', 'utf8')` — source-text guard pattern confirmed by RESEARCH Q5.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 5 test fixtures with missing `candidateCatalogTaste` field**
- **Found during:** Task 2 (GREEN verification via `npx tsc --noEmit`)
- **Issue:** Adding `candidateCatalogTaste: CatalogTasteAttributes | null` as a required field to `VerdictBundleFull` caused tsc errors in 5 test files that construct `VerdictBundleFull` literals manually. The plan documented this for the 3 production call sites, but the test fixtures were not mentioned.
- **Fix:** Added `candidateCatalogTaste: null` to each fixture literal in: `CollectionFitCard.test.tsx`, `AddWatchFlow.test.tsx`, `VerdictStep.test.tsx`, `WishlistRationalePanel.test.tsx` (2 literals), `useWatchSearchVerdictCache.test.tsx`
- **Files modified:** 5 test files
- **Commit:** 78d0415

**2. [Rule 2 - Implementation choice] Inline construction vs. intermediate variable**
- **Found during:** Task 2 GREEN phase (source-text test still failing after initial implementation)
- **Issue:** Initially built `candidateCatalogTaste` as an intermediate `const` before the `conf` line, then used shorthand `candidateCatalogTaste,` in the return object. This broke the regex `/candidateCatalogTaste:\s*catalogEntry/` — the declaration line has `CatalogTasteAttributes | null` between the colon and `catalogEntry`.
- **Fix:** Moved the construction inline into the return literal so `candidateCatalogTaste: catalogEntry` appears as the first line of the property, matching the regex exactly.
- **Files modified:** src/lib/verdict/composer.ts
- **Commit:** 78d0415

## TDD Gate Compliance

| Gate | Status | Commit |
|------|--------|--------|
| RED (`test(...)`) | PASS | 3178cc7 — 1 test failing, 12 passing |
| GREEN (`feat(...)`) | PASS | 78d0415 — 13 tests passing |
| REFACTOR | N/A — no cleanup needed |

## Known Stubs

None. `candidateCatalogTaste` is wired directly from `catalogEntry` (the real DAL value passed by all 3 call sites). No placeholder data.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new fields are plain JSON-serializable primitives and arrays (T-40-06 RSC serialization boundary satisfied). Threat register unchanged from plan.

## Self-Check: PASSED

- [x] `src/lib/verdict/types.ts` — `candidateCatalogTaste` field exists (grep count: 1), `CatalogTasteAttributes` import present (grep count: 2)
- [x] `src/lib/verdict/composer.ts` — `candidateCatalogTaste: catalogEntry` in return literal (grep count: 1), `Number(catalogEntry.` occurrences: 4
- [x] `tests/static/composer-engine-alignment.test.ts` — 13 tests GREEN including 2 new source-text assertions
- [x] `tests/static/CollectionFitCard.no-engine.test.ts` — 3 tests GREEN (unchanged)
- [x] tsc errors in `verdict/composer.ts` and `verdict/types.ts`: 0
- [x] tsc errors in 3 call sites: 0
- [x] Total tsc error count: 29 (matches pre-task baseline — no new errors)
- [x] Commits: bcdae6a (Task 1), 3178cc7 (Task 2 RED), 78d0415 (Task 2 GREEN)
