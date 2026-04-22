-- Phase 11 Migration 4b: Fix storage.objects SELECT policy — SECURITY DEFINER helper
-- Source: Plan 05 Rule-1 auto-fix (deviation)
--
-- Problem: The storage SELECT policy in Migration 4 JOINs `wear_events` directly.
-- `wear_events` has owner-only RLS (wear_events_select_own). When non-owner users
-- (followers, strangers) attempt to download a photo, the EXISTS subquery runs as
-- the calling user and cannot see the wear_events row → always returns false → access
-- denied even for public photos.
--
-- Fix: Create a SECURITY DEFINER function `public.get_wear_event_visibility_bypassing_rls`
-- that bypasses RLS to look up wear_events.visibility by ID. The storage SELECT policy
-- calls this function instead of doing a direct JOIN. The SECURITY DEFINER context
-- (postgres superuser) can always see the row. The function is deliberately minimal:
-- it returns NULL if the row doesn't exist (treated as no-access by the policy).
--
-- Security: The function reveals only the visibility enum value of a wear event by UUID.
-- It does not expose user_id, photo_url, note, or any other fields.
-- Storage objects are still fully gated by bucket_id + the three visibility branches.

BEGIN;

-- Helper: bypass RLS to read wear_events.visibility for storage policy JOIN.
-- Returns NULL if the row does not exist (treated as no-access in the policy).
CREATE OR REPLACE FUNCTION public.get_wear_event_visibility_bypassing_rls(p_wear_event_id uuid)
  RETURNS wear_visibility
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT visibility FROM wear_events WHERE id = p_wear_event_id
$$;

-- Helper: bypass RLS to check if a follower relationship exists.
-- Returns true if follower_id follows following_id.
-- This is needed so the storage policy can check follows without RLS interference.
CREATE OR REPLACE FUNCTION public.viewer_follows_bypassing_rls(p_follower_id uuid, p_following_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = p_follower_id
      AND following_id = p_following_id
  )
$$;

-- Helper: bypass RLS to read the user_id from a wear event.
-- Needed so storage policy can find the owner from the wear_event_id in the path.
CREATE OR REPLACE FUNCTION public.get_wear_event_owner_bypassing_rls(p_wear_event_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT user_id FROM wear_events WHERE id = p_wear_event_id
$$;

-- Update the storage SELECT policy to use SECURITY DEFINER helpers.
-- The owner branch still uses foldername (no RLS bypass needed — it's a path string comparison).
-- The public branch calls get_wear_event_visibility_bypassing_rls and checks = 'public'.
-- The followers branch additionally checks viewer_follows_bypassing_rls.
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
      OR public.get_wear_event_visibility_bypassing_rls(
           split_part(storage.filename(name), '.', 1)::uuid
         ) = 'public'

      -- Branch 3: followers-visibility AND viewer follows actor
      OR (
        public.get_wear_event_visibility_bypassing_rls(
          split_part(storage.filename(name), '.', 1)::uuid
        ) = 'followers'
        AND public.viewer_follows_bypassing_rls(
          (SELECT auth.uid()),
          public.get_wear_event_owner_bypassing_rls(
            split_part(storage.filename(name), '.', 1)::uuid
          )
        )
      )
    )
  );

COMMIT;
