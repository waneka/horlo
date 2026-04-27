-- Phase 17 Migration 1/2: watches_catalog schema (RLS, generated cols, UNIQUE NULLS NOT DISTINCT, GIN, CHECK, trigger, snapshots)
-- Source: 17-CONTEXT.md D-01..D-09, D-12; 17-RESEARCH.md §"Pattern 1"
-- Requirements: CAT-01, CAT-02, CAT-03, CAT-04, CAT-12
--
-- Sibling Drizzle migration: drizzle/0004_phase17_catalog.sql (column shapes only).
-- This file layers RLS + generated columns + NULLS NOT DISTINCT UNIQUE + GIN + CHECK +
-- updated_at trigger + snapshots-table RLS on top.
--
-- pg_cron migration is separate: 20260427000001_phase17_pg_cron.sql (Plan 05).

BEGIN;

-- ============================================================
-- 1. Generated columns (D-02, D-03)
-- ============================================================
-- The Drizzle migration created brand_normalized/model_normalized/reference_normalized
-- as plain text columns (or with GENERATED clauses if Drizzle 0.45.2 emitted them
-- correctly — Plan 01 Task 2 has the fallback note). This migration ensures the
-- GENERATED ALWAYS AS clauses are authoritative regardless of Drizzle's emission.
--
-- We use `ALTER COLUMN ... ADD GENERATED ALWAYS AS ...` if the columns are plain,
-- but Postgres requires DROP + ADD COLUMN GENERATED ALWAYS AS. To keep this
-- migration idempotent and safe to re-run after a Drizzle change, we instead
-- DROP and re-ADD only if not already generated:

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'watches_catalog'
       AND column_name = 'brand_normalized'
       AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE watches_catalog DROP COLUMN IF EXISTS brand_normalized;
    ALTER TABLE watches_catalog ADD COLUMN brand_normalized text
      GENERATED ALWAYS AS (lower(trim(brand))) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'watches_catalog'
       AND column_name = 'model_normalized'
       AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE watches_catalog DROP COLUMN IF EXISTS model_normalized;
    ALTER TABLE watches_catalog ADD COLUMN model_normalized text
      GENERATED ALWAYS AS (lower(trim(model))) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'watches_catalog'
       AND column_name = 'reference_normalized'
       AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE watches_catalog DROP COLUMN IF EXISTS reference_normalized;
    ALTER TABLE watches_catalog ADD COLUMN reference_normalized text
      GENERATED ALWAYS AS (
        CASE WHEN reference IS NULL THEN NULL
             ELSE regexp_replace(lower(trim(reference)), '[^a-z0-9]+', '', 'g')
        END
      ) STORED;
  END IF;
END
$$;

-- ============================================================
-- 2. CHECK constraints (D-04, D-06)
-- ============================================================
ALTER TABLE watches_catalog
  DROP CONSTRAINT IF EXISTS watches_catalog_source_check;
ALTER TABLE watches_catalog
  ADD CONSTRAINT watches_catalog_source_check
  CHECK (source IN ('user_promoted', 'url_extracted', 'admin_curated'));

ALTER TABLE watches_catalog
  DROP CONSTRAINT IF EXISTS watches_catalog_image_source_quality_check;
ALTER TABLE watches_catalog
  ADD CONSTRAINT watches_catalog_image_source_quality_check
  CHECK (image_source_quality IS NULL
         OR image_source_quality IN ('official','retailer','unknown'));

-- ============================================================
-- 3. Natural-key UNIQUE on normalized trio with NULLS NOT DISTINCT (D-01, CAT-01)
-- ============================================================
-- Postgres 15+ syntax. Two `(Rolex, Submariner, NULL)` rows must collide.
DROP INDEX IF EXISTS watches_catalog_natural_key_idx;
CREATE UNIQUE INDEX watches_catalog_natural_key_idx
  ON watches_catalog (brand_normalized, model_normalized, reference_normalized)
  NULLS NOT DISTINCT;

-- ============================================================
-- 4. pg_trgm GIN indexes for sub-200ms search (CAT-03)
-- ============================================================
-- pg_trgm extension already enabled in extensions schema (Phase 11 Mig 3).
-- Schema-qualify the opclass per memory project_drizzle_supabase_db_mismatch.md Rule 3.
CREATE INDEX IF NOT EXISTS watches_catalog_brand_trgm_idx
  ON watches_catalog USING gin (brand extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS watches_catalog_model_trgm_idx
  ON watches_catalog USING gin (model extensions.gin_trgm_ops);

-- /explore Trending sort index (Phase 18 will read this)
CREATE INDEX IF NOT EXISTS watches_catalog_owners_count_desc_idx
  ON watches_catalog (owners_count DESC NULLS LAST);

-- ============================================================
-- 5. updated_at maintenance trigger (D-12)
-- ============================================================
CREATE OR REPLACE FUNCTION watches_catalog_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS watches_catalog_set_updated_at_trg ON watches_catalog;
CREATE TRIGGER watches_catalog_set_updated_at_trg
  BEFORE UPDATE ON watches_catalog
  FOR EACH ROW EXECUTE FUNCTION watches_catalog_set_updated_at();

-- ============================================================
-- 6. RLS — public-read, service-role-write only (CAT-02, deliberate departure)
-- ============================================================
-- Anon/authenticated SELECT works. Anon/authenticated INSERT/UPDATE/DELETE all
-- fail (no policy). Server Actions use service-role Drizzle client which bypasses RLS.
-- Pitfall 4: every new table MUST have ENABLE RLS + at least one policy in the same commit.
ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watches_catalog_select_all ON watches_catalog;
CREATE POLICY watches_catalog_select_all
  ON watches_catalog FOR SELECT USING (true);

-- ============================================================
-- 7. Snapshots table RLS (CAT-12 + Pitfall 4)
-- ============================================================
ALTER TABLE watches_catalog_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watches_catalog_snapshots_select_all ON watches_catalog_daily_snapshots;
CREATE POLICY watches_catalog_snapshots_select_all
  ON watches_catalog_daily_snapshots FOR SELECT USING (true);

-- ============================================================
-- 8. Sanity assertion — fail loudly if any of the above didn't land
-- ============================================================
DO $$
DECLARE
  has_natural_key boolean;
  brand_is_generated boolean;
  has_select_policy boolean;
  has_snapshots_select_policy boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'watches_catalog_natural_key_idx')
    INTO has_natural_key;
  SELECT (is_generated = 'ALWAYS') FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'watches_catalog' AND column_name = 'brand_normalized'
    INTO brand_is_generated;
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'watches_catalog_select_all')
    INTO has_select_policy;
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = 'watches_catalog_snapshots_select_all')
    INTO has_snapshots_select_policy;

  IF NOT has_natural_key THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed — natural-key UNIQUE missing';
  END IF;
  IF NOT brand_is_generated THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed — brand_normalized not GENERATED ALWAYS';
  END IF;
  IF NOT has_select_policy THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed — watches_catalog SELECT policy missing (Pitfall 4)';
  END IF;
  IF NOT has_snapshots_select_policy THEN
    RAISE EXCEPTION 'Phase 17 Mig 1 failed — snapshots SELECT policy missing (Pitfall 4)';
  END IF;
END
$$;

COMMIT;
