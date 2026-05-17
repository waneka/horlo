-- Phase 43 Migration: add SELECT policy missing from 20260516000000_phase43_avatar_bucket.sql.
-- Source: 43-06-PLAN.md Task 1 (gap closure GAP-43-03 / PLSH-06)
--
-- Background:
--   The original avatar bucket migration (20260516000000) stated "No SELECT policy needed:
--   public buckets allow unauthenticated reads via the public URL path without a row-level
--   policy." That reasoning holds for CDN reads. However, uploadAvatarPhoto uses upsert: true
--   via the Supabase JS client. The storage-api performs an object lookup on storage.objects
--   (a SELECT) before deciding insert-vs-update. Without a SELECT policy, that lookup is
--   rejected by RLS and the entire upsert returns 403 "new row violates row-level security
--   policy" — even though the INSERT and UPDATE policies themselves are present and correct.
--
-- Fix:
--   Add a folder-scoped SELECT policy (avatars_select_own_folder) to storage.objects.
--   The USING predicate mirrors avatars_insert_own_folder exactly, so an authenticated user
--   can SELECT only object rows in their own avatar folder ({userId}/avatar.jpg).
--
-- Security notes (T-43-G06-01, T-43-G06-03):
--   - Policy is TO authenticated only — never granted to the public role.
--   - USING includes the folder predicate so a user cannot SELECT another user's avatar row
--     via the storage-api (the authenticated API path). Public CDN reads are already gated
--     by the public bucket URL path and bypass RLS entirely; this policy does not affect or
--     widen that path.
--   - A bare USING (bucket_id = 'avatars') without the folder predicate is explicitly
--     prohibited by plan acceptance criteria — the folder predicate is present.
--
-- Idempotent: DROP POLICY IF EXISTS before CREATE POLICY.
-- This migration DOES NOT edit 20260516000000_phase43_avatar_bucket.sql; its = 3 assertion
-- was correct at run time. This migration's own assertion checks for = 4 (all four policies).

BEGIN;

-- ============================================================================
-- SELECT policy — folder-scoped, authenticated-only (T-43-G06-01 mitigation).
-- Required for uploadAvatarPhoto (upsert: true) so the storage-api object lookup
-- succeeds. Users can SELECT only rows in their own folder.
-- ============================================================================
DROP POLICY IF EXISTS avatars_select_own_folder ON storage.objects;
CREATE POLICY avatars_select_own_folder ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- Sanity assertion — 4 avatars_% policies must now exist on storage.objects.
-- (INSERT + UPDATE + DELETE from 20260516000000 + SELECT added here.)
-- ============================================================================
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname LIKE 'avatars_%';
  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'phase 43 avatar RLS policies: expected 4 (INSERT + UPDATE + DELETE + SELECT), got %', policy_count;
  END IF;
END $$;

COMMIT;
