---
phase: 34
plan: 01
subsystem: schema
tags:
  - schema
  - rls
  - drizzle
  - supabase
  - migration
  - phase34
  - cat-15
  - layer-a
dependency_graph:
  requires:
    - src/db/schema.ts (existing watchesCatalog block)
    - drizzle/0006_phase27_sort_order.sql (sequencing predecessor)
    - supabase/migrations/20260427000000_phase17_catalog_schema.sql (RLS pattern template)
    - supabase/migrations/20260504120000_phase27_sort_order.sql (timestamp predecessor)
  provides:
    - brands table (uuid PK, GENERATED name_normalized, slug UNIQUE NOT NULL, country_of_origin nullable)
    - watch_families table (uuid PK, brand_id NOT NULL FK ON DELETE RESTRICT, GENERATED name_normalized, composite UNIQUE)
    - watches_catalog.brand_id nullable FK (ON DELETE RESTRICT)
    - watches_catalog.family_id nullable FK (ON DELETE RESTRICT)
    - public-read RLS policies (brands_select_all, watch_families_select_all)
    - GRANT SELECT TO anon, authenticated on both new tables
    - Drizzle exports: brands, watchFamilies (consumable in Plan 02 backfill + future phases)
  affects:
    - Plan 02 (backfill script) — depends on these tables existing for INSERT/UPDATE
    - Plan 03 (production push) — depends on both migrations being authored + idempotent
    - Phase 35 (Layer B) — populates watch_families during lineage_edges curation
tech-stack:
  added: []
  patterns:
    - GENERATED ALWAYS AS (lower(trim(name))) STORED columns (Phase 17 D-02/D-03 inheritance)
    - Public-read + service-role-write RLS (no INSERT/UPDATE/DELETE policy = service_role only)
    - Drizzle FK callback form `() => brands.id` (lazy resolution; Pitfall 1 avoidance)
    - Idempotent migration guards (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO-block FK guards)
    - Drizzle migration self-idempotent (departure from Phase 17 dual-file pattern)
    - DO $$ assertion block at end of Supabase migration (8 RAISE EXCEPTION guards)
key-files:
  created:
    - drizzle/0007_phase34_brands_families.sql
    - supabase/migrations/20260510000000_phase34_brands_families.sql
    - tests/integration/phase34-rls.test.ts
  modified:
    - src/db/schema.ts (+51 lines: brands export, watchFamilies export, brandId/familyId on watchesCatalog)
    - drizzle/meta/_journal.json (+1 entry: idx=7, tag=0007_phase34_brands_families)
decisions:
  - D-01 minimal+ table shape (LOCKED) — country_of_origin on brands; deferred rich columns
  - D-01a slug UNIQUE NOT NULL on brands; nullable on watch_families
  - D-01b slug NOT GENERATED — set explicitly by Plan 02 backfill
  - D-02 ON DELETE RESTRICT on watches_catalog.brand_id, family_id, watch_families.brand_id
  - D-04 permanent denormalization — watches_catalog.brand text retained
  - D-05 NOT NULL flip explicitly DEFERRED beyond Phase 34
  - W1 (planning checker iteration 1) — Drizzle migration self-idempotent (CREATE TABLE IF NOT EXISTS + DO-block FK guards) so it survives running after supabase db push --linked
  - W2 (planning checker iteration 2) — drizzle/meta/_journal.json updated with idx=7 entry so drizzle-kit migrate recognizes 0007 as pending
metrics:
  duration: ~5 minutes
  completed_date: 2026-05-09
  tasks_completed: 3
  files_created: 3
  files_modified: 2
  commits: 3
  threats_mitigated: 3 (T-34-01, T-34-02, T-34-03)
  tests_added: 11
---

# Phase 34 Plan 01: Schema Layer Summary

Added `brands` and `watch_families` tables (Drizzle exports + idempotent Drizzle migration + authoritative Supabase migration) with public-read RLS, service-role-write enforcement, GENERATED `name_normalized` columns, and `ON DELETE RESTRICT` FK columns on `watches_catalog`; integration test suite covers all three threat mitigations.

