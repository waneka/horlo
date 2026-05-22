-- Phase 53 Migration 2/2: notification_type enum extension (v6.0 social)
-- Source: 53-CONTEXT.md D-09; 53-RESEARCH.md §Pattern 4
-- Requirements: D-09 (ADD VALUE path — NOT the Phase 24 rename+recreate REMOVAL path)
--
-- CRITICAL: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- This file has NO BEGIN; / COMMIT; wrapper.
-- Supabase's migration runner treats bare files as non-transactional.
-- Test on local (supabase db reset) before supabase db push --linked.
--
-- This is the ADD path — explicitly NOT the Phase 24 rename+recreate pattern.
-- Phase 24 renamed+recreated the enum to REMOVE values (required pg_depend surgery
-- and index drops/recreates). ADD VALUE does not rename the type; the OID is stable;
-- no pg_depend pre-flight is needed.
--
-- IF NOT EXISTS guard makes each statement idempotent.
-- No pg_depend surgery needed (ADD VALUE does not rename the type; OID is stable).
-- The partial index notifications_watch_overlap_dedup bound to notification_type OID
-- (created in Phase 11, kept through Phase 24) is NOT affected by ADD VALUE.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_comment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_comment';

-- Post-enum-extension assertion (phase24 lines 94-130 pattern, adapted for ADD VALUE)
-- This DO $$ block does NOT open an explicit transaction boundary — safe in this file.
-- Verifies the enum now has exactly 6 values: follow, watch_overlap, watch_like,
-- wear_like, watch_comment, wear_comment.
DO $$
DECLARE
  enum_count int;
BEGIN
  SELECT count(*) INTO enum_count
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
   WHERE pg_type.typname = 'notification_type';

  IF enum_count <> 6 THEN
    RAISE EXCEPTION 'Phase 53 enum migration failed -- notification_type has % values, expected 6', enum_count;
  END IF;
END $$;
