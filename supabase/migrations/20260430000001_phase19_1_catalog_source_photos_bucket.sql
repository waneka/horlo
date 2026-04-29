-- Phase 19.1 Migration 2/2: catalog-source-photos Storage bucket + RLS.
-- Source: 19.1-CONTEXT.md D-20, D-21, 19.1-RESEARCH.md §"Phase 15 Photo Pipeline Reuse"
-- Decisions: D-20 (new bucket, three-tier RLS folder enforcement), D-21 (canonical catalog image_url)
--
-- Bucket: catalog-source-photos
-- Path convention: {userId}/{catalogId-or-pending}/{filename}.jpg
--
-- Asymmetric SELECT design (RESEARCH A7, CONTEXT.md `<code_context>`):
--   Any authenticated user can SELECT any photo (because the photo BECOMES the
--   public catalog image_url via D-21 / CAT-02 public-read intent). The bucket
--   SELECT policy is permissive-to-authenticated; folder-enforcement applies
--   only to writes. T-19.1-01-02 disposition: accept (TOS deferred).
--
-- INSERT/UPDATE/DELETE: copy-verbatim from Phase 11 wear-photos folder enforcement.
-- Idempotent: ON CONFLICT DO NOTHING for bucket; DROP POLICY IF EXISTS for policies.

BEGIN;

-- ============================================================================
-- Bucket creation — private-default (signed URLs only), 8 MB limit, JPEG/PNG/WEBP.
-- HEIC raw uploads rejected at bucket-mime level (client converts before upload).
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-source-photos',
  'catalog-source-photos',
  false,
  8388608,  -- 8 MB in bytes (matches Phase 15 raw-upload cap before client compression)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SELECT policy — authenticated-can-read-any (D-20 + D-21 intent).
-- Catalog itself is public-read (CAT-02); the bucket photo becomes the canonical
-- image_url. Anonymous reads happen via direct image_url fetch from the catalog
-- row (Supabase signed URL or public CDN — out of scope for this policy).
-- ============================================================================
DROP POLICY IF EXISTS catalog_source_photos_select_authenticated ON storage.objects;
CREATE POLICY catalog_source_photos_select_authenticated ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'catalog-source-photos');

-- ============================================================================
-- INSERT policy — folder enforcement (T-19.1-01-01 mitigation).
-- Authenticated users may ONLY upload into their own folder (first path segment).
-- Phase 11 wear-photos pattern, verbatim except for bucket name.
-- ============================================================================
DROP POLICY IF EXISTS catalog_source_photos_insert_own_folder ON storage.objects;
CREATE POLICY catalog_source_photos_insert_own_folder ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-source-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- UPDATE policy — folder enforcement on both USING and WITH CHECK.
-- ============================================================================
DROP POLICY IF EXISTS catalog_source_photos_update_own_folder ON storage.objects;
CREATE POLICY catalog_source_photos_update_own_folder ON storage.objects
  FOR UPDATE
  TO authenticated
  USING      (bucket_id = 'catalog-source-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'catalog-source-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ============================================================================
-- DELETE policy — folder enforcement.
-- ============================================================================
DROP POLICY IF EXISTS catalog_source_photos_delete_own_folder ON storage.objects;
CREATE POLICY catalog_source_photos_delete_own_folder ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'catalog-source-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- Sanity assertion — bucket + 4 policies present.
-- ============================================================================
DO $$
DECLARE
  bucket_count integer;
  policy_count integer;
BEGIN
  SELECT count(*) INTO bucket_count
    FROM storage.buckets WHERE id = 'catalog-source-photos';
  SELECT count(*) INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE 'catalog_source_photos_%';
  IF bucket_count <> 1 THEN
    RAISE EXCEPTION 'phase 19.1 bucket: expected 1, got %', bucket_count;
  END IF;
  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'phase 19.1 RLS policies: expected 4, got %', policy_count;
  END IF;
END $$;

COMMIT;
