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

-- Post-enum-extension assertion (WR-03 fix: presence-based check, not exact-count)
-- This DO $$ block does NOT open an explicit transaction boundary — safe in this file.
-- Verifies the 4 Phase 53 values are now present in notification_type.
-- WR-03 fix: replaced `enum_count <> 6` exact-count with a presence-of-4-values check
-- so supabase db reset replay survives a future 7th or 8th enum value without failing here.
DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT count(*) INTO missing_count
    FROM (VALUES
      ('watch_like'::text), ('wear_like'::text),
      ('watch_comment'::text), ('wear_comment'::text)
    ) AS expected(val)
    WHERE expected.val NOT IN (
      SELECT pe.enumlabel FROM pg_enum pe
      JOIN pg_type pt ON pe.enumtypid = pt.oid
      WHERE pt.typname = 'notification_type'
    );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Phase 53 enum migration failed -- % of 4 expected values missing from notification_type', missing_count;
  END IF;
END $$;
