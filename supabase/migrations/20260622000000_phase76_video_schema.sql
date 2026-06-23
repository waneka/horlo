-- Phase 76 — video schema: media_type enum + wear_events columns + CHECK + bucket MIME
-- Source: 76-RESEARCH.md §Migration content; SEED-020 D-07; VID-11, VID-12
-- Dual-migration discipline: drizzle-kit push LOCAL ONLY; prod uses supabase db push --linked
--   (per durable memory project_drizzle_supabase_db_mismatch)
--
-- Strictly ADDITIVE: contains no destructive column operations and does not overwrite
-- the legacy photo_url values. Pre-existing photo rows get media_type='photo' via the
-- column DEFAULT; their photo_url values remain intact (VID-11).
-- VID-12 invariant: any media_type='video' row MUST have non-NULL media_path AND poster_path,
-- enforced at the DB layer via wear_events_video_paths_required CHECK (defense in depth).

BEGIN;

-- =============================================================================
-- 1. Enum: media_type ('photo', 'video')
-- Guarded because drizzle-kit push may have already created it from
-- mediaTypeEnum in src/db/schema.ts. Same shape as Phase 11 wear_visibility.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE media_type AS ENUM ('photo', 'video');
  END IF;
END $$;

-- =============================================================================
-- 2. Add 3 new columns on wear_events (all idempotent under drizzle-kit push)
--    - media_type: NOT NULL DEFAULT 'photo' — existing rows backfill to 'photo'
--    - media_path: nullable — populated only for video rows
--    - poster_path: nullable — populated only for video rows
-- =============================================================================
ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS media_type media_type NOT NULL DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS media_path text NULL,
  ADD COLUMN IF NOT EXISTS poster_path text NULL;

-- =============================================================================
-- 3. CHECK constraint guard: wear_events_video_paths_required
-- Postgres does not support ADD CONSTRAINT IF NOT EXISTS for CHECKs, so guard
-- via pg_constraint lookup (Phase 53 likes/comments pattern at L69-80).
-- Predicate: photo rows are unrestricted; video rows require BOTH paths non-NULL.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'wear_events_video_paths_required'
       AND conrelid = 'public.wear_events'::regclass
  ) THEN
    ALTER TABLE wear_events
      ADD CONSTRAINT wear_events_video_paths_required
      CHECK (media_type = 'photo' OR (media_path IS NOT NULL AND poster_path IS NOT NULL));
  END IF;
END $$;

-- =============================================================================
-- 4. Bucket MIME UPDATE: append 'video/mp4' to wear-photos allowed_mime_types
-- Append-not-replace (Pitfall 4) via array_cat; idempotent via NOT EXISTS guard.
-- Pre-existing MIME allowlist: ARRAY['image/jpeg', 'image/png', 'image/webp'].
-- file_size_limit (5242880 = 5 MB) stays untouched — Phase 77 Server Action is
-- the authoritative size gate; bucket-level cap is defense in depth.
-- =============================================================================
UPDATE storage.buckets
   SET allowed_mime_types = array_cat(allowed_mime_types, ARRAY['video/mp4']::text[])
 WHERE id = 'wear-photos'
   AND NOT ('video/mp4' = ANY(allowed_mime_types));

-- =============================================================================
-- 5. Post-flight assertion (broader predicate per durable memory
--    project_post_flight_assertion_predicate_divergence): no existing row should
--    have media_type='video' immediately after this additive migration runs.
--    The ::text cast deliberately avoids inheriting the same DEFAULT 'photo'
--    semantics as section 2 — if someone changes the DEFAULT, this assertion
--    still catches a stray video row instead of trivially passing.
-- =============================================================================
DO $$
DECLARE
  bad_count bigint;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM wear_events
   WHERE media_type::text = 'video';

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Phase 76 post-flight assertion failed: % existing rows have media_type=video after migration; expected 0',
      bad_count;
  END IF;
END $$;

COMMIT;
