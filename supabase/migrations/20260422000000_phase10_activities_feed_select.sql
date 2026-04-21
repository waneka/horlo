-- Phase 10: Expand activities SELECT policy for Network Activity feed (FEED-01).
-- Before this migration: activities_select_own restricts SELECT to user_id = auth.uid(),
-- which makes the feed JOIN return zero rows. This migration replaces it with a policy
-- that also admits rows belonging to users the viewer follows. Per-event privacy gates
-- (collection_public / wishlist_public / worn_public from profile_settings) are enforced
-- at the DAL WHERE clause (see src/data/activities.ts getFeedForUser), per CONTEXT.md F-06.

BEGIN;

DROP POLICY IF EXISTS activities_select_own ON public.activities;

CREATE POLICY activities_select_own_or_followed ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follows.follower_id = (SELECT auth.uid())
        AND follows.following_id = activities.user_id
    )
  );

COMMIT;
