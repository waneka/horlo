-- Quick task 260620-gk9 follow-up — delete the rogue brand='test' model='test' row.
--
-- The preceding migration 20260620185911_quick_260620_gk9_catalog_image_backfill.sql
-- guarded its DELETE on `reference IS NULL`, but inspection shows the actual prod
-- row has reference = '' (empty string), so the DELETE was a no-op and the
-- post-flight assertion (also guarded on IS NULL) trivially passed.
--
-- This migration broadens the match to coalesce(reference, '') = '' so both
-- NULL and empty-string references are caught.
--
-- Apply via: supabase db push --linked
-- Do NOT use: drizzle-kit push / supabase db reset / local psql
-- Per memory: project_drizzle_supabase_db_mismatch

BEGIN;

-- Defense-in-depth: only delete if the row is genuinely orphaned.
-- (owners_count + wishlist_count = 0 AND no watches rows point at it).
DELETE FROM public.watches_catalog
 WHERE brand = 'test'
   AND model = 'test'
   AND coalesce(reference, '') = ''
   AND coalesce(owners_count, 0) = 0
   AND coalesce(wishlist_count, 0) = 0
   AND NOT EXISTS (
     SELECT 1 FROM public.watches w WHERE w.catalog_id = watches_catalog.id
   );

-- Post-flight: confirm no test/test row remains (either reference form).
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining FROM public.watches_catalog
   WHERE brand = 'test' AND model = 'test'
     AND coalesce(reference, '') = '';
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'post-flight: test/test row was not deleted (count=%)', remaining;
  END IF;
END $$;

COMMIT;
