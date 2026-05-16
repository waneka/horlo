---
phase: 34-layer-a-brand-family-entities
verified: 2026-05-09T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 34: Layer A — Brand + Family Entities Verification Report

**Phase Goal:** Add `brands` and `watch_families` as first-class catalog entities with nullable FKs on `watches_catalog`, giving every higher-level hierarchy feature its foundation without touching any existing query path.

**Verified:** 2026-05-09
**Status:** PASSED
**Re-verification:** No (initial verification)

## Goal Achievement

### Roadmap Success Criteria — Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `brands` and `watch_families` tables exist in production with public-read RLS and service-role-write policies co-located in the migration file | VERIFIED | `supabase/migrations/20260510000000_phase34_brands_families.sql` lines 9-17 (CREATE TABLE brands), 37-45 (CREATE TABLE watch_families), 31-34 (RLS enable + brands_select_all + GRANT), 58-61 (RLS enable + watch_families_select_all + GRANT). 34-03-SUMMARY captures prod state: both tables exist (Dashboard-confirmed) |
| 2 | `watches_catalog.brand_id` (nullable FK) and `watches_catalog.family_id` (nullable FK) columns exist; all existing DAL queries return correct results without modification | VERIFIED | `src/db/schema.ts:341-342` declares both columns with callback FK refs and `onDelete: 'restrict'`. Supabase migration lines 64-66 ADD COLUMN with REFERENCES. 34-03-SUMMARY: prod confirms `uuid \| YES` for both. **DAL parity:** `git diff 73e49ba HEAD -- src/` shows only `src/db/schema.ts` changed (51 insertions); zero changes to `src/data/`. 31 `watchesCatalog` references in `src/data/{discovery,catalog}.ts` unmodified. Live render at /, /explore, /catalog/{id} confirmed no 5xx (34-03-SUMMARY §"DAL parity (live)") |
| 3 | `has_table_privilege('anon', 'public.brands', 'SELECT')` and `has_table_privilege('anon', 'public.watch_families', 'SELECT')` both return true in production — RLS verified in deploy runbook | VERIFIED | 34-03-SUMMARY: both `t` in prod via Dashboard SQL editor. Runbook §34.3 (`docs/deploy-db-setup.md` lines 613-618) documents the exact two queries with expected `t` result. Migration's final assertion DO block (lines 88-89, 97-98) raises if either privilege returns false — `supabase db push --linked` exited 0, so both passed |
| 4 | A service-role backfill script exists at `scripts/backfill-catalog-brands.ts` for manual brand/family assignment (no automated migration; no admin UI in this phase) | VERIFIED | `scripts/backfill-catalog-brands.ts` (157 lines) exists with 3 passes (passA derive lines 51-69, passB country patch lines 79-100, passC link lines 106-121). `package.json:17` declares `"db:backfill-catalog-brands": "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts"`. **No admin UI:** `find src/app -type d` shows no `admin`, `brand`, `family`, `brands`, or `families` route directories. 34-03-SUMMARY: prod backfill produced 6 brands, 9/9 catalog links, 0 unlinked |
| 5 | Three-step migration discipline (nullable column add → backfill → NOT NULL flip) is documented in phase CONTEXT.md; the NOT NULL flip is explicitly deferred | VERIFIED | `34-CONTEXT.md` D-05 (lines 104-107) numbers the 3 steps and explicitly marks Step 3 as "DEFERRED. Explicitly NOT scheduled". `34-CONTEXT.md` line 15 in domain block also restates "explicitly defers the NOT NULL flip beyond Phase 34". `docs/deploy-db-setup.md` §34.5 (lines 634-638) re-documents the discipline in the runbook with "Step 3 (DEFERRED, no target phase)". **No NOT NULL flip migration exists:** `grep -rn "SET NOT NULL" supabase/migrations/` returns no matches against brand_id/family_id |

**Score:** 5/5 truths verified

### Locked Decisions D-01 through D-06 — Compliance Check

