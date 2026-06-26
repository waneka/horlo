# Phase 80 — Prod Deployment Runbook

**Date written:** 2026-06-26
**Operator:** Tyler Waneka
**Depends on:** Plan 04 complete (NOT NULL migration SQL at `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql`)
**Goal:** Get the new resolver code to prod, prove it works on real data, then turn on the database guardrail that prevents canonical drift from ever creeping back in.

---

## Status

| Step | Description | Status |
|------|-------------|--------|
| Step 1 | Deploy ingest code to prod (Vercel) | pending |
| Step 2 | Manual prod extract proof (Hamilton URL) | pending |
| Step 3 | Push NOT NULL migration (`supabase db push --linked`) | pending |

Update each row from `pending` to `complete (YYYY-MM-DD HH:MM)` as you complete each step. Paste the Step 2 + Step 3 SQL results inline.

---

## What this phase ships in prod

Phase 80 delivers two coordinated changes. First, the ingest resolver: every new catalog row that comes through `/api/extract-watch` (URL extract or structured search) now looks up the canonical `brand_id` and `family_id` before inserting into `watches_catalog`. If the brand is already in the catalog, it reuses the existing canonical row rather than letting free-text drift produce a second `Hamilton` or `Hamilton Watch` row. If the brand is genuinely new, the resolver auto-creates a `brands` row with `needs_review = true` so Phase 82's admin queue can clean it up later. Second, the NOT NULL constraint: once the resolver code is live and we've proved it writes both FKs on real data, the migration flips `watches_catalog.brand_id` and `watches_catalog.family_id` from nullable to required. The database itself then rejects any future ingest row that somehow slips through without a canonical brand or family. Phase 79's backfill already resolved all 205 existing catalog rows, so the constraint applies immediately without touching old data.

---

## D-80-03 Staged Deploy — Three Ordered Steps

The sequence matters. Running Step 3 before Step 2 is not safe: if the resolver has a silent wire-up bug, the first real prod extract after the migration lands would crash with a `23502 NOT NULL violation`. The order below prevents that window.

### Step 1 — Deploy the ingest code to prod

**What you're doing:** Pushing the resolver code to Vercel. The database still allows NULL in `brand_id` and `family_id`, so nothing breaks for old code paths — but every new catalog row will now have both FKs populated.

