-- Local Drizzle shape sync only. The authoritative migration is
-- supabase/migrations/20260624000000_phase78_aliases_needs_review.sql.
--
-- Per `project_drizzle_supabase_db_mismatch`: drizzle-kit push is LOCAL ONLY;
-- prod uses `supabase db push --linked` against the hand-written SQL file above.
-- This sibling file keeps `npm run dev` type-safety in sync when running
-- drizzle-kit push against a fresh local DB.
--
-- No DO $$ assertion block here, and no CREATE INDEX (Drizzle 0.45.2 indexUsing
-- API does not cleanly express GIN(array_ops) for the watch_families_aliases_gin_idx
-- — that index is created by the Supabase migration above).
--
-- Phase 78 CANON-03 + CANON-04 — additive only.

ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "needs_review" boolean NOT NULL DEFAULT false;
ALTER TABLE "watch_families" ADD COLUMN IF NOT EXISTS "needs_review" boolean NOT NULL DEFAULT false;
ALTER TABLE "watch_families" ADD COLUMN IF NOT EXISTS "aliases" text[] NOT NULL DEFAULT '{}';