| Decision | Status | Evidence |
|----------|--------|----------|
| D-01 column shape (verbatim) | VERIFIED | `src/db/schema.ts:355-372` (brands) + `374-392` (watch_families) match CONTEXT D-01 column-for-column. Supabase migration lines 9-17 + 37-45 same. `country_of_origin text NULL` on brands present (line 14). `brand_id NOT NULL REFERENCES brands(id) ON DELETE RESTRICT` on watch_families (line 39) |
| D-01a slug uniqueness | VERIFIED | `brands.slug text NOT NULL` (supabase line 13) + `brands_slug_unique` constraint (line 19-20). `watch_families.slug text` nullable (line 42). `(brand_id, name_normalized)` composite unique constraint (lines 47-49) |
| D-01b slug NOT GENERATED | VERIFIED | Schema declares `slug: text('slug').notNull().unique()` (line 364) — no `generatedAlwaysAs()` modifier. Backfill `passA_deriveBrands` (line 57) sets slug explicitly via `lower(regexp_replace(trim(brand), '\s+', '-', 'g'))` per D-01b |
| D-02 ON DELETE RESTRICT | VERIFIED | All 3 FKs use RESTRICT: `watch_families.brand_id` (supabase line 39), `watches_catalog.brand_id` + `watches_catalog.family_id` (supabase lines 65-66). Drizzle migration lines 43, 56, 69 use `ON DELETE restrict`. Drizzle schema lines 341-342 + 379 use `{ onDelete: 'restrict' }` |
| D-03 hybrid backfill | VERIFIED | 34-03-SUMMARY: prod brands=6 (populated); watch_families=0 (correctly empty per D-03); 9/9 catalog rows linked. Script has NO family-backfill code paths (passA/B/C are brand-only) — confirmed by reading lines 51-121 |
| D-04 permanent denormalization | VERIFIED | `src/db/schema.ts:285` retains `brand: text('brand').notNull()` on `watchesCatalog`. No `DROP COLUMN brand` in any phase 34 migration. Deploy runbook §34.5/§34.7 makes no mention of dropping the column |
| D-05 three-step discipline | VERIFIED | See SC#5 above |
| D-06 deploy runbook update | VERIFIED | `docs/deploy-db-setup.md` §34.0–§34.7 (lines 554-667) covers: pg_depend pre-flight, supabase push + drizzle migrate, RLS smoke queries, backfill invocation, three-step discipline, DAL parity, backout plan. Local-reset workflow updated at line 406 with the new migration filename |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` brands export | `export const brands = pgTable(...)` | VERIFIED | Lines 355-372. GENERATED nameNormalized (line 361-363); slug UNIQUE NOT NULL (line 364); countryOfOrigin nullable (line 365); composite unique on nameNormalized (line 370) |
| `src/db/schema.ts` watchFamilies export | `export const watchFamilies = pgTable(...)` | VERIFIED | Lines 374-392. brandId NOT NULL with onDelete restrict (line 379); GENERATED nameNormalized; slug nullable; composite unique (brandId, nameNormalized) (line 390) |
| `src/db/schema.ts` watchesCatalog FK columns | `brandId` + `familyId` with onDelete restrict | VERIFIED | Lines 341-342: `brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'restrict' })` + `familyId: uuid('family_id').references(() => watchFamilies.id, { onDelete: 'restrict' })` |
| `drizzle/0007_phase34_brands_families.sql` | Idempotent CREATE TABLE / ADD COLUMN / FK guards | VERIFIED | 74 lines. CREATE TABLE IF NOT EXISTS brands (line 7), watch_families (line 19); ADD COLUMN IF NOT EXISTS brand_id/family_id (lines 30-31); 3 DO-block FK guards keyed on pg_constraint.conname (lines 33-71); 3 CREATE INDEX IF NOT EXISTS (lines 72-74) |
| `drizzle/meta/_journal.json` | Entry with tag `0007_phase34_brands_families` | VERIFIED | Line 58: `"tag": "0007_phase34_brands_families"` at idx=7 (line 55). Sequential after `0006_phase27_sort_order` |
| `supabase/migrations/20260510000000_phase34_brands_families.sql` | RLS + GENERATED + assertions | VERIFIED | 101 lines, 14-digit timestamp filename. CREATE TABLE brands+watch_families with GENERATED columns (lines 12, 41); CREATE POLICY brands_select_all + watch_families_select_all (lines 33, 60); GRANT SELECT TO anon, authenticated (lines 34, 61); ON DELETE RESTRICT on all 3 FKs (lines 39, 65-66); final DO block with 8 RAISE EXCEPTION guards (lines 91-98); BEGIN/COMMIT transaction wrap |
| `scripts/backfill-catalog-brands.ts` | 3-pass derive→patch→link, idempotent | VERIFIED | 157 lines. passA_deriveBrands (lines 51-69) with `ON CONFLICT (name_normalized) DO NOTHING`; passB_patchCountry (lines 79-100) with `WHERE country_of_origin IS NULL` filter; passC_linkCatalog (lines 106-121) with `WHERE wc.brand_id IS NULL` filter. Final assertion (lines 133-147) raises if any catalog row's brand_id remains unlinked. Uses Drizzle `sql` template tag for parameterization (T-34-05 mitigation) |
| `scripts/country.json` | 44 normalized brand-country entries | VERIFIED | 46 lines, valid JSON, 44 entries (Python json.load confirmed). All keys are `name_normalized` form (lowercase trimmed); values are ISO country names. Includes the 3 actual local-catalog brands (nomos glashütte, mühle glashütte, héron watches) per W5 spec adjustment |
| `package.json` `db:backfill-catalog-brands` | npm script entry | VERIFIED | Line 17: `"db:backfill-catalog-brands": "tsx --env-file=.env.local scripts/backfill-catalog-brands.ts"` — matches Phase 17 `db:backfill-catalog` pattern with `--env-file=.env.local` for service-role DATABASE_URL |
| `tests/integration/phase34-rls.test.ts` | 11 RLS + introspection tests | VERIFIED | 131 lines, exactly 11 `it(` blocks. Covers: T-34-02 anon read (4 tests, lines 32-60), T-34-01 anon write blocked (2 tests, lines 63-79), CAT-15 SC#2 schema introspection (2 tests, lines 82-100), CAT-15 SC#1 GENERATED columns (2 tests, lines 103-119), T-34-03 FK orphan (1 test, lines 122-130). Localhost-assertion guard at lines 19-25 |
| `docs/deploy-db-setup.md` Phase 34 section | §34.0–§34.7 | VERIFIED | Lines 554-667 contain the full Phase 34 section. §34.3 contains both `has_table_privilege` smoke queries (lines 615-616). §34.5 documents the three-step discipline with explicit DEFERRED note for Step 3 (line 638). §34.7 backout plan with post-Phase-35 caveat |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/db/schema.ts` watchesCatalog.brandId | `brands.id` | `references(() => brands.id, { onDelete: 'restrict' })` | WIRED | Line 341 — callback form (Pitfall 1 avoidance), correct table ref, restrict semantics |
| `src/db/schema.ts` watchesCatalog.familyId | `watchFamilies.id` | `references(() => watchFamilies.id, { onDelete: 'restrict' })` | WIRED | Line 342 — callback form, correct table ref |
| `src/db/schema.ts` watchFamilies.brandId | `brands.id` | `references(() => brands.id, { onDelete: 'restrict' })` | WIRED | Line 379 — NOT NULL FK enforces "family belongs to brand" invariant |
| Supabase migration | Phase 17 RLS pattern | `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... FOR SELECT USING (true)` + `GRANT SELECT TO anon, authenticated` | WIRED | Lines 31-34 (brands), 58-61 (watch_families). Mirrors Phase 17's `20260427000000_phase17_catalog_schema.sql` verbatim. No INSERT/UPDATE/DELETE policy = service-role-only writes (T-34-01 mitigation) |
| Backfill script | brands table | `INSERT INTO brands ... ON CONFLICT (name_normalized) DO NOTHING` | WIRED | Lines 53-65 — uses GENERATED name_normalized as conflict target; idempotent |
| Backfill script | watches_catalog.brand_id | `UPDATE watches_catalog wc SET brand_id = b.id FROM brands b WHERE wc.brand_normalized = b.name_normalized` | WIRED | Lines 109-114 — joins on GENERATED normalized columns; `WHERE wc.brand_id IS NULL` for idempotence |
| Drizzle journal | drizzle-kit migrate awareness of 0007 | idx=7 entry with tag `0007_phase34_brands_families` | WIRED | Line 55-58 of `drizzle/meta/_journal.json` |
| package.json | backfill script | `tsx --env-file=.env.local scripts/backfill-catalog-brands.ts` | WIRED | Line 17 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `brands` table (prod) | brand rows | `passA_deriveBrands` reads `watches_catalog.brand` distinct values | Yes (6 rows in prod per 34-03-SUMMARY) | FLOWING |
| `watches_catalog.brand_id` (prod) | linked FK values | `passC_linkCatalog` joins on `brand_normalized = name_normalized` | Yes (9/9 rows linked per 34-03-SUMMARY; unlinked_with_brand=0) | FLOWING |
| `watch_families` table (prod) | family rows | Intentionally empty (D-03 — Phase 35 territory) | N/A by design | NOT APPLICABLE (correctly empty) |
| `watches_catalog.family_id` (prod) | linked FK values | Intentionally NULL on every row (D-03) | N/A by design | NOT APPLICABLE (correctly null) |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `country.json` is valid JSON | `python3 -c "import json; json.load(open('scripts/country.json'))"` | Loaded; 44 entries | PASS |
| `package.json` script entry exists | `grep "db:backfill-catalog-brands" package.json` | Line 17 matches | PASS |
| Drizzle journal entry exists | `grep "0007_phase34_brands_families" drizzle/meta/_journal.json` | Line 58 match at idx=7 | PASS |
| `src/db/schema.ts` exports brands | `grep "export const brands = pgTable" src/db/schema.ts` | 1 match (line 355) | PASS |
| `src/db/schema.ts` exports watchFamilies | `grep "export const watchFamilies = pgTable" src/db/schema.ts` | 1 match (line 374) | PASS |
| `watches_catalog.brand` text column retained (D-04) | `grep "brand: text" src/db/schema.ts` | 2 matches (line 54 watches, line 285 watchesCatalog) | PASS |
| Migration filename matches 14-digit rule | `ls supabase/migrations/ \| grep phase34` | `20260510000000_phase34_brands_families.sql` (14 digits, no suffix letters) | PASS |
| Test file has 11 tests | `grep -c "it(" tests/integration/phase34-rls.test.ts` | 11 | PASS |
| Phase 34 source-code touch limited to schema.ts | `git diff 73e49ba HEAD -- src/` | only `src/db/schema.ts` changed (51 insertions) | PASS |
| No NOT NULL flip migration shipped | `grep -rn "SET NOT NULL" supabase/migrations/ \| grep -i "brand_id\|family_id"` | 0 matches | PASS |
| No GIN trgm index on brands | `grep "gin_trgm_ops\|USING gin" supabase/migrations/20260510000000*` | 0 matches | PASS |
| No /brand or /family route pages | `find src/app -type d -name "brand*" -o -name "family*"` | 0 matches | PASS |
| No admin UI for brand/family | `find src/app -type d -name admin` | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAT-15 | All 4 plans | New `brands` and `watch_families` tables with public-read RLS + service-role-write. Nullable `brand_id` FK and nullable `family_id` FK added to `watches_catalog`. Existing DAL queries continue working unchanged. Backfill is manual via service-role scripts; no automated migration. Three-step migration discipline. | SATISFIED | All 5 ROADMAP success criteria VERIFIED above. Tables shipped with RLS (SC#1); FK columns added with DAL parity (SC#2); RLS truth values `t` in prod (SC#3); backfill script exists at expected path (SC#4); three-step discipline documented in CONTEXT.md and runbook with NOT NULL flip explicitly deferred (SC#5) |

No orphaned requirements — Phase 34 has exactly one requirement (CAT-15) and all 5 success criteria are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | TODO/FIXME/PLACEHOLDER | — | Anti-pattern grep returned no matches across all Phase 34 source files (`schema.ts`, both migrations, backfill script, test file) |

### Scope Creep Check

| Deferred Item | Verified Not-Crept | Evidence |
|--------------|--------------------|----------|
| `/brand/{id}` browse pages | YES | No `src/app/brand` directory; no `src/app/[brand]` route |
| `/family/{id}` browse pages | YES | No `src/app/family` directory |
| Admin UI for brand/family CRUD | YES | No `src/app/admin` directory |
| NOT NULL flip migration on brand_id/family_id | YES | No migration in `supabase/migrations/` performs `SET NOT NULL` on either column |
| GIN trgm index on `brands.name_normalized` | YES | No `gin_trgm_ops` or `USING gin` in Phase 34 migration |
| watch_families seeding in Phase 34 | YES | Backfill script has zero family-population code paths; 34-03-SUMMARY confirms watch_families=0 in prod |
| Rich brand columns (founding_year, logo_url, parent_brand_id) | YES | Schema lines 355-372 contain only the D-01 minimal+ columns |
| Drop of `watches_catalog.brand` text (D-04 permanent denormalization) | YES | `brand: text('brand').notNull()` retained at schema.ts:285 |

### Discovered Drift (Pre-existing, INFO-level only)

**Drizzle journal sync drift** — Prod's `drizzle.__drizzle_migrations` table contains exactly 1 row (`idx=0 0000_flaky_lenny_balinger`); none of phases 8/12/17/19.1/27 ever recorded their drizzle migrations in prod's journal because they all shipped via `supabase db push --linked` only. Phase 34's schema is correctly applied in prod regardless — `supabase db push --linked` is the load-bearing prod-apply step; `drizzle-kit migrate` is bookkeeping.

**Severity:** INFO (NOT a Phase 34 regression).
**Disposition:** Filed as follow-up DEBT in 34-03-SUMMARY (orchestrator Task #12). The repair is `INSERT INTO drizzle.__drizzle_migrations` with 7 rows of historical hashes — out of Phase 34 scope. No ROADMAP success criterion mentions drizzle journal sync. Phase 34's prod schema state is correct (verified via Dashboard SQL: tables exist, RLS=t/t, columns nullable uuid, GENERATED=t/t, pg_depend +4, brands populated 6/0, catalog linked 9/9).

### Human Verification Required

None. All 5 ROADMAP success criteria are verifiable via codebase artifacts and prod-state evidence already captured in 34-03-SUMMARY (Dashboard SQL queries with documented `t/t` results, exact row counts, and live-render parity check). The interactive narration mode used in Plan 03 already had the operator perform the human-eyeball check on home/explore/catalog page renders, with no 5xx observed.

### Gaps Summary

No gaps found. Phase 34 delivered all 5 ROADMAP success criteria; all 6 LOCKED user decisions (D-01 through D-06) are honored verbatim in the shipped artifacts; no scope-creep items appear in the codebase; the production schema and backfill state match documented evidence in 34-03-SUMMARY.

The single noted observation — drizzle journal drift — is pre-existing across multiple prior phases (8/12/17/19.1/27), not caused by Phase 34, has been filed as follow-up DEBT, and does not appear in any Phase 34 success criterion. Phase 34's prod schema is correctly applied via the `supabase db push --linked` path.

---

_Verified: 2026-05-09_
_Verifier: Claude (gsd-verifier, Opus 4.7 1M)_
