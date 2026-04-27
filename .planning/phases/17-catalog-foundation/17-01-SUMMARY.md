---
phase: 17
plan: 01
subsystem: catalog-schema
tags: [schema, drizzle, supabase, rls, pg-trgm, generated-columns, nulls-not-distinct]
dependency_graph:
  requires: []
  provides:
    - watches_catalog table with generated-column natural key + UNIQUE CONSTRAINT (NULLS NOT DISTINCT)
    - watches_catalog_daily_snapshots table with UNIQUE on (catalog_id, snapshot_date)
    - watches.catalog_id FK (nullable, ON DELETE SET NULL)
    - RLS: public SELECT, no anon writes, on both tables
    - pg_trgm GIN indexes on brand + model
    - CatalogSource / ImageSourceQuality / CatalogEntry TS types
  affects:
    - watches table (catalog_id column added)
    - Phase 18 (trending sort index watches_catalog_owners_count_desc_idx)
    - Phase 19 (/search — trgm GIN + catalog rows)
    - Phase 20 (/evaluate?catalogId= — FK join)
tech_stack:
  added:
    - UNIQUE CONSTRAINT via ALTER TABLE ... ADD CONSTRAINT ... USING INDEX (PG 15+)
    - GENERATED ALWAYS AS STORED columns (brand_normalized, model_normalized, reference_normalized)
    - NULLS NOT DISTINCT unique constraint
    - pg_trgm GIN indexes (extensions.gin_trgm_ops)
    - updated_at trigger function (watches_catalog_set_updated_at)
  patterns:
    - Drizzle column-shape migration + sibling Supabase raw-SQL migration
    - Service-role Drizzle writes bypass RLS; anon reads via PostgREST
    - Supabase RLS UPDATE/DELETE are silently blocked (0-row match), not error-returned
key_files:
  created:
    - src/db/schema.ts (watchesCatalog + watchesCatalogDailySnapshots tables; watches.catalogId)
    - src/lib/types.ts (CatalogSource, ImageSourceQuality, CatalogEntry)
    - drizzle/0004_phase17_catalog.sql
    - drizzle/meta/0004_snapshot.json
    - supabase/migrations/20260427000000_phase17_catalog_schema.sql
    - tests/integration/phase17-schema.test.ts
    - tests/integration/phase17-natural-key.test.ts
    - tests/integration/phase17-catalog-rls.test.ts
    - tests/integration/phase17-join-shape.test.ts
  modified: []
decisions:
  - "D-01: NULLS NOT DISTINCT on natural-key UNIQUE — two NULL-reference rows for same brand/model collide"
  - "D-02/D-03: GENERATED ALWAYS AS STORED for brand_normalized, model_normalized, reference_normalized — normalization enforced at DB level"
  - "UNIQUE INDEX promoted to UNIQUE CONSTRAINT via ALTER TABLE ... ADD CONSTRAINT ... USING INDEX — gives stable named conflict target for ON CONFLICT ON CONSTRAINT watches_catalog_natural_key"
  - "Supabase PostgREST RLS behavior: UPDATE/DELETE targeting RLS-blocked rows return 204/null-error; tests verify data integrity via service-role Drizzle rather than expecting an error response"
  - "trgm opclass display: PG normalizes extensions.gin_trgm_ops to bare gin_trgm_ops in pg_indexes.indexdef when extensions is on search_path — test accepts either form"
  - "reference normalization strips ALL non-alphanumeric chars including underscores — regexp_replace '[^a-z0-9]+' removes spaces, dashes, dots, underscores"
metrics:
  duration_minutes: 35
  completed_date: "2026-04-27"
  tasks_completed: 4
  files_changed: 9
---

# Phase 17 Plan 01: Catalog Schema Foundation Summary

