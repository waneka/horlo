-- Phase 62 — hidden_from_detail column + partial index on wear_events
-- Source: 62-CONTEXT.md D-11; 62-RESEARCH.md Pitfall 4
-- Dual-migration discipline: drizzle-kit push LOCAL ONLY; prod uses supabase db push --linked
--
-- Per memory rule project_drizzle_supabase_db_mismatch.md:
--   drizzle-kit push is LOCAL ONLY; prod uses supabase db push --linked
--   Migration filename: 20260527000000_phase62_wear_hidden_from_detail.sql
--
-- Decision D-11: hidden_from_detail is a dedicated persistent state on wear_events,
-- separate from visibility — 'hide from detail' is NOT a visibility change.
-- DEFAULT false covers all existing rows; no data backfill needed.

BEGIN;

ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS hidden_from_detail boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS wear_events_watch_id_public_visible_idx
  ON wear_events(watch_id, worn_date DESC)
  WHERE visibility = 'public' AND hidden_from_detail = false;

COMMIT;
