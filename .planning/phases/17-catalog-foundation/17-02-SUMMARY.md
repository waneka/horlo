---
phase: 17
plan: 02
subsystem: catalog-dal
tags: [dal, drizzle, upsert, coalesce, server-only, integration-tests]
dependency_graph:
  requires:
    - watches_catalog table with watches_catalog_natural_key UNIQUE CONSTRAINT (Plan 01)
    - CatalogSource / ImageSourceQuality / CatalogEntry TS types (Plan 01)
    - watches.catalogId FK column (Plan 01)
  provides:
    - upsertCatalogFromUserInput (CAT-06: DO NOTHING on conflict)
    - upsertCatalogFromExtractedUrl (CAT-07: COALESCE enrichment + admin_curated guard)
    - getCatalogById (CAT-11: read by id for Phase 19/20)
    - linkWatchToCatalog (CAT-08: owner-scoped watches.catalog_id update)
    - sanitizeHttpUrl / sanitizeTagArray (T-17-02-01 / T-17-02-02 mitigations)
  affects:
    - Plan 03 (addWatch wiring — call upsertCatalogFromUserInput + linkWatchToCatalog)
    - Plan 04 (backfill — same helpers OR inline Pattern 5 for atomicity)
    - Phase 19 (/search — getCatalogById for display)
    - Phase 20 (/evaluate?catalogId= — getCatalogById for evaluation)
tech_stack:
  added:
    - db.execute(sql`...`) raw SQL upsert pattern (named constraint conflict target)
    - toTextArraySql helper (empty-array postgres.js workaround)
    - sanitizeHttpUrl / sanitizeTagArray input sanitizers
  patterns:
    - server-only DAL (mirrors watches.ts / profiles.ts)
    - mapRowToCatalogEntry mapper (mirrors mapRowToWatch shape)
    - ON CONFLICT ON CONSTRAINT watches_catalog_natural_key (named constraint — not column-list)
    - COALESCE(existing, excluded) for first-non-null-wins semantics (D-13)
    - CASE WHEN source = 'admin_curated' THEN source ELSE 'url_extracted' END (D-11 lockdown)
key_files:
  created:
    - src/data/catalog.ts
    - tests/integration/phase17-upsert-coalesce.test.ts
  modified:
    - src/data/watches.ts (linkWatchToCatalog appended)
decisions:
  - "toTextArraySql helper: postgres.js renders empty JS arrays as ()::text[] (invalid SQL); use '{}'::text[] literal for empty, ARRAY[...]::text[] for non-empty"
  - "ON CONFLICT ON CONSTRAINT watches_catalog_natural_key: use named constraint (from Plan 01 deviation), not column-list form — partial index predicate makes column-list fragile"
  - "linkWatchToCatalog separate from createWatch: testability + fire-and-forget independence (RESEARCH Open Q #2)"
metrics:
  duration_minutes: 20
  completed_date: "2026-04-27"
  tasks_completed: 3
  files_changed: 3
---

# Phase 17 Plan 02: Catalog DAL Helpers Summary

**One-liner:** Catalog DAL with COALESCE upsert helpers, admin_curated lockdown, sanitized URL/tag inputs, and 9/9 integration tests GREEN.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | catalog DAL — upsert helpers + getCatalogById | c1442db | Done |
| 2 | linkWatchToCatalog in watches.ts | f60f8b9 | Done |
| 3 | integration tests — CAT-06 + CAT-07 + admin_curated guard | 5121916 | Done |

## Key Files

### Created
- **`src/data/catalog.ts`** — 4 exports: `upsertCatalogFromUserInput`, `upsertCatalogFromExtractedUrl`, `getCatalogById`, plus `UserPromotedCatalogInput` + `UrlExtractedCatalogInput` interfaces and internal sanitizers
- **`tests/integration/phase17-upsert-coalesce.test.ts`** — 9 integration tests covering CAT-06, CAT-07, D-10, D-11, D-13, T-17-02-01

### Modified
- **`src/data/watches.ts`** — `linkWatchToCatalog(userId, watchId, catalogId)` appended at end of file

## DAL Function Signatures

