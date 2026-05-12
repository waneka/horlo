-- Phase 38 Plan 01 — watches.catalog_id NOT NULL (Drizzle type catch-up)
--
-- Phase 36 shipped the DB-level SET NOT NULL to production. This migration
-- brings the Drizzle schema in sync so drizzle-kit no longer diffs catalog_id
-- as nullable. Idempotent: safe to run when the constraint already exists.
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'watches'
      AND a.attname = 'catalog_id'
      AND a.attnotnull = false
      AND a.attnum > 0
  ) THEN
    ALTER TABLE "watches" ALTER COLUMN "catalog_id" SET NOT NULL;
  END IF;
END $$;
