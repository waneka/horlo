-- Phase 11 Migration 7: backfill coverage assertion (WR-02 fix)
-- Source: Code review 11-REVIEW.md WR-02
--
-- Problem: Migration 1's visibility backfill (20260423000001_phase11_wear_visibility.sql)
-- uses an INNER JOIN against profile_settings. Any wear_events row whose owner has no
-- matching profile_settings row is silently left on the column DEFAULT 'public'.
-- The Phase 7 profile_settings trigger guarantees every user gets a settings row, so this
-- gap should never materialize — but there is no DB-level backstop. Migration 1's inline
-- verification only asserts no row became 'followers'; it does NOT assert that every
-- wear_events row had a profile_settings match.
--
-- Fix: explicit orphan-count assertion. If any wear_events row lacks a profile_settings
-- match, this migration fails loudly — the owner's visibility may be silently wrong.
-- In practice this is a belt-and-suspenders check (Phase 7 trigger handles coverage),
-- but it catches data-quality drift that would otherwise go unnoticed.
--
-- Idempotent: the assertion is read-only. Safe to re-run.

BEGIN;

DO $$
DECLARE
  orphan_count bigint;
BEGIN
  SELECT COUNT(*) INTO orphan_count
    FROM wear_events we
   WHERE NOT EXISTS (
     SELECT 1 FROM profile_settings ps WHERE ps.user_id = we.user_id
   );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Backfill coverage gap (WR-02): % wear_events rows have no matching profile_settings row; the Phase 7 trigger is meant to guarantee coverage — investigate users predating the trigger',
      orphan_count;
  END IF;
END $$;

COMMIT;