**One-liner:** `watches_catalog` table with DB-enforced normalization (GENERATED ALWAYS AS), NULLS NOT DISTINCT UNIQUE CONSTRAINT, pg_trgm GIN indexes, RLS asymmetry, and `watches.catalog_id` FK — all 27 integration tests GREEN.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Wave 0 RED test stubs | 1acad3d | Done |
| 2 | Drizzle schema + TS types | c573ad4 | Done |
| 3 | Supabase raw-SQL migration | de24d84 | Done |
| 4 | Local DB push + fix failures | f8066fc | Done |

## Key Files

### Created
- **`src/db/schema.ts`** — Added `watchesCatalog`, `watchesCatalogDailySnapshots` pgTable definitions; added `catalogId` FK to `watches` table
- **`src/lib/types.ts`** — Added `CatalogSource`, `ImageSourceQuality`, `CatalogEntry` TS types
- **`drizzle/0004_phase17_catalog.sql`** — Drizzle column-shape migration (table structure, FK column)
- **`supabase/migrations/20260427000000_phase17_catalog_schema.sql`** — Raw-SQL migration: generated columns, UNIQUE CONSTRAINT, CHECK constraints, GIN indexes, updated_at trigger, RLS policies, sanity assertions
- **`tests/integration/phase17-schema.test.ts`** — CAT-01/03/04/12 structural assertions (8 tests)
- **`tests/integration/phase17-natural-key.test.ts`** — Natural-key dedup behavior (4 tests)
- **`tests/integration/phase17-catalog-rls.test.ts`** — RLS anon-read/write gates (8 tests)
- **`tests/integration/phase17-join-shape.test.ts`** — LEFT JOIN shape forward-compat (2 tests + 1 describe block)

## Test Results

All 27 phase17-* integration tests GREEN after Task 4 fixes:
- `phase17-schema.test.ts` — 8 passed
- `phase17-natural-key.test.ts` — 4 passed
- `phase17-catalog-rls.test.ts` — 8 passed
- `phase17-join-shape.test.ts` — 7 passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Natural-key conflict target: UNIQUE INDEX → UNIQUE CONSTRAINT**

- **Found during:** Task 4 (test run)
- **Issue:** Migration created a UNIQUE INDEX (`watches_catalog_natural_key_idx`). Tests used `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key_idx` which requires a named constraint, not an index. Postgres error: `constraint "watches_catalog_natural_key_idx" for table "watches_catalog" does not exist`.
- **Fix:** Migration section 3 rewritten to create a UNIQUE INDEX then promote it to a named UNIQUE CONSTRAINT via `ALTER TABLE watches_catalog ADD CONSTRAINT watches_catalog_natural_key UNIQUE USING INDEX watches_catalog_natural_key`. PG 17 supports this even for NULLS NOT DISTINCT indexes. Index is renamed to `watches_catalog_natural_key` (matches constraint name). Tests updated to reference `watches_catalog_natural_key`. Migration made idempotent via DO $$ block.
- **Files modified:** `supabase/migrations/20260427000000_phase17_catalog_schema.sql`, `tests/integration/phase17-natural-key.test.ts`, `tests/integration/phase17-schema.test.ts`
- **Commit:** f8066fc

**2. [Rule 1 - Bug] trgm opclass display normalization**

- **Found during:** Task 4 (test run)
- **Issue:** Test asserted `extensions.gin_trgm_ops` in pg_indexes.indexdef, but PG normalizes the opclass display to bare `gin_trgm_ops` when `extensions` is on the search_path. The index was correctly created with `extensions.gin_trgm_ops`, but `pg_get_indexdef()` strips the schema qualifier.
- **Fix:** Test regex updated to accept either `gin_trgm_ops` or `extensions.gin_trgm_ops`. Migration unchanged (still uses schema-qualified form at creation time, which is correct per MEMORY rule).
- **Files modified:** `tests/integration/phase17-schema.test.ts`
- **Commit:** f8066fc

**3. [Rule 1 - Bug] Supabase PostgREST RLS behavior for UPDATE/DELETE**

