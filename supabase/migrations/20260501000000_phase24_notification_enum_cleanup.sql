-- Phase 24 Migration: notification_type ENUM cleanup (DEBT-03 + DEBT-04).
-- Removes the never-written 'price_drop' and 'trending_collector' values from the
-- notification_type enum. v3.0 defined them upfront (see 20260423000002_phase11_notifications.sql)
-- under the assumption a future phase would wire a write-path; that decision is reversed in v4.0.
--
-- Pattern: rename + recreate. Postgres has no `ALTER TYPE ... DROP VALUE`.
-- Reference: PROJECT.md Key Decisions ("ENUM cleanup uses rename + recreate")
--
-- Pre-flight (D-01 in-migration layer): the DO $$ block aborts the migration if any
-- notifications.type row still references the dead values. The standalone preflight
-- script `scripts/preflight-notification-types.ts` (npm run db:preflight-notification-cleanup)
-- is the first layer; this is the second.
--
-- Sequencing (D-05): apply this migration to prod via `supabase db push --linked` BEFORE
-- updating the Drizzle pgEnum in src/db/schema.ts. Drizzle's narrower enum would otherwise
-- reject the wider prod reality during dev.

BEGIN;

-- =========================================================================
-- LAYER 2 PREFLIGHT — D-01 in-migration assertion (whitelist phrasing).
-- =========================================================================
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM notifications
   WHERE type::text NOT IN ('follow', 'watch_overlap');
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase 24 preflight failed: % rows hold values outside the new enum domain {follow, watch_overlap}. Run scripts/preflight-notification-types.ts before retrying.', n;
  END IF;
END $$;

-- =========================================================================
-- DEPENDENT-INDEX SURGERY (T-24-PARTIDX)
-- =========================================================================
-- The Phase 11 migration (20260423000002_phase11_notifications.sql) created
-- a UNIQUE partial index `notifications_watch_overlap_dedup` whose predicate
-- references the enum literal `'watch_overlap'::notification_type`. Postgres
-- binds the predicate to the type's OID at index creation. After step 1
-- (RENAME), that predicate is now bound to `notification_type_old`, and the
-- ALTER COLUMN TYPE in step 3 fails with `operator does not exist:
-- notification_type = notification_type_old` because Postgres cannot
-- re-evaluate the predicate against the new type during column rewrite.
--
-- Drop the index BEFORE the rename and recreate AFTER the type swap. This
-- is safe because we are inside a single transaction holding AccessExclusive
-- lock on `notifications` — no concurrent writes can race the dedup gap.
--
-- The index is defined ONLY in the Phase 11 supabase migration (not in
-- src/db/schema.ts), which is why drizzle-kit-push-based local testing
-- did not catch this. See `project_drizzle_supabase_db_mismatch.md` and
-- the Footgun T-24-PARTIDX entry in docs/deploy-db-setup.md.
DROP INDEX IF EXISTS public.notifications_watch_overlap_dedup;

-- =========================================================================
-- ENUM RENAME + RECREATE — atomic with the assertion above.
-- =========================================================================

-- 1. Rename the existing type out of the way.
ALTER TYPE notification_type RENAME TO notification_type_old;

-- 2. Create the new type with only the live values.
CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap');

-- 3. Cast the column. The text bridge is required — Postgres cannot directly cast
--    between two distinct enum types. notifications.type is NOT NULL (per Phase 11
--    migration); the preflight guarantees every remaining row is 'follow' or
--    'watch_overlap', which cast cleanly.
ALTER TABLE notifications
  ALTER COLUMN type TYPE notification_type
  USING type::text::notification_type;

-- 4. Drop the old type. No rows or columns reference it after step 3.
DROP TYPE notification_type_old;

-- 5. Recreate the partial index against the NEW enum type. Identical shape
--    to the Phase 11 definition — same column tuple, same UTC-day bucket,
--    same `WHERE type = 'watch_overlap'` predicate (now bound to the new
--    `notification_type` OID).
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_overlap_dedup
  ON notifications (
    user_id,
    (payload->>'watch_brand_normalized'),
    (payload->>'watch_model_normalized'),
    ((created_at AT TIME ZONE 'UTC')::date)
  )
  WHERE type = 'watch_overlap';

-- =========================================================================
-- POST-MIGRATION ASSERTION — Phase 11 / Phase 13 precedent
-- =========================================================================
DO $$
DECLARE
  enum_count int;
BEGIN
  -- Verify the new type has exactly two values.
  SELECT count(*) INTO enum_count
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
   WHERE pg_type.typname = 'notification_type';

  IF enum_count <> 2 THEN
    RAISE EXCEPTION 'Phase 24 post-check: notification_type has % values, expected exactly 2', enum_count;
  END IF;

  -- Verify the column type points at the new enum.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'notifications'
       AND column_name = 'type'
       AND udt_name = 'notification_type'
  ) THEN
    RAISE EXCEPTION 'Phase 24 post-check: notifications.type column does not reference notification_type';
  END IF;

  -- Verify the partial dedup index was recreated and is bound to the new enum.
  -- Without this check we'd silently lose dedup enforcement if step 5 was ever
  -- removed in a future edit (T-24-PARTIDX defense in depth).
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'notifications'
       AND indexname = 'notifications_watch_overlap_dedup'
  ) THEN
    RAISE EXCEPTION 'Phase 24 post-check: notifications_watch_overlap_dedup partial index was not recreated';
  END IF;
END $$;

COMMIT;
