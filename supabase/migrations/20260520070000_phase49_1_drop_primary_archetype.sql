-- Phase 49.1 — Remove genre surface. Drops the primary_archetype column from
-- watches_catalog on prod. Mirrors drizzle/0012_phase49_1_drop_primary_archetype.sql.
--
-- The watches_catalog_primary_archetype_check CHECK constraint
-- (added in 20260430000000_phase19_1_taste_constraints.sql) is dropped
-- implicitly by Postgres along with the column. No explicit DROP CONSTRAINT.
--
-- Idempotent: re-running is safe (IF EXISTS).
--
-- Sequencing (D-MIG-02): this migration MUST NOT be pushed to prod until
-- all reader code from Waves 1–3 is deployed (Vercel). Pushing earlier crashes
-- live traffic that still SELECTs the column. Run with:
--   supabase db push --linked
-- AFTER prod deploy of the reader-code removal.

ALTER TABLE "watches_catalog" DROP COLUMN IF EXISTS "primary_archetype";
