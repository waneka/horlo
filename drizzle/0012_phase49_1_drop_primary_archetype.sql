-- Phase 49.1 — Remove genre surface. Drops the primary_archetype column from
-- watches_catalog. The watches_catalog_primary_archetype_check CHECK constraint
-- (added in supabase/migrations/20260430000000_phase19_1_taste_constraints.sql)
-- is dropped implicitly by Postgres along with the column.
--
-- Idempotent: re-running is safe (IF EXISTS).
-- Sequencing (D-MIG-02): runs LAST in dev (Plan 07). The prod supabase mirror
-- (Plan 08) runs after all reader code has been deployed to prod.
--> statement-breakpoint
ALTER TABLE "watches_catalog" DROP COLUMN IF EXISTS "primary_archetype";
