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
END $$;

COMMIT;
