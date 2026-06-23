-- Phase 77 fix-pass: storage SELECT policy must handle -poster.jpg filenames
-- Source: 77-REVIEW.md CR-01
--
-- Problem: The Phase 11 storage.objects SELECT policy uses
--   split_part(storage.filename(name), '.', 1)::uuid
-- to extract the wear_event_id from the object's filename. For:
--   - `{wearEventId}.jpg`  → split_part returns `{wearEventId}` (valid UUID) ✓
--   - `{wearEventId}.mp4`  → split_part returns `{wearEventId}` (valid UUID) ✓
--   - `{wearEventId}-poster.jpg` → split_part returns `{wearEventId}-poster`
--                                  → ::uuid cast FAILS / never matches
--
-- Phase 77 stores poster JPEGs at `{userId}/{wearEventId}-poster.jpg`
-- (locked in SEED-020 D-07). The dash-suffix breaks the existing policy's
-- UUID extraction so non-owner viewers cannot SELECT posters → home-rail
-- video tiles render the catalog fallback + Play badge, and the detail-
-- page error fallback fires for non-owners.
--
-- Fix: strip the `-poster` suffix before the split_part call. Use a
-- regex_replace so the policy works for both filename shapes:
--   `{uuid}.{ext}`        → regex_replace returns `{uuid}.{ext}` unchanged
--   `{uuid}-poster.{ext}` → regex_replace returns `{uuid}.{ext}`
-- then split_part on '.' index 1 always yields the UUID.
--
-- All three branches (owner foldername, public visibility, followers)
-- are recreated with the new extraction; semantics otherwise identical.
--
-- Security: still scoped to bucket_id = 'wear-photos'; still gated by the
-- three SECURITY DEFINER helpers from Phase 11 Plan 05; no new exposure.

BEGIN;

DROP POLICY IF EXISTS wear_photos_select_three_tier ON storage.objects;
CREATE POLICY wear_photos_select_three_tier ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wear-photos'
    AND (
      -- Branch 1: owner — always sees own files (foldername unchanged)
      (storage.foldername(name))[1] = (SELECT auth.uid())::text

      -- Branch 2: public-visibility wear
      OR public.get_wear_event_visibility_bypassing_rls(
           split_part(
             regexp_replace(storage.filename(name), '-poster\.', '.'),
             '.', 1
           )::uuid
         ) = 'public'

      -- Branch 3: followers-visibility AND viewer follows actor
      OR (
        public.get_wear_event_visibility_bypassing_rls(
          split_part(
            regexp_replace(storage.filename(name), '-poster\.', '.'),
            '.', 1
          )::uuid
        ) = 'followers'
        AND public.viewer_follows_bypassing_rls(
          (SELECT auth.uid()),
          public.get_wear_event_owner_bypassing_rls(
            split_part(
              regexp_replace(storage.filename(name), '-poster\.', '.'),
              '.', 1
            )::uuid
          )
        )
      )
    )
  );

COMMIT;
