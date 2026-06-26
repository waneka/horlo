---
phase: 80-not-null-constraint-flip-ingest-hardening
plan: 04
subsystem: database
tags: [postgres, drizzle, migration, not-null, schema, canon-01, canon-02]

# Dependency graph
requires:
  - phase: 80-03
    provides: both upsert helpers writing non-NULL brand_id + family_id (VALIDATION-80-03-01 closed)
provides:
  - watches_catalog.brand_id: NOT NULL constraint live on local Supabase (CANON-01)
  - watches_catalog.family_id: NOT NULL constraint live on local Supabase (CANON-02)
  - 20260626000000_phase80_catalog_brand_family_not_null.sql: prod-portable migration ready for Plan 05
affects:
  - 80-05 (POST-DEPLOY runbook + prod push: migration file is ready; operator runs supabase db push --linked)
  - Phase 81 RECO-01/02 (JOIN-through FKs now safe — no NULL defense needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle .notNull().references(...) — correct method ordering in schema.ts"
    - "BEGIN/COMMIT transactional wrapper on DDL migration with DO $$ pre-flight + post-flight"
    - "Pre-flight predicate: row-count IS NULL (count violating rows) — catches data problem"
    - "Post-flight predicate: information_schema.columns is_nullable (resulting schema state) — DIFFERENT from pre-flight per [[post-flight-assertion-predicate-divergence]]"
    - "drizzle-kit push for local; hand-written SQL for prod — [[drizzle-supabase-db-mismatch]] two-path pattern"

key-files:
  created:
    - supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql
  modified:
    - src/db/schema.ts

key-decisions:
  - "Timestamp 20260626000000 verified to sort after 20260624000000_phase78 (gotcha #1 + #2 from [[drizzle-supabase-db-mismatch]])"
  - "Pre-flight and post-flight DO $$ blocks use DISTINCT predicates: count-IS-NULL vs information_schema.is_nullable (per [[post-flight-assertion-predicate-divergence]])"
  - "drizzle-kit push applied cleanly (confirmed via truncation NOTICEs only — not errors); psql application also clean"
  - "Build failure in scripts/v8.4-brand-canonicalization.ts:980 is pre-existing baseline noise — not caused by this plan (same error documented in 80-03-SUMMARY.md)"
  - "CANON-01/02 integration tests: 3/3 GREEN after migration; resolver regression: 4/4 GREEN (constraint did not break resolver)"

# Metrics
duration: ~8min
completed: 2026-06-25
tasks-completed: 3
files-changed: 2
---

# Phase 80 Plan 04: NOT NULL Constraint Flip (Schema + Migration) — Summary

**One-liner:** Drizzle schema flipped `.notNull()` on `brand_id`/`family_id`, hand-written BEGIN/COMMIT migration with divergent-predicate DO $$ guards applied locally — CANON-01 and CANON-02 integration tests green 3/3; prod push deferred to Plan 05.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update Drizzle schema — add `.notNull()` to `watchesCatalog.brandId` + `.familyId` | 68db42a8 | src/db/schema.ts |
| 2 | Write hand-written prod-portable migration SQL file | e28cbf3f | supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql |
| 3 | LOCAL push + green CANON-01/02 integration tests | d0a08cf7 | (no file modifications — DB + test verification) |

## What Was Done

### Task 1 — Drizzle schema update

Updated `src/db/schema.ts` § `watchesCatalog` lines 501-505:

- Comment block updated from "Phase 34 D-02: nullable FKs" to "Phase 80 CANON-01/02: brand + family FKs flipped to NOT NULL" (audit trail preserved, rationale updated)
- `brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'restrict' })` — CANON-01
- `familyId: uuid('family_id').notNull().references(() => watchFamilies.id, { onDelete: 'restrict' })` — CANON-02
- `.notNull()` placed BEFORE `.references(...)` (correct Drizzle method order)
- `npm run lint -- src/db/schema.ts` passed (exit 0)
- Diff: 5 insertions + 4 deletions (~21 diff lines including comment update)

### Task 2 — Hand-written migration SQL

Created `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` (100 lines).

Structure:
1. **Header comment block** — cites CANON-01/02, Phase 79 MIG-04 precondition, D-80-03 staged-deploy sequencing, `[[drizzle-supabase-db-mismatch]]` filename ordering, `[[post-flight-assertion-predicate-divergence]]` divergent-predicate note
2. **`BEGIN;`** wrapper
3. **Pre-flight DO $$ block** — counts `WHERE brand_id IS NULL` and `WHERE family_id IS NULL`; RAISE EXCEPTION with operator message if either > 0
4. **`ALTER TABLE watches_catalog ALTER COLUMN brand_id SET NOT NULL;`** (CANON-01)
5. **`ALTER TABLE watches_catalog ALTER COLUMN family_id SET NOT NULL;`** (CANON-02)
6. **Post-flight DO $$ block** — reads `is_nullable` from `information_schema.columns` for both columns; RAISE EXCEPTION if either is not `'NO'`
7. **`COMMIT;`** wrapper

Timestamp verification: `20260626000000` sorts after `20260624000000_phase78_aliases_needs_review.sql` (confirmed via `ls | sort | tail -1`).

Predicate divergence confirmed:
- Pre-flight: `WHERE brand_id IS NULL` (row-count — catches data violation)
- Post-flight: `information_schema.columns.is_nullable` (schema metadata — distinct resulting-state check)

### Task 3 — Local push + test verification

**Pre-flight check:** Zero NULL rows in both columns (confirmed via psql count queries).

**Path A — drizzle-kit push:**
```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx drizzle-kit push
✓ Changes applied
```
Two NOTICE messages about FK name truncation — these are cosmetic identifier-length warnings (not errors), same as pre-existing behavior.

**Path B — raw SQL:**
```
psql ... -f supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql
BEGIN / DO / ALTER TABLE / ALTER TABLE / DO / COMMIT
```
Pre-flight DO $$ passed (0 NULLs). ALTERs applied. Post-flight DO $$ confirmed `is_nullable = 'NO'` for both columns.

**Schema verification:**
```
column_name | is_nullable
brand_id    | NO
family_id   | NO
```

**Integration tests — 3/3 GREEN:**
```
✓ brand_id is NOT NULL in information_schema (CANON-01)
✓ family_id is NOT NULL in information_schema (CANON-02)
✓ INSERT with brand_id=NULL raises 23502 (CANON-01 enforcement)
```

**Resolver regression gate — 4/4 GREEN:**
```
✓ Brand Tier 1 (exact match against seeded Hamilton brand) — INGEST-01
✓ Brand Tier 2 (fuzzy clear-gap on 'Hamilon' typo) — INGEST-02
✓ Family Tier 2 (alias hit on 'Brut Date' → 'Brut Datejust') — INGEST-04
✓ Brand Tier 3 (auto-create with needs_review=true) — INGEST-03
```

The NOT NULL constraint did not break the resolver — all resolver auto-create paths correctly produce non-NULL brand_id and family_id before the INSERT fires.

**Build:** Pre-existing failure in `scripts/v8.4-brand-canonicalization.ts:980` (`Cannot find name 'slugify'`). This is a known baseline noise per memory `[[baseline-not-green-build-is-gate]]` and was documented in 80-03-SUMMARY.md. No new errors introduced.

## Deviations from Plan

None — plan executed exactly as written. Both application paths (drizzle-kit push + psql raw SQL) applied cleanly. No NULL rows existed in local DB (Phase 03 wiring had already populated all test rows with valid FKs). No drift between drizzle-kit and hand-written SQL was detected.

## Hand-off to Plan 05

**Prod push NOT executed (per D-80-03 staged deploy).**

Plan 05 owns:
1. Vercel deploy verification (resolver code live in prod)
2. Operator manual extract proof (one URL extract confirms brand_id + family_id on new prod catalog row)
3. `supabase db push --linked` applying `20260626000000_phase80_catalog_brand_family_not_null.sql` to prod
4. Prod schema verification (information_schema check via Supabase SQL editor)

The migration file is ready at `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql`. The pre-flight DO $$ block will abort the migration if any NULL FKs remain in prod (which would indicate the resolver wiring failed silently). The post-flight DO $$ block confirms the schema state after the ALTERs.

## Known Stubs

None — this plan is DDL-only. No UI, no data stubs.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond those in the plan's threat model. The ALTERs are DDL-only; they do not expose any new surface. The migration file is not executable at the network boundary (operator-only push via `supabase db push --linked`).

## Self-Check

### Files exist
- [x] `src/db/schema.ts` — modified (notNull() on brandId + familyId)
- [x] `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql` — created
- [x] `.planning/phases/80-not-null-constraint-flip-ingest-hardening/80-04-SUMMARY.md` — this file

### Commits exist
- [x] `68db42a8` — feat(80-04): flip watches_catalog brand_id + family_id to .notNull() in Drizzle schema
- [x] `e28cbf3f` — feat(80-04): add 20260626000000_phase80_catalog_brand_family_not_null.sql migration
- [x] `d0a08cf7` — test(80-04): apply migration locally + green CANON-01/02 integration tests (3/3)

### Self-Check: PASSED
