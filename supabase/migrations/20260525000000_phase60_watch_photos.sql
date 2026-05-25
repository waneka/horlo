-- Phase 60 — watch_photos table + backfill + RLS + storage bucket
-- Source: 60-CONTEXT.md D-01..D-16; 60-RESEARCH.md §Pattern 2
-- Sibling Drizzle schema: src/db/schema.ts (column shapes only — no RLS, no DO $$)
--
-- Threats mitigated:
--   Cross-tenant photo insert — blocked by ownership check + INSERT RLS
--   Storage path traversal — blocked by folder RLS (foldername = auth.uid())
--   Orphaned storage objects — purgeWatchPhotos in Server Action before deleteWatch
--
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   drizzle-kit push is LOCAL ONLY; prod uses supabase db push --linked
--   Do NOT run drizzle-kit push before this file is applied locally (Pitfall 1 — backfill ordering)

BEGIN;

-- ============================================================================
-- STEP 1: CREATE TABLE watch_photos (D-01, D-03, PHOTO-01)
-- id, watch_id (CASCADE FK), storage_path, sort_order, created_at
-- IF NOT EXISTS: idempotent when drizzle-kit push has already run.
-- ============================================================================
CREATE TABLE IF NOT EXISTS watch_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id     uuid        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 2: CREATE INDEX (D-03)
-- Composite on (watch_id, sort_order) — cover query for ordered photo list.
-- ============================================================================
CREATE INDEX IF NOT EXISTS watch_photos_watch_id_sort_idx
  ON watch_photos(watch_id, sort_order);

-- ============================================================================
-- STEP 3: BACKFILL watches.image_url → watch_photos at sort_order=0 (D-07, D-11)
-- LOSSLESS — must run BEFORE ALTER TABLE watches DROP COLUMN image_url.
-- ON CONFLICT DO NOTHING: idempotent on re-run (watch_id+sort_order not unique
-- constrained, but duplicate backfill rows are harmless; idempotency via INSERT).
-- Rows with image_url IS NULL are excluded (only non-null URLs backfilled).
-- ============================================================================
INSERT INTO watch_photos (id, watch_id, storage_path, sort_order, created_at)
SELECT gen_random_uuid(), id, image_url, 0, now()
FROM watches
WHERE image_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: PRE-DROP lossless assertion (D-07, D-11)
-- Raises EXCEPTION if any watches.image_url IS NOT NULL row is missing a
-- watch_photos row at sort_order=0. Must pass BEFORE the DROP COLUMN.
-- ============================================================================
DO $$
DECLARE missed_count int;
BEGIN
  SELECT count(*) INTO missed_count
    FROM watches w
   WHERE w.image_url IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM watch_photos wp
        WHERE wp.watch_id = w.id AND wp.sort_order = 0
     );
  IF missed_count > 0 THEN
    RAISE EXCEPTION 'Phase 60 backfill incomplete: % watches still have image_url with no sort_order=0 photo row', missed_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: DROP COLUMN watches.image_url (D-07)
-- AFTER the backfill + assertion — never before.
-- IF NOT EXISTS: idempotent (safe to re-run if column already dropped).
-- ============================================================================
ALTER TABLE watches DROP COLUMN IF EXISTS image_url;

-- ============================================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY on watch_photos
-- Non-owner reads go through the service-role DAL (Plan 03).
-- This RLS is the anon-block + owner-write backstop.
-- ============================================================================
ALTER TABLE watch_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Owner-scoped RLS policies (four operations)
-- NOTE (project_rls_subquery_caller_rls): The SELECT policy subqueries watches
-- (which has owner-only RLS). Non-owner viewers receive 0 rows — fails CLOSED
-- for non-owners (safe: no data leak). The service-role DAL in Plan 03 is the
-- real read gate for non-owner access; this policy is a defense-in-depth backstop.
-- Local DB has RLS OFF on pre-existing tables → not meaningfully testable locally.
-- Verify on prod (Plan 04).
-- ============================================================================

DROP POLICY IF EXISTS watch_photos_select_owner ON watch_photos;
CREATE POLICY watch_photos_select_owner ON watch_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS watch_photos_insert_owner ON watch_photos;
CREATE POLICY watch_photos_insert_owner ON watch_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS watch_photos_update_owner ON watch_photos;
CREATE POLICY watch_photos_update_owner ON watch_photos
  FOR UPDATE TO authenticated
  USING      (EXISTS (SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id AND w.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id AND w.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS watch_photos_delete_owner ON watch_photos;
CREATE POLICY watch_photos_delete_owner ON watch_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watches w WHERE w.id = watch_photos.watch_id
        AND w.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- STEP 8: watch-photos storage bucket (private, 8 MB, JPEG/PNG/WEBP)
-- Path convention: {userId}/{photoId}.jpg — enforced by folder RLS below.
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'watch-photos',
  'watch-photos',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 9: Storage folder RLS — per-user prefix enforcement
-- Folder convention: (storage.foldername(name))[1] = auth.uid()::text
-- Mirrors wear_photos_insert_own_folder pattern (20260423000004_phase11_storage_bucket_rls.sql).
-- ============================================================================

DROP POLICY IF EXISTS watch_photos_storage_insert_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS watch_photos_storage_update_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'watch-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS watch_photos_storage_delete_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS watch_photos_storage_select_own_folder ON storage.objects;
CREATE POLICY watch_photos_storage_select_own_folder ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'watch-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- STEP 10: Post-migration assertion
-- Confirms table, policies, and bucket were all created successfully.
-- ============================================================================
DO $$
DECLARE
  table_count  integer;
  policy_count integer;
  bucket_count integer;
BEGIN
  SELECT count(*) INTO table_count
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'watch_photos';

  SELECT count(*) INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'watch_photos';

  SELECT count(*) INTO bucket_count
    FROM storage.buckets
   WHERE id = 'watch-photos';

  IF table_count  <> 1 THEN RAISE EXCEPTION 'watch_photos table missing';     END IF;
  IF policy_count <  4 THEN RAISE EXCEPTION 'watch_photos RLS policies missing: expected >= 4, got %', policy_count; END IF;
  IF bucket_count <> 1 THEN RAISE EXCEPTION 'watch-photos bucket missing';    END IF;
END $$;

COMMIT;
