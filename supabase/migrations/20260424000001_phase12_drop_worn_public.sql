-- Phase 12 (WYWT-11): Drop the legacy profile_settings.worn_public column.
--
-- Replaces the v2.0 all-or-nothing worn-history toggle with the per-row
-- wear_events.visibility enum introduced in Phase 11 and read-side-rippled
-- in Phase 12 Plans 02-05.
--
-- Ordering (privacy-first UAT rule):
--   1. Phase 11 backfilled wear_events.visibility from worn_public
--      (true to 'public', false to 'private', no 'followers' rows).
--   2. Phase 12 Plans 02-04 moved every DAL read off profile_settings.worn_public
--      and onto wear_events.visibility (plus follow direction for 'followers' tier).
--   3. Phase 12 Plan 05 stripped every TypeScript reference to wornPublic
--      from the application layer.
--   4. THIS migration drops the column. Nothing reads it. The schema.ts
--      update (Plan 06 Task 1) already removed the Drizzle declaration.
--
-- Prod flow: apply via `supabase db push --linked --include-all` per
--   docs/deploy-db-setup.md. Phase 11 used the same runbook.

BEGIN;

ALTER TABLE profile_settings DROP COLUMN worn_public;

COMMIT;
