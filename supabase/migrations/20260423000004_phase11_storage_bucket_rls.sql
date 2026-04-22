-- Phase 11 Migration 4/5: wear-photos Storage bucket + three-tier RLS + folder enforcement
-- Source: 11-CONTEXT.md D-01/D-02/D-03/D-04, 11-RESEARCH.md §SQL Snippet 4, §Pitfall 2
-- Requirements: WYWT-13 (bucket), WYWT-14 (three-tier storage RLS)
--
-- =============================================================================
-- KNOWN ISSUE (WR-04): The SELECT policy below is BROKEN without Migration 4b.
-- wear_events has owner-only RLS, so the EXISTS subqueries that JOIN wear_events
-- return no rows for non-owner viewers — public + followers tiers fail closed.
-- Migration 4b (20260423000004b_phase11_storage_rls_secdef_fix.sql) replaces the
-- SELECT policy with SECURITY DEFINER helpers that bypass wear_events RLS.
-- Migration 6 (20260423000006_phase11_secdef_revoke_public.sql) tightens those
-- helpers' EXECUTE grants.
-- DO NOT deploy Migration 4 without 4b — non-owner access will fail closed.
-- Squashing 4 + 4b into a single migration before production rollout is tracked
-- as follow-up work in the Phase 11 review; until then, treat 4 + 4b (+ 6) as
-- an indivisible group.
-- =============================================================================
--
-- DEPENDENCY: This migration REQUIRES Migration 1 (wear_events.visibility + wear_visibility enum)
-- to have run first. The SELECT policy JOINs wear_events on visibility. Running Migration 4
-- before Migration 1 will fail at CREATE POLICY with "column wear_events.visibility does not
-- exist". Supabase CLI runs migrations in filename order, so the timestamped prefix
-- (20260423000004 > 20260423000001) enforces ordering.
--
-- Defense-in-depth (D-01): even a leaked signed URL is gated by the storage policy.
-- Folder enforcement (D-03, Pitfall F-4): clients can only upload into their own user-prefixed folder.

BEGIN;

-- ============================================================================
-- Bucket creation — private, 5 MB limit, JPEG/PNG/WEBP only
-- ============================================================================
-- ON CONFLICT DO NOTHING makes this idempotent if the bucket was created by a
-- prior failed migration or manual dashboard action. The whole migration
-- transaction still enforces bucket + policies as a single unit.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wear-photos',
  'wear-photos',
  false,
  5242880,  -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SELECT policy — three-tier visibility enforcement (D-01)
-- ============================================================================
-- Object path convention: {user_id}/{wear_event_id}.jpg
--   (storage.foldername(name))[1]                      = user_id string
--   split_part(storage.filename(name), '.', 1)         = wear_event_id string
--
-- Four-branch short-circuit OR:
--   1. Owner — always sees own files (covers private + all other tiers)
--   2. Public-visibility — any authenticated viewer with the signed URL passes
--   3. Followers-visibility — requires a follow relationship
--   4. Private-visibility — subsumed by branch 1 (owner-only); explicit for clarity
--
-- All auth.uid() calls wrapped in (SELECT auth.uid()) for InitPlan caching
-- (Pitfall 2 — storage.objects path has the same InitPlan affordance as public tables).
-- ============================================================================

DROP POLICY IF EXISTS wear_photos_select_three_tier ON storage.objects;
CREATE POLICY wear_photos_select_three_tier ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wear-photos'
    AND (
      -- Branch 1: owner — always sees own files
      (storage.foldername(name))[1] = (SELECT auth.uid())::text

      -- Branch 2: public-visibility wear
      OR EXISTS (
        SELECT 1 FROM wear_events we
        WHERE we.id::text = split_part(storage.filename(name), '.', 1)
          AND we.visibility = 'public'
      )

      -- Branch 3: followers-visibility AND viewer follows actor
      OR EXISTS (
        SELECT 1
          FROM wear_events we
          JOIN follows f
            ON f.following_id = we.user_id
         WHERE we.id::text = split_part(storage.filename(name), '.', 1)
           AND we.visibility = 'followers'
           AND f.follower_id = (SELECT auth.uid())
      )
    )
  );

-- ============================================================================
-- INSERT policy — folder enforcement (D-03, Pitfall F-4)
-- Authenticated users may ONLY upload into their own folder.
-- ============================================================================

DROP POLICY IF EXISTS wear_photos_insert_own_folder ON storage.objects;
CREATE POLICY wear_photos_insert_own_folder ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wear-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- UPDATE policy — folder enforcement on both sides (USING and WITH CHECK)
-- ============================================================================

DROP POLICY IF EXISTS wear_photos_update_own_folder ON storage.objects;
CREATE POLICY wear_photos_update_own_folder ON storage.objects
  FOR UPDATE
  TO authenticated
  USING      (bucket_id = 'wear-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'wear-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ============================================================================
-- DELETE policy — folder enforcement
-- ============================================================================

DROP POLICY IF EXISTS wear_photos_delete_own_folder ON storage.objects;
CREATE POLICY wear_photos_delete_own_folder ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wear-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

COMMIT;