- **Found during:** Task 4 (test run)
- **Issue:** RLS UPDATE/DELETE tests expected `error !== null` and a `42501` code. But Supabase PostgREST returns HTTP 204 / `null` error when an UPDATE or DELETE matches 0 rows (because RLS prevents reading the target row). The security is correct — the row is NOT modified — but PostgREST doesn't surface it as an error to the client.
- **Fix:** UPDATE and DELETE test assertions rewritten to verify data integrity via service-role Drizzle client (confirm the row was not mutated / still exists) rather than expecting a client-side error. INSERT tests remain unchanged (PostgREST does return 42501 for INSERT because the policy check fires before row creation).
- **Files modified:** `tests/integration/phase17-catalog-rls.test.ts`
- **Commit:** f8066fc

**4. [Rule 1 - Bug] Reference normalization test expectation**

- **Found during:** Task 4 (test run)
- **Issue:** Test inserted `'116610LN_ref'` and expected `reference_normalized = '116610ln_ref'`. But `regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')` strips ALL non-alphanumeric characters including underscores. Result is `116610lnref`, not `116610ln_ref`.
- **Fix:** Test references changed to avoid underscores (`'116610LNref'`). Expected normalized value updated to `'116610lnref'`. Added comment explaining the stripping behavior.
- **Files modified:** `tests/integration/phase17-natural-key.test.ts`
- **Commit:** f8066fc

## Notes for Plan 02 (Catalog DAL Helpers)

**IMPORTANT: ON CONFLICT clause shape has changed from what was originally planned.**

The natural-key conflict target is now a **named CONSTRAINT**, not a bare index. Plan 02's catalog upsert helpers MUST use:

```sql
ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET ...
```

NOT the old index-based form. In Drizzle ORM, this translates to:

```typescript
await db.insert(watchesCatalog)
  .values(row)
  .onConflictDoUpdate({
    target: /* use sql conflict target */,
    // OR use the named constraint approach via sql``
  })
```

Since Drizzle's `.onConflictDoUpdate()` with `target:` uses column references (not constraint names), Plan 02 should use `db.execute(sql`... ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET ...`)` for upserts, or use `.onConflictDoNothing()` for simple insert-or-ignore.

**Catalog table is empty until Plan 02's DAL helpers land.** Plan 02 tests should seed via the new helpers, not raw INSERT.

**Reference normalization behavior:** `regexp_replace('[^a-z0-9]+', '', 'g')` strips ALL non-alphanumeric characters including spaces, dashes, dots, AND underscores. `'116610LN'`, `'116610 LN'`, `'116610-LN'`, `'116610.LN'` all normalize to `'116610ln'`.

## Notes for Plan 06 (Prod Deploy)

Production push (`supabase db push --linked`) is deferred until Plan 06. The local DB push was done via:
1. `npx drizzle-kit push` — column shapes (interactive confirmation required)
2. `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260427000000_phase17_catalog_schema.sql` — RLS + constraints + indexes

Plan 06 must document this in `docs/deploy-db-setup.md`.

## Known Stubs

None. The catalog table is intentionally empty at this stage — Plan 02 adds DAL helpers and Plan 04 backfills existing watches rows. No stubs exist that block this plan's goals.

## Threat Flags

None found. All security surface (RLS, CHECK constraints) was planned in the threat model and implemented. The service-role bypass is by design (Drizzle pooler writes).

## Self-Check: PASSED

- `src/db/schema.ts` — exists with watchesCatalog, watchesCatalogDailySnapshots, catalogId FK
- `src/lib/types.ts` — exists with CatalogSource, ImageSourceQuality, CatalogEntry
- `drizzle/0004_phase17_catalog.sql` — exists
- `supabase/migrations/20260427000000_phase17_catalog_schema.sql` — exists
- `tests/integration/phase17-schema.test.ts` — exists, 27/27 tests GREEN
- `tests/integration/phase17-natural-key.test.ts` — exists
- `tests/integration/phase17-catalog-rls.test.ts` — exists
- `tests/integration/phase17-join-shape.test.ts` — exists
- Commits 1acad3d, c573ad4, de24d84, f8066fc — all present on branch
