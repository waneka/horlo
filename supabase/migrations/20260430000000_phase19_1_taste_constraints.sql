-- Phase 19.1 Migration 1/2: Taste-attribute CHECK constraints + image_source_quality expansion.
-- Source: 19.1-CONTEXT.md D-01, D-02, D-03, D-21
-- Decisions: D-01 (8 taste columns), D-02 (CHECK + TS unions), D-03 (reuse image columns + add 'user_uploaded')
--
-- Idempotent: each constraint follows DROP IF EXISTS → ADD pattern.
-- Wraps in BEGIN/COMMIT so the three CHECK alterations are atomic.
-- Mirrors Phase 17 D-04 source CHECK constraint pattern verbatim.

BEGIN;

-- ============================================================================
-- primary_archetype CHECK — closed vocab (10 functional categories + NULL)
-- ============================================================================
ALTER TABLE watches_catalog
  DROP CONSTRAINT IF EXISTS watches_catalog_primary_archetype_check;
ALTER TABLE watches_catalog
  ADD CONSTRAINT watches_catalog_primary_archetype_check
  CHECK (primary_archetype IS NULL
         OR primary_archetype IN (
           'dress','dive','field','pilot','chrono',
           'gmt','racing','sport','tool','hybrid'
         ));

-- ============================================================================
-- era_signal CHECK — closed vocab (3 era buckets + NULL)
-- ============================================================================
ALTER TABLE watches_catalog
  DROP CONSTRAINT IF EXISTS watches_catalog_era_signal_check;
ALTER TABLE watches_catalog
  ADD CONSTRAINT watches_catalog_era_signal_check
  CHECK (era_signal IS NULL
         OR era_signal IN ('vintage-leaning','modern','contemporary'));

-- ============================================================================
-- image_source_quality CHECK — extend Phase 17 set with 'user_uploaded' (D-21).
-- Existing allowed values: 'official', 'retailer', 'unknown' + NULL.
-- ============================================================================
ALTER TABLE watches_catalog
  DROP CONSTRAINT IF EXISTS watches_catalog_image_source_quality_check;
ALTER TABLE watches_catalog
  ADD CONSTRAINT watches_catalog_image_source_quality_check
  CHECK (image_source_quality IS NULL
         OR image_source_quality IN ('official','retailer','unknown','user_uploaded'));

-- ============================================================================
-- Sanity assertion — confirm constraints applied (Phase 17 idiom)
-- ============================================================================
DO $$
DECLARE
  c1 integer;
  c2 integer;
  c3 integer;
BEGIN
  SELECT count(*) INTO c1
    FROM pg_constraint
   WHERE conname = 'watches_catalog_primary_archetype_check';
  SELECT count(*) INTO c2
    FROM pg_constraint
   WHERE conname = 'watches_catalog_era_signal_check';
  SELECT count(*) INTO c3
    FROM pg_constraint
   WHERE conname = 'watches_catalog_image_source_quality_check';
  IF c1 <> 1 OR c2 <> 1 OR c3 <> 1 THEN
    RAISE EXCEPTION 'phase 19.1 taste constraints: expected all 3 CHECKs present, got primary_archetype=%, era_signal=%, image_source_quality=%', c1, c2, c3;
  END IF;
END $$;

COMMIT;
