---
phase: 17
plan: 03
subsystem: catalog-wiring
tags: [catalog, wiring, server-action, api-route, fire-and-forget, integration-tests]
dependency_graph:
  requires:
    - upsertCatalogFromUserInput (Plan 02 — src/data/catalog.ts)
    - upsertCatalogFromExtractedUrl (Plan 02 — src/data/catalog.ts)
    - linkWatchToCatalog (Plan 02 — src/data/watches.ts)
    - watches_catalog table with watches_catalog_natural_key UNIQUE CONSTRAINT (Plan 01)
  provides:
    - addWatch Server Action with catalog wiring (CAT-08 write path 1)
    - /api/extract-watch POST with catalog wiring (CAT-08 write path 2)
    - Fire-and-forget semantics: catalog failure never blocks user-facing operations
  affects:
    - Plan 04 (backfill): NEW watches populate catalog_id going forward; backfill targets EXISTING rows (catalog_id IS NULL)
    - Plan 06 (docs): deploy-db-setup.md should note Plan 04 backfill is a one-time operation needed because pre-Plan-03 rows have catalog_id IS NULL
tech_stack:
  added: []
  patterns:
    - Fire-and-forget try/catch wrapping catalog DAL calls (mirrors existing logActivity / logNotification pattern in addWatch)
    - Inner try/catch inside existing outer try/catch (catalog wiring isolated from SSRF/500 handler in route.ts)
    - Direct auth.users SQL insert for integration test seeding (avoids SUPABASE_SERVICE_ROLE_KEY dependency)
key_files:
  modified:
    - src/app/actions/watches.ts (catalogDAL import + 10-line try/catch block after createWatch, lines 67-80)
    - src/app/api/extract-watch/route.ts (catalogDAL import + 26-line try/catch block after fetchAndExtract, lines 49-75)
  created:
    - tests/integration/phase17-addwatch-wiring.test.ts (E2E: addWatch → watches.catalog_id populated)
    - tests/integration/phase17-extract-route-wiring.test.ts (E2E: POST /api/extract-watch → catalog row source=url_extracted)
    - tests/actions/addwatch-catalog-resilience.test.ts (unit: catalog throw → addWatch returns success=true)
decisions:
  - "Direct auth.users SQL insert for test user seeding: seedTwoUsers fixture requires SUPABASE_SERVICE_ROLE_KEY (Supabase Admin API). Local stack has custom JWT secret making the standard demo key invalid. Phase 17 pattern (phase17-upsert-coalesce) inserts test fixtures directly via db.execute — followed the same approach for addWatch wiring test."
  - "productionYear and roleTags hardcoded null/[] in extract-watch wiring: ExtractedWatchData type (src/lib/extractors/types.ts) does not include productionYear or roleTags — extractor never emits these. Used null/[] as safe defaults matching UrlExtractedCatalogInput. Do NOT rename extractor types."
metrics:
  duration_minutes: 18
  completed_date: "2026-04-27"
  tasks_completed: 1
  files_changed: 5
---

# Phase 17 Plan 03: Catalog Wiring into Write Paths Summary

**One-liner:** Fire-and-forget catalog wiring in addWatch Server Action and /api/extract-watch POST, proven by 5/5 new tests GREEN (2 E2E + 3 unit).

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Wire addWatch + /api/extract-watch + write 3 wiring tests (RED → GREEN) | f29b56b | Done |

## Key Files

### Modified

- **`src/app/actions/watches.ts`** — Added `import * as catalogDAL from '@/data/catalog'` (line 6). Inserted 10-line fire-and-forget try/catch block at lines 67-80 (after `createWatch`, before activity logging): calls `upsertCatalogFromUserInput` then `linkWatchToCatalog`; swallows error with `console.error('[addWatch] catalog wiring failed (non-fatal)')`.

- **`src/app/api/extract-watch/route.ts`** — Added `import * as catalogDAL from '@/data/catalog'` (line 5). Inserted 26-line fire-and-forget try/catch block at lines 49-75 (after `fetchAndExtract`, before `return NextResponse.json`): calls `upsertCatalogFromExtractedUrl` with all available spec fields; swallows error with `console.error('[extract-watch] catalog upsert failed (non-fatal)')`. Inner try/catch is inside the outer error handler — a catalog failure does NOT reach the SsrfError or generic 500 path.

### Created

- **`tests/integration/phase17-addwatch-wiring.test.ts`** — E2E: seeds a test user via direct `auth.users` SQL insert, calls `addWatch(...)` with a stamped brand, asserts `watches.catalog_id` is non-null, asserts `watches_catalog` row exists with `source='user_promoted'`, asserts `catalog_id == catalog.id`.

- **`tests/integration/phase17-extract-route-wiring.test.ts`** — E2E: mocks `fetchAndExtract` to return controlled brand+spec data, calls `POST(request)` directly, asserts response status 200, asserts `watches_catalog` row has `source='url_extracted'` and `case_size_mm=40`.

- **`tests/actions/addwatch-catalog-resilience.test.ts`** — Unit (3 tests): mocks `upsertCatalogFromUserInput` to throw; asserts addWatch returns `success: true`, asserts `console.error` called with message matching `/catalog wiring failed/`, asserts `linkWatchToCatalog` not called.

## Wiring Diff Summary