## What Shipped

### New Drizzle Exports (`src/db/schema.ts`)

**`brands`** — first-class brand entity table:
- `id uuid PK DEFAULT gen_random_uuid()`
- `name text NOT NULL`
- `nameNormalized text GENERATED ALWAYS AS (lower(trim(name))) STORED` (Phase 17 D-02/D-03 inheritance)
- `slug text NOT NULL UNIQUE` (URL-stable identifier per D-01a)
- `countryOfOrigin text NULLABLE` (D-01 user exception for v6.0/future taste-signal use)
- `createdAt`, `updatedAt timestamptz NOT NULL DEFAULT now()`
- Composite unique constraint: `brands_name_normalized_unique` on `(nameNormalized)`

**`watchFamilies`** — first-class family entity table (empty in Phase 34, populated in Phase 35):
- `id uuid PK`
- `brandId uuid NOT NULL` references `brands.id` ON DELETE RESTRICT
- `name`, `nameNormalized` (GENERATED), `slug` nullable
- `createdAt`, `updatedAt`
- Composite unique: `watch_families_brand_name_unique` on `(brandId, nameNormalized)`

### New FK Columns on `watchesCatalog`

Inserted between `extractedFromPhoto` and `createdAt`:
- `brandId uuid` references `brands.id` ON DELETE RESTRICT (nullable per D-05 step 1)
- `familyId uuid` references `watchFamilies.id` ON DELETE RESTRICT (nullable per D-05 step 1)

Callback FK form `() => brands.id` used (Pitfall 1 avoidance; matches `watches.catalogId` pattern at `schema.ts:101`).

### Migration Files

**Drizzle migration:** `drizzle/0007_phase34_brands_families.sql`
- Self-idempotent (W1 fix): `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, DO-block FK guards keyed on `pg_constraint.conname`
- Departure from Phase 17 (which used dual-file pattern with separate IF-NOT-EXISTS port migration)
- Verified idempotent: applies cleanly post-supabase-apply with only `NOTICE: ... already exists, skipping`; second consecutive apply also exits 0

**Drizzle journal:** `drizzle/meta/_journal.json` (W2 fix)
- Appended entry: `{ idx: 7, version: "7", when: 1778339534536, tag: "0007_phase34_brands_families", breakpoints: true }`
- Without this entry, Plan 03's `drizzle-kit migrate` would silently skip 0007 in prod

**Supabase migration:** `supabase/migrations/20260510000000_phase34_brands_families.sql` (May 10 2026 00:00:00 UTC; > current max `20260504120000`)
- Single `BEGIN ... COMMIT` transaction
- Both tables with GENERATED columns, RLS enabled, `_select_all` policies, GRANT SELECT to anon+authenticated
- `updated_at` triggers (table-prefixed function names: `brands_set_updated_at`, `watch_families_set_updated_at`)
- `watches_catalog` FK column adds + indexes
- Final `DO $$` assertion block with **8 RAISE EXCEPTION guards** (one per claimed feature)
- All 3 ON DELETE RESTRICT FKs

### Integration Test Suite (`tests/integration/phase34-rls.test.ts`)

11 tests covering:
- T-34-02 anon read enabled (4 tests): `has_table_privilege` truth values + anon-client `.select()` works for both tables
- T-34-01 anon write blocked (2 tests): anon-client `.insert()` returns RLS error matching `/42501|RLS|policy|permission|not allowed|insufficient/i`
- CAT-15 SC#2 schema introspection (2 tests): `watches_catalog.brand_id` and `family_id` exist as nullable uuid
- CAT-15 SC#1 GENERATED columns (2 tests): `brands.name_normalized` and `watch_families.name_normalized` are `is_generated = 'ALWAYS'`
- T-34-03 FK orphan prevention (1 test): INSERT with non-existent `brand_id` throws FK violation

Pitfall 4 mitigation: localhost-assertion guard skips tests if `DATABASE_URL` doesn't contain `localhost` or `127.0.0.1` — improvement on Phase 17 precedent.

**Test results:** 11/11 PASS locally with env vars sourced from `.env.local`; 11/11 SKIP cleanly without env vars (acceptable for CI).

## Verification Evidence

### Idempotence Test (W1 evidence)

```
=== Drizzle migration apply (1st time, post-supabase-apply) ===
NOTICE:  relation "brands" already exists, skipping
NOTICE:  relation "watch_families" already exists, skipping
NOTICE:  column "brand_id" of relation "watches_catalog" already exists, skipping
NOTICE:  column "family_id" of relation "watches_catalog" already exists, skipping
NOTICE:  relation "watch_families_brand_id_idx" already exists, skipping
NOTICE:  relation "watches_catalog_brand_id_idx" already exists, skipping
NOTICE:  relation "watches_catalog_family_id_idx" already exists, skipping
1st apply exit code: 0

