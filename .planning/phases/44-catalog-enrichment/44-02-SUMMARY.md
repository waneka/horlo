---
phase: 44-catalog-enrichment
plan: "02"
subsystem: data-access-layer
tags: [downgrade-guard, catalog, tdd, integrity]
dependency_graph:
  requires: []
  provides: [taste_downgrade_guard_in_updateCatalogTaste]
  affects: [src/data/catalog.ts, scripts/reenrich-taste.ts]
tech_stack:
  added: []
  patterns: [db.execute-double-cast, structured-json-console-warn]
key_files:
  created: []
  modified:
    - src/data/catalog.ts
    - tests/integration/catalog-taste.test.ts
decisions:
  - "Guard lives in updateCatalogTaste (not the calling script) so every force path is protected regardless of caller — D-07 per plan"
  - "0.7 threshold as literal in guard condition per D-09"
  - "Vision-mode incoming writes bypass guard via early !taste.extractedFromPhoto check"
metrics:
  duration: "80s"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
requirements: [ENRH-03]
---

# Phase 44 Plan 02: Downgrade Guard Summary

Downgrade guard added to `updateCatalogTaste` in `src/data/catalog.ts` — a text-mode force write cannot overwrite a vision-derived, high-confidence (>= 0.7) catalog row. Three integration test cases prove the block/allow-vision/allow-low-confidence branches via TDD.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write three failing integration tests for D-08 block rule | e0e9248 | tests/integration/catalog-taste.test.ts |
| 2 | Implement the downgrade guard in updateCatalogTaste | 0210691 | src/data/catalog.ts |

## What Was Built

### Downgrade Guard (`src/data/catalog.ts`)

Inserted after `const force = options?.force === true` in `updateCatalogTaste`. When `force === true` AND `taste.extractedFromPhoto === false`, the guard runs a `SELECT confidence, extracted_from_photo FROM watches_catalog WHERE id = $catalogId` before the write. If the existing row has `extracted_from_photo = true` AND `confidence IS NOT NULL` AND `Number(confidence) >= 0.7`, the guard:
1. Emits a structured `taste_downgrade_guard_blocked` JSON warn with `catalog_id`, `existing_confidence`, and `timestamp`
2. Returns `{ updated: false }` without executing the UPDATE

All other cases fall through to the existing force path unchanged. The function signature, non-force path, and return type are unmodified.

### Integration Tests (`tests/integration/catalog-taste.test.ts`)

Three new `it()` cases added inside the existing `updateCatalogTaste` describe block:
- **guard blocks** text-mode force write on vision row with confidence >= 0.7 (D-08) — asserts `updated: false` and unchanged formality
- **guard allows** vision-mode force write on vision row (D-08 legit refresh) — asserts `updated: true`
- **guard allows** text-mode force write when existing confidence < 0.7 — asserts `updated: true`

All three reuse `insertTestRow`, `VALID_TASTE`, and `TEST_BRAND` cleanup; no new `afterAll` hooks added.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | e0e9248 `test(44-02): add failing downgrade-guard cases` | Test 1 failed as expected (guard absent) |
| GREEN | 0210691 `feat(44-02): implement D-07/D-08 downgrade guard in updateCatalogTaste` | All 11 tests pass |

## Verification Results

```
✓ tests/integration/catalog-taste.test.ts (11 tests) 74ms
  ✓ guard blocks text-mode force write on vision row with confidence >= 0.7 (D-08)
  ✓ guard allows vision-mode force write on vision row (D-08 — legit refresh)
  ✓ guard allows text-mode force write when existing confidence < 0.7
  (+ 8 pre-existing tests all still passing)
```

`npx tsc --noEmit`: No errors in `src/data/catalog.ts` or `tests/integration/catalog-taste.test.ts`. Pre-existing type errors in other test files are out of scope.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The guard's SELECT query uses a drizzle `sql` tagged-template parameter (`WHERE id = ${catalogId}`), not string interpolation — T-44-06 mitigated. Every block emits a structured `taste_downgrade_guard_blocked` JSON event — T-44-07 mitigated. T-44-05 is now mitigated: the guard is in the DAL function itself, not the calling script, so no caller can bypass it.

## Known Stubs

None.

## Self-Check: PASSED

- `src/data/catalog.ts` contains `taste_downgrade_guard_blocked`: verified (grep confirmed)
- Commits e0e9248 and 0210691 exist in git log: verified
- All 11 integration tests pass GREEN: verified
- Function signature of `updateCatalogTaste` unchanged: verified
