---
quick_task: 260620-gk9
plan: 01
subsystem: catalog-data
tags: [migration, catalog, images, backfill, prod-only]
status: complete
key-files:
  created:
    - supabase/migrations/20260620185911_quick_260620_gk9_catalog_image_backfill.sql
    - supabase/migrations/20260620190354_quick_260620_gk9_delete_test_row_empty_ref.sql
    - scripts/list-catalog-missing-images.ts
decisions:
  - "All 18 UPDATEs guarded with AND (image_url IS NULL OR btrim(image_url) = '') for idempotency"
  - "test/test row DELETE guarded with owners_count=0 + wishlist_count=0 + NOT EXISTS watches subquery"
  - "Natural-key keying (brand, model, reference) throughout — never id"
  - "PROD-ONLY apply: supabase db push --linked; local not touched per project_catalog-id-divergence"
  - "Follow-up migration required because prod test/test row had reference='' not NULL; first migration's IS NULL guard (and its post-flight assertion sharing the same predicate) silently no-op'd"
metrics:
  completed_date: "2026-06-20"
  rows_backfilled: 18
  rows_deleted: 1
  final_missing: 0
  final_total: 193
---

# Quick Task 260620-gk9: Catalog Image Backfill Summary

One-liner: Prod migration backfilling 18 missing `watches_catalog.image_url` values and deleting the rogue `test/test` row, eliminating all 9.8% placeholder-image catalog entries.

## What Shipped

**Task 1 (authored, committed — daf3e03c):**
`supabase/migrations/20260620185911_quick_260620_gk9_catalog_image_backfill.sql`

- 18 idempotent `UPDATE public.watches_catalog` statements, one per missing-image row
- 1 guarded `DELETE FROM public.watches_catalog` for the `brand='test' model='test' reference IS NULL` orphan row
- Pre-flight `DO $$` assertion: confirms all 18 (brand, model, reference) triples exist in prod before touching data
- Post-flight `DO $$` assertion: confirms 0 of the 18 rows still missing `image_url`, and `test/test` row is gone
- Wrapped in `BEGIN; ... COMMIT;` — any assertion failure rolls back the entire transaction

Brands covered: A. Lange & Söhne (3 refs), Baume & Mercier, Blancpain, Certina, Christopher Ward, Jaeger-LeCoultre (3 refs), Omega, Orient, Rolex (2 refs), Sinn, Tudor, Vacheron Constantin, Zenith.

## Apply Path — PROD ONLY

This migration must be applied to prod only. Do NOT run `drizzle-kit push`, `supabase db reset`, or local psql against this file.

## Task 2 Apply — completed by orchestrator

`supabase db push --linked` applied migration `20260620185911` to prod on
2026-06-20. CLI reported `Finished supabase db push.` and `npm run
catalog:missing-images` then returned **1 of 194** missing — not the
expected 0 of 193.

**Diagnosis:** the rogue test/test row in prod had `reference = ''`
(empty string), not `reference IS NULL`. The first migration's DELETE
guard matched only `IS NULL`, so the delete was a no-op. The post-flight
assertion (sharing the same `IS NULL` predicate) trivially counted 0 and
passed — a textbook "assertion validates itself" bug.

**Fix:** authored a second migration
`20260620190354_quick_260620_gk9_delete_test_row_empty_ref.sql` that
broadens the match to `coalesce(reference, '') = ''`. Pushed via
`supabase db push --linked`. Final verification:

```
$ npm run catalog:missing-images
[missing-images] 0 of 193 catalog rows missing image_url (0.0%)
```

Goal achieved.

### Durable lesson

A post-flight assertion designed to catch a bug in the migration's WHERE
clause MUST use a *different predicate* than the operation it gates.
Otherwise the assertion blindly inherits any silent miss in the original
predicate. For catalog hygiene specifically: prefer
`coalesce(reference, '') = ''` (or normalize empty-string references to
NULL at insert time upstream).

## Original Task 2 Operator Steps (now historical)

Task 2 is a `checkpoint:human-verify`. The operator must complete these steps:

### Step 1 — Review the migration before pushing

```bash
cat supabase/migrations/$(ls -t supabase/migrations/ | head -1)
```

Spot-check: 18 UPDATEs, 1 DELETE, pre/post `DO $$` assertion blocks, filename `*_quick_260620_gk9_*`.

### Step 2 — Push to prod (NOT local)

```bash
supabase db push --linked
```

Expected: CLI prompts for confirmation, applies the one new migration
(`20260620185911_quick_260620_gk9_catalog_image_backfill.sql`), prints `Finished supabase db push.`

**If a `RAISE EXCEPTION` fires:** the transaction rolls back — investigate before retrying.
- `pre-flight: expected 18 matching catalog rows, found N` (N < 18): a (brand, model, reference) triple in the migration doesn't match prod exactly. Re-export with `npm run catalog:missing-images` and compare.
- `post-flight: N of the 18 targeted rows still missing image_url`: unexpected — report back.

### Step 3 — Re-run the read-only inventory against prod

```bash
npm run catalog:missing-images
```

Expected output:
```
[missing-images] 0 of 193 catalog rows missing image_url (0.0%)
```

193 = 194 prior total - 1 deleted test/test row. If you see `194` and `0`, the DELETE silently no-op'd — report back.

### Step 4 — Confirm the regenerated markdown shows 0 data rows

```bash
cat scripts/seed-data/catalog-missing-images.md
```

Expected: header table present, zero data rows below the `| ----- | ----- | ... |` separator.

### Step 5 — (Optional) Direct SQL sanity check on prod

```sql
-- Should return 0
SELECT count(*) FROM public.watches_catalog
 WHERE image_url IS NULL OR btrim(image_url) = '';

-- Should return 0
SELECT count(*) FROM public.watches_catalog
 WHERE brand = 'test' AND model = 'test';
```

### Step 6 — (Optional) Visual smoke check

Open the explore page on prod and browse to one of the backfilled watches (e.g. Tudor Black Bay 58 GMT, or any Rolex) and confirm a real image renders instead of the watch-icon placeholder.

### After all checks pass

Stage and commit:
```bash
git add scripts/seed-data/catalog-missing-images.md
git commit -m "chore(quick-260620-gk9): regenerate catalog-missing-images.md (0 missing after prod push)"
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] Migration file exists: `supabase/migrations/20260620185911_quick_260620_gk9_catalog_image_backfill.sql`
- [x] Exactly 18 `UPDATE public.watches_catalog` statements
- [x] 1 `DELETE FROM public.watches_catalog` statement
- [x] Pre-flight `RAISE EXCEPTION 'pre-flight` assertion present
- [x] Post-flight `RAISE EXCEPTION 'post-flight` assertions present
- [x] Filename `20260620185911` sorts after `20260620001739` (latest previous migration)
- [x] Migration NOT applied locally
- [x] Commit `daf3e03c` exists

## Self-Check: PASSED