| Function | CAT-NN | Behavior |
|----------|--------|----------|
| `upsertCatalogFromUserInput(input): Promise<string \| null>` | CAT-06 | INSERT natural key + source='user_promoted'; ON CONFLICT DO NOTHING; returns existing id via UNION ALL fallback |
| `upsertCatalogFromExtractedUrl(input): Promise<string \| null>` | CAT-07 | INSERT all spec columns + source='url_extracted'; ON CONFLICT COALESCE per nullable column; admin_curated CASE guard on source |
| `getCatalogById(id): Promise<CatalogEntry \| null>` | CAT-11 | Single-row Drizzle select; maps to CatalogEntry |
| `linkWatchToCatalog(userId, watchId, catalogId): Promise<void>` | CAT-08 | UPDATE watches SET catalog_id WHERE id AND user_id (owner-scoped, idempotent) |

## Test Results

All 9 new tests GREEN; all 27 Plan 01 tests still GREEN (36 total phase17-* tests passing):

| Test | Requirement |
|------|-------------|
| user input writes natural key only | CAT-06 |
| user input does nothing on conflict | CAT-06 |
| user input does nothing on conflict — does NOT downgrade source | D-10 |
| url extract enriches NULL columns via COALESCE | CAT-07 |
| url extract does not overwrite non-null (D-13 first-non-null wins) | D-13 |
| source upgrade user_promoted → url_extracted | D-10 |
| admin_curated locked — source never overwritten | D-11 |
| image_source_url rejects non-http (T-17-02-01) | T-17-02-01 |
| casing collapse via helper | CAT-06 + D-02 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty JS array renders as `()::text[]` in postgres.js driver**

- **Found during:** Task 3 (test run — `upsertCatalogFromExtractedUrl` with no tag arrays)
- **Issue:** Drizzle's `sql` template tag passes JS arrays directly to postgres.js. The `postgres.js` driver serializes an empty array `[]` as `()` rather than `'{}'`, producing the invalid SQL fragment `()::text[]`. Postgres returns: `syntax error at or near ")"`.
- **Fix:** Added `toTextArraySql` helper inside `upsertCatalogFromExtractedUrl`: if array is empty emit `sql\`'{}'::text[]\``; if non-empty emit `sql\`ARRAY[$1,$2,...]::text[]\`` via `sql.join`. This pattern handles both empty and populated arrays correctly across all callers.
- **Files modified:** `src/data/catalog.ts`
- **Commit:** 5121916

## Notes for Plan 03 (addWatch wiring)

- Both upsert helpers **throw on DB error** — wrap all call sites in `try/catch` per CAT-08 fire-and-forget semantics. Failure to catalog-link must never block the user's watch from being saved.
- Call order: `createWatch` first (get watchId), then `upsertCatalogFromUserInput` (get catalogId), then `linkWatchToCatalog(userId, watchId, catalogId)`.
- `upsertCatalogFromUserInput` only takes `brand`, `model`, `reference` — if the user typed custom values those flow as-is; normalization is DB-generated.
- `upsertCatalogFromExtractedUrl` is for the URL-extraction path only (Plan 03 wires into `/api/extract-watch`).

## Notes for Plan 04 (backfill script)

- The backfill can use `upsertCatalogFromUserInput` per existing watch row, then `linkWatchToCatalog`. This is the same path as the addWatch action.
- For atomic batch processing, RESEARCH Pattern 5 inlines the upsert SQL directly — either approach is valid. The helpers are safe for sequential per-row calls at backfill volume (<500 watches).

## Known Stubs

None. The catalog DAL is fully implemented. Plan 03 will wire the helpers into the write path; this plan's job is helpers + tests only.

## Threat Flags

None found. All threat model mitigations from the plan's STRIDE register were implemented:
- T-17-02-01: `sanitizeHttpUrl` rejects non-http/https image URLs — asserted by test
- T-17-02-02: `sanitizeTagArray` caps string type, length, and count — applied to all 4 tag arrays
- T-17-02-03: `linkWatchToCatalog` WHERE includes `userId` — cross-user link is a silent no-op
- T-17-02-04: `upsertCatalogFromExtractedUrl` hard-codes `source = 'url_extracted'` in INSERT VALUES — admin_curated never writeable via this path

## Self-Check: PASSED

- `src/data/catalog.ts` — exists, 240 lines, 4 exports
- `src/data/watches.ts` — `linkWatchToCatalog` at line 222
- `tests/integration/phase17-upsert-coalesce.test.ts` — exists, 9 tests
- Commits c1442db, f60f8b9, 5121916 — all present on branch
- 36/36 phase17-* integration tests GREEN
