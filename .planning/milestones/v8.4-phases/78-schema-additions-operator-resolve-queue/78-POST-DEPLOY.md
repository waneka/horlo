# Phase 78 — Prod Deployment Record (78-04)

**Date:** 2026-06-24
**Operator:** Tyler Waneka
**Status:** ✅ Verified
**Plan:** [78-04-PLAN.md](./78-04-PLAN.md)

---

## Deviation from Plan

Plan 04's spec called for the operator to run `supabase db push --linked` against prod after Plan 02 completed local apply. In practice, Plan 02's executor ran `supabase db push` WITHOUT the `--linked` flag during Wave 1 (commit `b339ab49`); the Supabase CLI defaults to the linked project when run from a linked workspace, so the migration applied to BOTH local AND prod in a single step.

**Risk assessment:** Non-destructive. The migration `20260624000000_phase78_aliases_needs_review.sql` is purely additive:
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS … DEFAULT …` on 3 columns (brands.needs_review, watch_families.needs_review, watch_families.aliases)
- `CREATE INDEX IF NOT EXISTS watch_families_aliases_gin_idx … USING GIN (aliases)`
- DO $$ post-flight assertion (read-only)

No data rows were touched. No existing columns were modified. No FKs flipped. Idempotent guards (`IF NOT EXISTS`) protect against double-apply.

**Outcome:** Plan 04's `supabase db push --linked` step is a no-op (`supabase migration list --linked` confirms row `20260624000000` already applied). Plan 04 collapses to verification-only.

---

## Verification Results (run 2026-06-24)

Operator ran these queries against the prod Supabase SQL editor:

### 1. brands.needs_review

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'needs_review';
```

✅ Result matches expected: `needs_review | boolean | NO | false`

### 2. watch_families.needs_review + aliases

```sql
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'watch_families'
  AND column_name IN ('needs_review', 'aliases')
ORDER BY column_name;
```

✅ Result matches expected:
- `aliases       | ARRAY   | _text | NO | '{}'::text[]`
- `needs_review  | boolean | bool  | NO | false`

### 3. GIN index

```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'watch_families'
  AND indexname = 'watch_families_aliases_gin_idx';
```

✅ Result matches expected: 1 row, `USING gin (aliases)`

### 4. Backfill defaults on existing rows

```sql
SELECT
  (SELECT count(*) FROM brands WHERE needs_review IS NOT FALSE) AS brands_bad,
  (SELECT count(*) FROM watch_families WHERE needs_review IS NOT FALSE) AS families_review_bad,
  (SELECT count(*) FROM watch_families WHERE aliases <> '{}') AS families_aliases_bad;
```

✅ Result matches expected: `0 | 0 | 0` — every existing brand and family row backfilled correctly per CANON-04 and D-78-08.

### 5. watches_catalog_natural_key UNIQUE constraint survived

```sql
SELECT conname, contype FROM pg_constraint
WHERE conname = 'watches_catalog_natural_key';
```

✅ Result matches expected: 1 row, `watches_catalog_natural_key | u` — the constraint did NOT silently drop during the migration push (per `[[local-catalog-natural-key-drift]]`).

---

## Sign-off

- [x] Phase 78 prod push completed: 2026-06-24 (via Plan 02 inline push, deviation accepted)
- [x] All 5 prod verification queries returned expected results
- [x] No data migrations triggered (Phase 79 owns data writes)

## What this push does NOT do (forward-armor against scope creep)

- Does NOT backfill `brand_id` / `family_id` on `watches_catalog` (Phase 79 MIG-02 / MIG-03)
- Does NOT flip NOT NULL on `brand_id` / `family_id` (Phase 80 CANON-01 / CANON-02)
- Does NOT change `/api/extract-watch` behavior (Phase 80 INGEST-01..04)
- Does NOT change recommender or display Server Actions (Phase 81)
- Does NOT add UI surfaces (Phase 82 UI-01..03, OPS-01..02)

## Phase 78 Deliverables Summary

| Requirement | Status |
|-------------|--------|
| CANON-03 — `watch_families.aliases text[]` + GIN index | ✅ Local + prod |
| CANON-04 — `needs_review boolean` on brands + watch_families | ✅ Local + prod |
| MIG-01 — Dry-run script + first `.md` artifact | ✅ `scripts/v8.4-brand-canonicalization.ts` + `.planning/v8.4-brand-merge-decisions.md` committed (53 rows / 19 auto-resolved / 34 needs-review) |

**MIG-05 portability foundation:** ✅ migration is filename-ordered, additive, idempotent; no `extensions.*` references needed (per R-FIND-01); first push to prod succeeded.

## Next Phase

Phase 79: Backfill Migration + Display Hydration — consume `.planning/v8.4-brand-merge-decisions.md` (operator edits status cells first), then run `scripts/v8.4-brand-canonicalization.ts --apply` to populate `watches_catalog.brand_id` + emit family decisions artifact + apply family backfill + hydrate `watches` table display strings.