=== Drizzle migration apply (2nd time, idempotent re-run) ===
[same NOTICE lines]
2nd apply exit code: 0
```

No `ERROR:` lines in either run.

### RLS Truth Values (T-34-02 evidence)

```
 brands_can | families_can
------------+--------------
 t          | t
```

### pg_depend Delta on `public.watches_catalog`

- BEFORE migration apply: 27
- AFTER migration apply: 33
- Delta: +6 (≥2 required; covers brand_id col, family_id col, two FKs, two indexes)

### Drizzle Journal Entry (W2 evidence)

```json
{
  "idx": 7,
  "version": "7",
  "when": 1778339534536,
  "tag": "0007_phase34_brands_families",
  "breakpoints": true
}
```

Both shape assertions PASS: `idx === 7`, `breakpoints === true`, `typeof when === 'number'`.

### Acceptance Grep Counts (all PASS)

| Check | Expected | Actual |
|-------|----------|--------|
| `export const brands = pgTable` in schema.ts | 1 | 1 |
| `export const watchFamilies = pgTable` in schema.ts | 1 | 1 |
| `brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'restrict' })` | 1 | 1 |
| `familyId: uuid('family_id').references(() => watchFamilies.id, { onDelete: 'restrict' })` | 1 | 1 |
| `lower(trim(name))` in schema.ts | ≥2 | 3 |
| `CREATE TABLE IF NOT EXISTS "brands"` in 0007 | 1 | 1 |
| `CREATE TABLE IF NOT EXISTS "watch_families"` in 0007 | 1 | 1 |
| `ADD COLUMN IF NOT EXISTS "brand_id"` in 0007 | 1 | 1 |
| `ADD COLUMN IF NOT EXISTS "family_id"` in 0007 | 1 | 1 |
| DO-block FK guards (3 conname checks) in 0007 | ≥3 | 3 |
| `CREATE INDEX IF NOT EXISTS` in 0007 | ≥3 | 3 |
| `ON DELETE restrict` in 0007 | ≥3 | 3 |
| `CREATE TABLE IF NOT EXISTS brands` in supabase | 1 | 1 |
| `CREATE TABLE IF NOT EXISTS watch_families` in supabase | 1 | 1 |
| `CREATE POLICY brands_select_all` in supabase | 1 | 1 |
| `CREATE POLICY watch_families_select_all` in supabase | 1 | 1 |
| `GRANT SELECT ON brands TO anon, authenticated` | 1 | 1 |
| `GRANT SELECT ON watch_families TO anon, authenticated` | 1 | 1 |
| `ON DELETE RESTRICT` in supabase | ≥3 | 3 |
| `RAISE EXCEPTION 'Phase 34 failed` in supabase | ≥8 | 8 |
| Test file: `has_table_privilege` for brands | 1 | 1 |
| Test file: `has_table_privilege` for watch_families | 1 | 1 |
| Test file: T-34-01..03 references | ≥3 | 13 |
| Test file: localhost guard | ≥2 | 3 |

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | feat | 5437048 | add brands + watchFamilies Drizzle exports + FK columns on watchesCatalog |
| 2 | feat | 70d701b | author Drizzle + Supabase migrations for brands/watch_families |
| 3 | test | 5a47079 | add Phase 34 RLS + schema introspection integration tests |

