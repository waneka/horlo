-- Phase 45 Migration: cms-covers Storage bucket + RLS.
-- Source: 45-02-PLAN.md Task 1, 45-PATTERNS.md §"20260518210000_phase45_cms_covers_bucket.sql"
-- Decisions: D-14 (CMS-03) — curated list cover images upload to this bucket.
--
-- Bucket: cms-covers
-- Path convention: {listId}/{filename}.jpg (UUID-stamped; upsert:false — replace = new file)
--
-- Public bucket design:
--   Cover images are editorial assets served to all site visitors — public CDN URL is
--   appropriate. The bucket is intentionally public-read (T-45-08 accepted risk).
--   Writes are gated on is_admin EXISTS predicate (T-45-06 mitigation).
--
-- SELECT policy is mandatory even though uploads use upsert: false — Supabase Storage
-- still performs an object lookup (SELECT) before returning a 409 conflict or proceeding
-- with the INSERT. Without it, the upload returns 403 "new row violates row-level security
-- policy". Phase 43 (avatar bucket) hit this exact bug (Pitfall 2 from RESEARCH.md).
--
-- Ordering: timestamp 20260518210000 is later than 20260518200000 (phase45_cms_tables),
-- which creates profiles.is_admin. This migration depends on is_admin existing.
--
-- Idempotent: ON CONFLICT DO NOTHING for bucket; DROP POLICY IF EXISTS for policies.

BEGIN;

-- ============================================================================
-- Bucket creation — public (CDN URL, no expiry), 4 MB limit, JPEG/PNG/WEBP.
-- HEIC raw uploads rejected at bucket-mime level (client converts before upload).
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-covers',
  'cms-covers',
  true,       -- public: cover images served directly via CDN URL to all visitors
  4194304,    -- 4 MB (T-45-07 mitigation; client-side guard surfaces toast before upload)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SELECT policy — required for Supabase Storage object lookup on upload.
-- Even with upsert: false, the storage-api performs a SELECT on storage.objects
-- before deciding insert-vs-409. Without this policy the upload returns 403.
-- (T-45-06 mitigation; Phase 43 avatar bucket Pitfall 2 fix.)
-- ============================================================================
DROP POLICY IF EXISTS cms_covers_select_own ON storage.objects;
CREATE POLICY cms_covers_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cms-covers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ============================================================================
-- INSERT policy — is_admin gated (T-45-06 mitigation).
-- Only the site owner (is_admin = true) may upload cover images.
-- ============================================================================
DROP POLICY IF EXISTS cms_covers_insert_own ON storage.objects;
CREATE POLICY cms_covers_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cms-covers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ============================================================================
-- UPDATE policy — is_admin gated on both USING and WITH CHECK (T-45-06).
-- ============================================================================
DROP POLICY IF EXISTS cms_covers_update_own ON storage.objects;
CREATE POLICY cms_covers_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cms-covers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  )
  WITH CHECK (
    bucket_id = 'cms-covers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ============================================================================
-- DELETE policy — is_admin gated (T-45-06 mitigation).
-- ============================================================================
DROP POLICY IF EXISTS cms_covers_delete_own ON storage.objects;
CREATE POLICY cms_covers_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cms-covers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (SELECT auth.uid()) AND is_admin
    )
  );

-- ============================================================================
-- Sanity assertion — exactly 1 cms-covers bucket and exactly 4 policies present.
-- ============================================================================
DO $$
DECLARE
  bucket_count integer;
  policy_count integer;
BEGIN
  SELECT count(*) INTO bucket_count
    FROM storage.buckets WHERE id = 'cms-covers';
  SELECT count(*) INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE 'cms_covers_%';
  IF bucket_count <> 1 THEN
    RAISE EXCEPTION 'cms-covers bucket: expected 1, got %', bucket_count;
  END IF;
  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'cms-covers policies: expected 4, got %', policy_count;
  END IF;
END $$;

COMMIT;
