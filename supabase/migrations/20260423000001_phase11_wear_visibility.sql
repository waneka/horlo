-- Phase 11 Migration 1/5: wear_visibility enum + wear_events columns + backfill + verification
-- Source: 11-CONTEXT.md D-05/D-07/D-08, 11-RESEARCH.md §SQL Snippet 1, Pitfall G-6
-- Requirements: WYWT-09, WYWT-11
--
-- This migration is ATOMIC (BEGIN...COMMIT). If the inline DO $$ verification block
-- raises, the entire transaction rolls back — no partial state ships.
--
-- IDEMPOTENCE: Every non-transactional DDL statement (CREATE TYPE, ADD COLUMN,
-- ADD CONSTRAINT) is guarded with IF NOT EXISTS (or an equivalent DO $$ pg_catalog
-- lookup) so this migration is safe to re-apply after `drizzle-kit push` has already
-- created the same objects from `src/db/schema.ts`. Matches the Phase 8 precedent in
-- supabase/migrations/20260420000003_phase8_notes_columns.sql which uses
-- `ADD COLUMN IF NOT EXISTS`.
--
-- NOTE: profile_settings.worn_public stays in place after this migration (D-06).
-- Phase 12 drops it after the DAL ripple lands. Do NOT add DROP COLUMN here.

BEGIN;

-- Enum: wear_visibility with all three tiers. Guarded because drizzle-kit push may
-- have already created it from `wearVisibilityEnum` in src/db/schema.ts.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wear_visibility') THEN
    CREATE TYPE wear_visibility AS ENUM ('public', 'followers', 'private');
  END IF;
END $$;

-- Extend wear_events with photo_url and visibility columns.
-- Note: `note` already exists (added in Phase 8). This migration only adds photo_url and visibility.
-- IF NOT EXISTS lets this re-apply cleanly after drizzle-kit push created the columns.
ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS photo_url text NULL;
ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS visibility wear_visibility NOT NULL DEFAULT 'public';

-- Add the 200-char CHECK on the already-existing `note` column (WYWT-09).
-- Phase 8 added the column but did not enforce a length cap.
-- Postgres does not support `ADD CONSTRAINT IF NOT EXISTS` for CHECKs, so guard via pg_constraint lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'wear_events_note_length'
       AND conrelid = 'public.wear_events'::regclass
  ) THEN
    ALTER TABLE wear_events
      ADD CONSTRAINT wear_events_note_length CHECK (note IS NULL OR length(note) <= 200);
  END IF;
END $$;

-- Backfill visibility from profile_settings.worn_public (D-07, WYWT-11).
-- Mapping: worn_public=true → 'public', worn_public=false → 'private'.
-- NEVER 'followers' — that would silently widen exposure of previously-private wears (Pitfall G-6).
-- The backfill UPDATE runs ONLY for users that have a matching profile_settings row
-- (INNER JOIN semantics). The Phase 7 profile_settings trigger guarantees every user gets a row
-- at signup, so in practice every wear_events row is covered — but if an upstream user existed
-- prior to the Phase 7 trigger and never received settings, their wear_events rows keep the
-- DEFAULT 'public'. The orphan-coverage assertion in Migration 7
-- (20260423000007_phase11_backfill_coverage_assertion.sql) verifies no such gap exists.
-- Safe to re-run: the CASE only writes 'public' or 'private', and re-deriving those values
-- from the same `profile_settings.worn_public` source yields the same result.
UPDATE wear_events we
   SET visibility = CASE ps.worn_public
                      WHEN true  THEN 'public'::wear_visibility
                      ELSE            'private'::wear_visibility
                    END
  FROM profile_settings ps
 WHERE ps.user_id = we.user_id;

-- Inline verification (Pitfall G-6 backstop).
-- No backfilled row may have visibility='followers'. If any exist, the whole transaction aborts.
DO $$
DECLARE
  followers_count bigint;
BEGIN
  SELECT COUNT(*) INTO followers_count
    FROM wear_events
   WHERE visibility = 'followers';

  IF followers_count > 0 THEN
    RAISE EXCEPTION
      'Backfill bug (Pitfall G-6): % rows ended up with visibility=followers; backfill must only produce public or private for legacy rows',
      followers_count;
  END IF;
END $$;

COMMIT;