**`src/app/actions/watches.ts`** insertion (after line 66 `const watch = await watchDAL.createWatch(...)`):
```
lines 67-80 (new):
    // CAT-08 — catalog wiring (fire-and-forget; mirrors logActivity pattern)
    try {
      const catalogId = await catalogDAL.upsertCatalogFromUserInput({
        brand: parsed.data.brand,
        model: parsed.data.model,
        reference: parsed.data.reference ?? null,
      })
      if (catalogId) {
        await watchDAL.linkWatchToCatalog(user.id, watch.id, catalogId)
      }
    } catch (err) {
      console.error('[addWatch] catalog wiring failed (non-fatal):', err)
    }
```

**`src/app/api/extract-watch/route.ts`** insertion (after line 47 `const result = await fetchAndExtract(url)`):
```
lines 49-75 (new):
    // CAT-08 — catalog wiring (fire-and-forget)
    try {
      if (result.data?.brand && result.data?.model) {
        await catalogDAL.upsertCatalogFromExtractedUrl({ ... all spec fields ... })
      }
    } catch (err) {
      console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
    }
```

## Test Results

| Test file | Tests | Result |
|-----------|-------|--------|
| tests/integration/phase17-addwatch-wiring.test.ts | 1 | GREEN |
| tests/integration/phase17-extract-route-wiring.test.ts | 1 | GREEN |
| tests/actions/addwatch-catalog-resilience.test.ts | 3 | GREEN |
| **Phase 17 full suite (phase17-*)** | **38** | **GREEN** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] seedTwoUsers fixture requires SUPABASE_SERVICE_ROLE_KEY not present in local stack**

- **Found during:** Task 1, Step D (integration test creation + first run)
- **Issue:** `tests/fixtures/users.ts:seedTwoUsers` calls Supabase Admin API via service_role key. The local Supabase stack uses a custom JWT secret; the standard supabase-demo service_role key produces `invalid JWT: unable to parse or verify signature`. `SUPABASE_SERVICE_ROLE_KEY` is not set in any `.env*` file.
- **Fix:** Replaced `seedTwoUsers` with direct `db.execute(sql\`INSERT INTO auth.users ...\`)`. This follows the Phase 17 integration test pattern established in `phase17-upsert-coalesce.test.ts` (direct SQL inserts, no Supabase Admin API). The test gates only on `DATABASE_URL` (same as all Phase 17 integration tests).
- **Files modified:** `tests/integration/phase17-addwatch-wiring.test.ts`
- **Commit:** f29b56b

**2. [Rule 3 - Blocking] ExtractedWatchData missing productionYear and roleTags fields**

- **Found during:** Task 1, Step C (field-name compatibility check)
- **Issue:** RESEARCH Pattern 4 includes `productionYear: result.data.productionYear ?? null` and `roleTags: result.data.roleTags ?? []`. `src/lib/extractors/types.ts` `ExtractedWatchData` interface does not include these fields — the extractor never emits them. Accessing `result.data.productionYear` would TypeScript-error.
- **Fix:** Used `productionYear: null` and `roleTags: []` as hardcoded safe defaults. These fields will be populated in future via plan-specified extractor extension (per D-06 / Phase 5+ tier-aware logic). Do NOT rename extractor types.
- **Files modified:** `src/app/api/extract-watch/route.ts`
- **Commit:** f29b56b

## Notes for Plan 04 (backfill)

With this plan landed, ALL new writes from this point forward populate `watches.catalog_id`. Plan 04's backfill targets EXISTING rows where `catalog_id IS NULL`. Plan 04 can safely use `upsertCatalogFromUserInput` per existing watch row, then `linkWatchToCatalog` — the same helpers wired here.

## Notes for Plan 06 (docs/deploy-db-setup.md)

The backfill is a one-time operation needed because rows inserted before Plan 03 landed have `catalog_id IS NULL`. The wiring introduced in this plan means the backfill is not ongoing — only historical rows need it.

## Known Stubs

None. Both write paths are fully wired. `productionYear` and `roleTags` are intentionally hardcoded as `null`/`[]` in the extract route because `ExtractedWatchData` does not include these fields. When the extractor is extended to emit them, the wiring code will pick them up automatically via the same field access pattern.

## Threat Flags

None found. All mitigations from the plan's STRIDE register are present:
- T-17-03-01: Inner try/catch swallows catalog failures — watch insert is committed regardless — asserted by resilience test
- T-17-03-02: `linkWatchToCatalog` WHERE includes `userId` from `getCurrentUser()` — cross-user link is a no-op (inherited from Plan 02)
- T-17-03-03: `imageSourceUrl: url` passes the user-submitted URL (not the resolved IP); SSRF check is upstream — accepted
- T-17-03-04: `sanitizeHttpUrl()` in catalog DAL rejects non-http/https `imageUrl` — inherited from Plan 02
- T-17-03-05: `console.error` log on catalog failure is the audit trail for v4.0 — accepted

## Self-Check: PASSED

- `src/app/actions/watches.ts` — exists, contains `catalogDAL.upsertCatalogFromUserInput` and `catalog wiring failed (non-fatal)`
- `src/app/api/extract-watch/route.ts` — exists, contains `catalogDAL.upsertCatalogFromExtractedUrl` and `catalog upsert failed (non-fatal)`
- `tests/integration/phase17-addwatch-wiring.test.ts` — exists, 1 test asserting `watches.catalog_id` non-null
- `tests/integration/phase17-extract-route-wiring.test.ts` — exists, 1 test asserting `source='url_extracted'`
- `tests/actions/addwatch-catalog-resilience.test.ts` — exists, 3 tests proving fire-and-forget
- Commit f29b56b — present on branch
- 38/38 Phase 17 integration tests GREEN
- 5/5 new Plan 03 tests GREEN
