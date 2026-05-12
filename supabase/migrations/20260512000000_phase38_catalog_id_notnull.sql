-- Phase 38 Plan 01 — watches.catalog_id NOT NULL catch-up (Drizzle side)
--
-- Phase 36 (20260511000000_phase36_layer_c_variants.sql) already shipped the
-- SET NOT NULL constraint to production. This migration is the idempotent
-- catch-up companion for local environments that have not yet applied Phase 36
-- (e.g. fresh clone, dev reset). It is safe to run in any order and is a no-op
-- when the constraint already exists.
--
-- DO block avoids a hard error if the NOT NULL constraint is already in place.
DO $$
BEGIN
  -- Check if catalog_id is already NOT NULL by querying pg_attribute.
  -- attnotnull = true means the constraint already exists.
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
    ALTER TABLE public.watches ALTER COLUMN catalog_id SET NOT NULL;
  END IF;
END $$;
