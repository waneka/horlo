-- Phase 61 debug — clean up mis-backfilled watch_photos rows
--
-- The Phase 60 migration (20260525000000_phase60_watch_photos.sql, STEP 3)
-- backfilled watches.image_url → watch_photos.storage_path for every watch with a
-- non-null image_url, assuming image_url was always a Storage path. But for
-- catalog-sourced watches, image_url held an external CATALOG URL (https://…), so
-- those URLs were inserted as bogus storage_paths. createSignedUrl() can't sign a
-- URL → the detail-page carousel showed the watch-icon placeholder for an owner
-- photo that never existed. (Grids still rendered because watch.imageUrl == the
-- cover storage_path == that URL, which getSafeImageUrl passes through.)
--
-- These rows are NOT real uploaded photos — no object exists in the watch-photos
-- bucket for them. Deleting them restores the correct state: the affected watches
-- fall back to their catalog image (watches_catalog.image_url) via the cover→catalog
-- chain in the DAL. Valid rows (storage_path = '{userId}/…') are real uploads/covers
-- and are preserved.
--
-- A real storage path is '{uuid}/{photoId}.{ext}' and never starts with 'http', so
-- the `LIKE 'http%'` predicate targets exactly the mis-backfilled URL rows.
--
-- Per memory project_drizzle_supabase_db_mismatch: this is a Supabase migration
-- (prod applies via `supabase db push --linked`). Pure DELETE — no schema change,
-- no enum/extension ordering gotchas. Idempotent (re-running deletes nothing once
-- the URL rows are gone).

BEGIN;

DELETE FROM watch_photos
WHERE storage_path LIKE 'http://%'
   OR storage_path LIKE 'https://%';

-- Assertion: no URL-shaped storage_path rows remain.
DO $$
DECLARE remaining int;
BEGIN
  SELECT count(*) INTO remaining
    FROM watch_photos
   WHERE storage_path LIKE 'http://%' OR storage_path LIKE 'https://%';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'cleanup incomplete: % watch_photos rows still have a URL storage_path', remaining;
  END IF;
END $$;

COMMIT;
