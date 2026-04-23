-- Phase 13 Migration 1/1: profile_settings extensions for notifications (NOTIF-04, NOTIF-09)
-- Source: 13-CONTEXT.md D-06, D-07, D-11, D-16, D-18
-- Requirements: NOTIF-04 (bell last-seen-at), NOTIF-09 (opt-out toggles)
-- Pitfalls addressed: Pitfall 2 (notifications_last_seen_at NULL on existing rows), Pitfall 8 (two-file migration discipline)
--
-- IDEMPOTENCE: Every ALTER TABLE uses ADD COLUMN IF NOT EXISTS. Safe to re-apply after
-- drizzle-kit push has already added the columns from src/db/schema.ts. Matches Phase 8
-- and Phase 11 precedent.
--
-- Single atomic transaction. If any step fails, the whole migration rolls back.

BEGIN;

-- Columns — guarded so drizzle-kit push idempotence is preserved.
ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_follow boolean NOT NULL DEFAULT true;

ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_watch_overlap boolean NOT NULL DEFAULT true;

-- Backfill for existing rows (Pitfall 2): set notifications_last_seen_at = now() so the
-- bell does not show a stale "everything is unread" dot on ship day. The DEFAULT now()
-- above only applies to NEW inserts; existing rows materialized before this migration
-- got NULL when the column was added by ADD COLUMN IF NOT EXISTS... except, Postgres
-- actually fills DEFAULT into existing rows when a NOT NULL DEFAULT is added in a single
-- statement. We UPDATE anyway as belt-and-suspenders — cheap, and covers the case where
-- drizzle-kit push ran first with a different default.
UPDATE profile_settings
   SET notifications_last_seen_at = now()
 WHERE notifications_last_seen_at IS NULL;

-- Post-migration assertions (Phase 11 precedent — 20260423000047_phase11_backfill_coverage_assertion.sql).
-- These fire a RAISE EXCEPTION if the migration is in a broken state, forcing the whole
-- transaction to roll back.
DO $$
BEGIN
  -- Assertion 1: all three columns exist with the expected types and NOT NULL.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profile_settings'
       AND column_name = 'notifications_last_seen_at'
       AND data_type = 'timestamp with time zone'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Phase 13 migration: notifications_last_seen_at column missing or wrong type/nullability';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profile_settings'
       AND column_name = 'notify_on_follow'
       AND data_type = 'boolean'
       AND is_nullable = 'NO'
       AND column_default = 'true'
  ) THEN
    RAISE EXCEPTION 'Phase 13 migration: notify_on_follow column missing or wrong type/default';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profile_settings'
       AND column_name = 'notify_on_watch_overlap'
       AND data_type = 'boolean'
       AND is_nullable = 'NO'
       AND column_default = 'true'
  ) THEN
    RAISE EXCEPTION 'Phase 13 migration: notify_on_watch_overlap column missing or wrong type/default';
  END IF;

  -- Assertion 2: no row has NULL notifications_last_seen_at (backfill coverage — Pitfall 2).
  IF EXISTS (SELECT 1 FROM profile_settings WHERE notifications_last_seen_at IS NULL) THEN
    RAISE EXCEPTION 'Phase 13 migration: backfill incomplete — profile_settings rows exist with NULL notifications_last_seen_at';
  END IF;
END $$;

COMMIT;