## Threat Mitigation Status

| Threat | Status | Evidence |
|--------|--------|----------|
| T-34-01 (anon write tampering) | mitigated | RLS enabled with no INSERT/UPDATE/DELETE policy; Tests 5+6 in `phase34-rls.test.ts` confirm anon-client INSERT raises RLS error matching the regex |
| T-34-02 (anon read failure) | mitigated | `brands_select_all` + `watch_families_select_all` policies with USING (true) + GRANT SELECT TO anon, authenticated; final assertion DO block has `RAISE EXCEPTION` if `has_table_privilege('anon', ...)` returns false; Tests 1-4 confirm both privilege values + anon-client SELECT |
| T-34-03 (FK orphans) | mitigated | All 3 FKs declared `ON DELETE RESTRICT`; Test 11 (`FK integrity`) confirms INSERT with non-existent brand_id throws |

## Deviations from Plan

None — plan executed exactly as written. All verbatim SQL/TS from PLAN.md preserved.

Note: A pre-existing Phase 17 SECDEF integration test failure exists locally (function `public.refresh_watches_catalog_counts()` is missing from local Docker DB). Verified this failure pre-dates Phase 34 work by checking out `src/db/schema.ts` from before Phase 34 and re-running — the failure persists, confirming it is not a Phase 34 regression. Production has the function (created by `supabase/migrations/20260427000001_phase17_pg_cron.sql`); local Docker DB needs a `supabase db reset` + selective migration apply to restore. This is out-of-scope for Phase 34 Plan 01 and is documented for future local-env restoration.

## Authentication Gates

None — all work was schema/migration/test authoring with local Docker DB (no auth required).

## Self-Check: PASSED

**Files verified to exist:**
- FOUND: src/db/schema.ts (modified, brands + watchFamilies + FK columns confirmed via grep)
- FOUND: drizzle/0007_phase34_brands_families.sql
- FOUND: drizzle/meta/_journal.json (with new idx=7 entry)
- FOUND: supabase/migrations/20260510000000_phase34_brands_families.sql
- FOUND: tests/integration/phase34-rls.test.ts

**Commits verified to exist (`git log --oneline --all`):**
- FOUND: 5437048 feat(34-01): add brands + watchFamilies Drizzle exports + FK columns on watchesCatalog
- FOUND: 70d701b feat(34-01): author Drizzle + Supabase migrations for brands/watch_families
- FOUND: 5a47079 test(34-01): add Phase 34 RLS + schema introspection integration tests

**Live DB state verified:**
- FOUND: brands table exists, RLS enabled, anon SELECT privilege = true
- FOUND: watch_families table exists, RLS enabled, anon SELECT privilege = true
- FOUND: watches_catalog.brand_id and watches_catalog.family_id columns exist
- FOUND: All 3 FKs in pg_constraint with `confdeltype = 'r'` (RESTRICT)

## Hand-off to Plan 02 (Backfill Script)

The schema layer is now in place locally. Plan 02 should:
1. Author `scripts/backfill-catalog-brands.ts` (Phase 17 `backfill-catalog.ts` template)
2. Author `scripts/country.json` operator-edited data file
3. Add `package.json` `db:backfill-catalog-brands` npm script entry
4. Run script locally to verify 3-pass logic (passA derive, passB country patch, passC catalog FK link)
5. Confirm idempotent re-run is no-op

Plan 03 then ships migrations + script to production via `supabase db push --linked` + `npx drizzle-kit migrate` + `DATABASE_URL=<prod> npm run db:backfill-catalog-brands`.