**The risk if you skip this step and go straight to Step 3:** The migration would land while old code is still running on prod. The next URL extract would crash with `ERROR 23502: null value in column "brand_id" violates not-null constraint`. That error would show up in Vercel logs as a non-fatal upsert failure, silently returning `catalogId: null` to the user. Then every subsequent extract would either succeed (if the new code was deployed in time) or fail (if it wasn't). The staged pattern avoids this race entirely.

**Commands:**
```bash
git push
```

Vercel auto-deploys on push. Confirm the deploy succeeded in the Vercel dashboard before moving to Step 2.

**Verification after Step 1:** Watch Vercel logs for 5 minutes after the deploy goes green. You should see normal proxy traffic with no `[extract-watch] catalog upsert failed` errors. If you see upsert failures with `23502`, the resolver wire-up has a bug — stop and investigate before Step 2.

---

### Step 2 — Manual extract proof on prod

**What you're doing:** Running ONE real extract on prod and looking at the database. If both `brand_id` and `family_id` are populated on the new catalog row, the resolver wire-up is solid. If either is NULL, there's a bug and the migration would brick the next ingest.

**The cheapest test:** A Hamilton URL. Hamilton is already in the prod catalog, so the resolver should hit Tier 1 (exact match) and attach the canonical Hamilton `brands.id` without creating a new row. No log events should fire (Tier 1 exact match is silent per D-80-04).

**Steps:**
1. Sign into prod at `https://horlo.app` as yourself.
2. Go to the Add Watch flow, enter this URL in the URL import field:
   ```
   https://www.hamiltonwatch.com/en-us/khaki-field-mechanical-h69439931.html
   ```
3. Complete the extract (click through to the confirmation step — you don't need to save the watch to your collection, just verify the extract succeeds).
4. Open the [Supabase prod SQL editor](https://supabase.com/dashboard/) and run this query:

```sql
SELECT c.id, c.brand, c.model, c.brand_id, c.family_id,
       b.name AS canonical_brand,
       f.name AS canonical_family
FROM watches_catalog c
LEFT JOIN brands b ON b.id = c.brand_id
LEFT JOIN watch_families f ON f.id = c.family_id
WHERE c.brand = 'Hamilton'
  AND c.created_at > now() - interval '10 minutes'
ORDER BY c.created_at DESC LIMIT 1;
```

**Pass condition:** `brand_id` AND `family_id` are both non-NULL, and `canonical_brand = 'Hamilton'`.

**If FAIL (either FK is NULL):** Do not proceed to Step 3. The resolver was not properly wired into one of the two upsert helpers (`upsertCatalogFromExtractedUrl` or `upsertCatalogFromUserInput`). Check Vercel logs for any `catalog upsert failed` errors. Raise a follow-up plan or revise Plan 03.

**Also check:** Vercel logs during the extract should NOT show `[extract-watch] brand_auto_created` for "Hamilton" — that would indicate the resolver didn't find the existing Hamilton row and auto-created a duplicate, which is a path regression.

**Paste your SQL result below this line after running Step 2:**

```
(paste here)
```

---

### Step 3 — Push the NOT NULL migration to prod

**What you're doing:** Running the same migration file that Plan 04 applied to local. This tells Postgres that `brand_id` and `family_id` are now required — every new catalog row must have both FKs, or the INSERT fails immediately with a clear error (not a silent NULL that corrupts recommendations later).

**Why it's safe now:** Phase 79's backfill already made every existing catalog row have non-NULL FKs (205/205 resolved, confirmed in 79-POST-DEPLOY.md). Step 2 confirmed the new resolver code populates both FKs on new rows. The migration's own pre-flight check double-confirms: if it finds any NULL rows at migration time, it raises an EXCEPTION and rolls the whole migration back. So the worst case — if somehow a NULL row appeared between Phase 79 and now — is a clean rollback with an error message, not a partially-applied migration.

**Commands:**
```bash
supabase db push --linked
```

Supabase CLI will apply `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql`. Expected output: `Applying migration 20260626000000_phase80_catalog_brand_family_not_null.sql`. Expected duration: under 1 second (ALTER TABLE on ~205 rows).

If the CLI reports `RAISE EXCEPTION: Found X rows with NULL brand_id in watches_catalog` or similar: the migration rolled back cleanly. Do not panic. Either re-run Step 2 to identify the NULL rows, backfill them manually, or revert the Phase 80 code deploy and raise a follow-up plan.

**Step 3 Sign-Off — run all 6 queries in the Supabase SQL editor:**

```sql
-- 1. brand_id is NOT NULL
SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'watches_catalog'
  AND column_name = 'brand_id';
-- expect: NO
```

```sql
-- 2. family_id is NOT NULL
SELECT is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'watches_catalog'
  AND column_name = 'family_id';
-- expect: NO
```

```sql
-- 3. No NULL rows (sanity check — should always be 0 given Phase 79 + Step 2)
SELECT count(*) AS null_count
FROM watches_catalog
WHERE brand_id IS NULL OR family_id IS NULL;
-- expect: 0
```

```sql
-- 4. Hamilton row from Step 2 still has its FKs (confirms migration didn't touch data)
SELECT brand_id, family_id
FROM watches_catalog
WHERE brand = 'Hamilton'
  AND created_at > now() - interval '20 minutes'
ORDER BY created_at DESC LIMIT 1;
-- expect: both columns non-NULL (same UUIDs as in Step 2)
```

```sql
-- 5. needs_review queue baseline (should be 0 from Phase 79 if no new brands were auto-created)
SELECT count(*) AS review_queue_depth
FROM brands
WHERE needs_review = true;
-- expect: 0 if no auto-creates happened since Phase 79, or a small number if some did
```

```sql
-- 6. Migration recorded in Supabase migration ledger
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20260626000000';
-- expect: 1 row (20260626000000 | 20260626000000_phase80_catalog_brand_family_not_null)
```

**Paste your SQL results below this line after running Step 3:**

```
(paste results here — one block per query, labeled by query number)
```

---

## Forward-Armor

**Phase 81 (RECO-01..04 + DISP-01/02)** can now safely JOIN through `brand_id` and `family_id` without NULL-defensive code. Every catalog row has non-NULL FKs as of Phase 79's backfill + Phase 80's constraint. The recommender's brand exclusion key (RECO-01) and multi-brand scoring (RECO-02) rely on this invariant.

**Phase 82 (/admin/brands + /admin/families)** consumes the `needs_review = true` queue that Phase 80's auto-create path produces. After Phase 80 goes live, monitor `SELECT count(*) FROM brands WHERE needs_review = true` over the next 7 days. A spike in that count means ingest is seeing genuinely novel brands (expected for new watches from new brands). A zero count means every ingest is hitting the existing canonical brand table (also fine, just slower queue growth). A count matching the number of new extracts would indicate the resolver is falling through to auto-create too aggressively — that would be a threshold tuning signal (D-05 threshold tunable; planned for Phase 82+).

**The Hamilton drift loop is closed.** Phase 79 merged `Hamilton Watch` → `Hamilton`. Phase 80 ensures the next extract that returns `Hamilton Watch` (from a legacy retailer page) will resolve to the canonical Hamilton brand row via the fuzzy resolver, not create a new `Hamilton Watch` brand. The drift cannot re-enter through ingest.

---

## Operator Review Queue Seeded

Phase 80 is the first writer of `needs_review = true` on `brands` and `watch_families`. Every auto-create path (Tier 3 brand, Tier 4 family) produces one row each with `needs_review = true`. Phase 79's `--apply` left the queue empty (all rows inserted with `needs_review = false` per D-79-09). After Phase 80 goes live, the first time a user extracts a URL for a brand not in the catalog, a new `brands` row appears in the queue. Phase 82's `/admin/brands` and `/admin/families` pages will surface these for operator review.

To check the queue depth at any time:
```sql
SELECT count(*) FROM brands WHERE needs_review = true;
SELECT count(*) FROM watch_families WHERE needs_review = true;
```

---

## Rollback Plan

**If Step 3 raises EXCEPTION (pre-flight or post-flight DO $$ block fires):**
The migration is wrapped in `BEGIN`/`COMMIT`. An exception inside any DO $$ block rolls back the entire transaction. Prod `watches_catalog` schema is unchanged — still nullable on `brand_id` and `family_id`. No user data was touched.

**Recovery options:**
1. Run the Step 2 verification query again to identify any rows with NULL `brand_id` or `family_id`. Backfill them manually via `UPDATE watches_catalog SET brand_id = (SELECT id FROM brands WHERE name_normalized = lower(trim(brand))) WHERE brand_id IS NULL`.
2. If the NULL rows came from a resolver regression (Step 1 code), revert the Phase 80 code deploy in the Vercel dashboard, fix the regression, and re-run the full D-80-03 sequence.
3. If the NULL rows are from old pre-Phase-79 data that somehow wasn't backfilled, run the Phase 79 backfill script (`scripts/v8.4-brand-canonicalization.ts --apply --mode=both`) against prod and then retry Step 3.

**If Step 2 shows NULL FKs:**
Do not run Step 3. The resolver wire-up is broken. The constraint would immediately block the next extract. Investigate which upsert helper isn't calling the resolver (check `upsertCatalogFromExtractedUrl` and `upsertCatalogFromUserInput` in `src/data/catalog.ts` — both must call `resolveBrandId` + `resolveFamilyId`).

---

## References

- CANON-01: `watches_catalog.brand_id NOT NULL` (REQUIREMENTS.md)
- CANON-02: `watches_catalog.family_id NOT NULL` (REQUIREMENTS.md)
- INGEST-01..04: resolver tier coverage requirements
- D-80-03: staged deploy decision (80-CONTEXT.md § Decisions)
- Migration file: `supabase/migrations/20260626000000_phase80_catalog_brand_family_not_null.sql`
- Phase 79 post-deploy: `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md`
