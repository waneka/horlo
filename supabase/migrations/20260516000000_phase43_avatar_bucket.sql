-- Phase 43 Migration: avatars Storage bucket + RLS.
-- Source: 43-04-PLAN.md Task 1, 43-PATTERNS.md §"supabase/migrations/20260516000000_phase43_avatar_bucket.sql"
-- Decisions: D-09, D-10 (PLSH-06) — avatar upload replaces avatar-URL text field
--
-- Bucket: avatars
-- Path convention: {userId}/avatar.jpg (one file per user; upsert:true replaces in place)
--
-- Public bucket design:
--   Avatars are profile photos shown to all site visitors — public CDN URL is appropriate.
--   No SELECT policy needed: public buckets allow unauthenticated reads via the public URL
--   path without a row-level policy.
--   INSERT/UPDATE/DELETE are folder-scoped to the owning user (T-43-05 mitigation).
--
-- Idempotent: ON CONFLICT DO NOTHING for bucket; DROP POLICY IF EXISTS for policies.

BEGIN;

-- ============================================================================
-- Bucket creation — public (CDN URL, no expiry), 4 MB limit, JPEG/PNG/WEBP.
-- HEIC raw uploads rejected at bucket-mime level (client converts before upload).
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,       -- public: avatar images served directly via CDN URL to all visitors
  4194304,    -- 4 MB (512px JPEG ~50-200 KB after canvas re-encode; 4 MB is generous)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- INSERT policy — folder enforcement (T-43-05 mitigation).
-- Authenticated users may ONLY upload into their own folder (first path segment).
-- Verbatim predicate from Phase 19.1 catalog_source_photos_insert_own_folder.
-- ============================================================================
DROP POLICY IF EXISTS avatars_insert_own_folder ON storage.objects;
CREATE POLICY avatars_insert_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- UPDATE policy — folder enforcement on both USING and WITH CHECK (T-43-05).
-- ============================================================================
DROP POLICY IF EXISTS avatars_update_own_folder ON storage.objects;
CREATE POLICY avatars_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ============================================================================
-- DELETE policy — folder enforcement (T-43-05 mitigation).
-- ============================================================================
DROP POLICY IF EXISTS avatars_delete_own_folder ON storage.objects;
CREATE POLICY avatars_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- Sanity assertion — bucket + 3 policies present (no SELECT policy for public bucket).
-- ============================================================================
DO $$
DECLARE
  bucket_count integer;
  policy_count integer;
BEGIN
  SELECT count(*) INTO bucket_count
    FROM storage.buckets WHERE id = 'avatars';
  SELECT count(*) INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE 'avatars_%';
  IF bucket_count <> 1 THEN
    RAISE EXCEPTION 'phase 43 avatar bucket: expected 1, got %', bucket_count;
  END IF;
  IF policy_count <> 3 THEN
    RAISE EXCEPTION 'phase 43 RLS policies: expected 3, got %', policy_count;
  END IF;
END $$;

COMMIT;
